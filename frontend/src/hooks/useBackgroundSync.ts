import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { SyncState } from '../components/IndikatorSinkron';
import { db } from '../db/db';

export function useBackgroundSync(petugasId: number) {
  const [syncState, setSyncState] = useState<SyncState>('tersinkron');
  const [syncError, setSyncError] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const isSyncing = useRef(false);

  const syncData = useCallback(async () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    setIsSaved(false);

    try {
      const pendingItems = await db.offlineQueue
        .where('petugas_id')
        .equals(petugasId)
        .and(item => item.sync_status === 'pending')
        .toArray();

      if (pendingItems.length === 0) {
        setSyncState('tersinkron');
        setSyncError('');
        return;
      }

      if (!navigator.onLine) {
        setSyncState('offline');
        return;
      }

      setSyncState('menyinkronkan');
      setSyncError('');
      const grouped = pendingItems.reduce<Record<string, typeof pendingItems>>((groups, item) => {
        const key = [item.jenis_kegiatan, item.target_id, item.jadwal_id, item.tanggal].join('|');
        (groups[key] ??= []).push(item);
        return groups;
      }, {});

      let hasError = false;
      for (const [key, items] of Object.entries(grouped)) {
        const [jenis, targetId, jadwalId, tanggal] = key.split('|');
        try {
          await api.post(`/api/absensi/${jenis}/bulk`, {
            target_id: Number(targetId),
            jadwal_id: Number(jadwalId),
            tanggal,
            absensi: items.map(item => ({
              santri_id: item.santri_id,
              status: item.status,
              menit_terlambat: item.menit_terlambat ?? null,
              keterangan: item.keterangan ?? null,
            })),
          });
          await db.offlineQueue.bulkDelete(items.flatMap(item => item.id === undefined ? [] : [item.id]));
        } catch (error) {
          console.error(`Gagal menyinkronkan absensi ${jenis}`, error);
          const apiMessage = (error as { response?: { data?: { message?: string } } })
            .response?.data?.message;
          setSyncError(apiMessage ?? 'Server tidak dapat menyimpan absensi. Periksa koneksi lalu coba lagi.');
          hasError = true;
        }
      }

      if (hasError) {
        setSyncState('error');
      } else {
        setSyncState('tersinkron');
        setSyncError('');
        setIsSaved(true);
        window.setTimeout(() => setIsSaved(false), 3000);
      }
    } catch (error) {
      console.error('Gagal membaca antrean absensi', error);
      setSyncError('Antrean absensi di perangkat tidak dapat dibaca. Muat ulang aplikasi lalu coba lagi.');
      setSyncState('error');
    } finally {
      isSyncing.current = false;
    }
  }, [petugasId]);

  useEffect(() => {
    db.offlineQueue.where('petugas_id').equals(petugasId).and(item => item.sync_status === 'pending').count()
      .then(count => setSyncState(count > 0 ? 'offline' : 'tersinkron'));

    const handleOnline = () => void syncData();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [petugasId, syncData]);

  return { syncState, syncData, isSaved, syncError };
}
