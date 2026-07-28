import { useEffect, useState, useCallback } from 'react';
import { db } from '../db/db';
import type { OfflineAbsensi } from '../db/db';
import { api } from '../api';
import type { SyncState } from '../components/IndikatorSinkron';

export function useBackgroundSync() {
  const [syncState, setSyncState] = useState<SyncState>('tersinkron');
  const [isSaved, setIsSaved] = useState(false);

  const syncData = useCallback(async () => {
    try {
      // Find all pending items
      const pendingItems = await db.offlineQueue.where('sync_status').equals('pending').toArray();
      
      if (pendingItems.length === 0) {
        setSyncState('tersinkron');
        return;
      }

      setSyncState('offline'); // Or 'syncing' if we had one, but offline is used to show orange pulsing

      // Group by jenis_kegiatan to send in batches since API is per-jenis
      const grouped = pendingItems.reduce((acc, item) => {
        if (!acc[item.jenis_kegiatan]) acc[item.jenis_kegiatan] = [];
        acc[item.jenis_kegiatan].push(item);
        return acc;
      }, {} as Record<string, OfflineAbsensi[]>);

      let hasError = false;

      for (const [jenis, items] of Object.entries(grouped)) {
        // Find distinct jadwal & tanggal (assuming one per page usually)
        // For simplicity, we assume one jadwal and tanggal per sync batch, or we group them further.
        const byJadwalTanggal = items.reduce((acc, item) => {
          const key = `${item.jadwal_id}|${item.tanggal}`;
          if (!acc[key]) acc[key] = [];
          acc[key].push(item);
          return acc;
        }, {} as Record<string, OfflineAbsensi[]>);

        for (const [jt, jtItems] of Object.entries(byJadwalTanggal)) {
          const [jadwal_id, tanggal] = jt.split('|');
          
          const payload = {
            jadwal_id: parseInt(jadwal_id),
            tanggal,
            absensi: jtItems.map(i => ({
              santri_id: i.santri_id,
              status: i.status
            }))
          };

          try {
            await api.post(`/api/absensi/${jenis}/bulk`, payload);
            // Mark as synced or delete
            const ids = jtItems.map(i => i.id!).filter(id => id !== undefined);
            await db.offlineQueue.bulkDelete(ids); // delete from queue once synced
          } catch (e) {
            console.error(`Failed to sync ${jenis}`, e);
            hasError = true;
          }
        }
      }

      if (hasError) {
        setSyncState('error');
      } else {
        setSyncState('tersinkron');
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
      setSyncState('error');
    }
  }, []);

  useEffect(() => {
    // Check initial state
    db.offlineQueue.where('sync_status').equals('pending').count().then(c => {
      if (c > 0) setSyncState('offline');
    });

    const handleOnline = () => {
      syncData();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncData]);

  return { syncState, syncData, isSaved };
}
