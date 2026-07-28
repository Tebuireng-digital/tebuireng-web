import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarisLedger } from '../components/BarisLedger';
import { IndikatorSinkron } from '../components/IndikatorSinkron';
import type { StatusAbsensi } from '../components/PillStatus';
import { api } from '../api';
import { db } from '../db/db';
import { useBackgroundSync } from '../hooks/useBackgroundSync';

export function BulkInputPage() {
  const { jenis, id } = useParams(); // e.g. jenis='kamar', id='1'
  const [jadwalId] = useState<number>(1); // Dummy fallback, ideally fetched
  const [tanggal] = useState<string>(new Date().toISOString().split('T')[0]);

  const { syncState, syncData, isSaved } = useBackgroundSync();

  // 1. Fetch Santri list
  const { data: santriList, isLoading } = useQuery({
    queryKey: ['santri', jenis, id],
    queryFn: async () => {
      // Map jenis URL to API parameter
      let filterKey = '';
      if (jenis === 'kamar') filterKey = 'kamar_id';
      else if (jenis === 'sekolah') filterKey = 'kelas_formal_id';
      else if (jenis === 'pbs') filterKey = 'kelompok_pbs_id';
      else if (jenis === 'pbm') filterKey = 'kelompok_pbm_id';
      else if (jenis === 'diniyah') filterKey = 'kelompok_madin_id';
      
      const res = await api.get(`/api/santri?${filterKey}=${id}`);
      return res.data as { santri_id: number, nama: string, nis: string }[];
    }
  });

  // 2. Fetch pending changes from offline queue
  const offlineQueue = useLiveQuery(
    () => db.offlineQueue.where({ jenis_kegiatan: jenis || '', jadwal_id: jadwalId, tanggal }).toArray(),
    [jenis, jadwalId, tanggal]
  ) || [];

  const handleChangeStatus = async (santri_id: number, newStatus: StatusAbsensi) => {
    // Optimistic update directly to IndexedDB
    const existing = await db.offlineQueue
      .where({ santri_id, jenis_kegiatan: jenis || '', jadwal_id: jadwalId, tanggal })
      .first();

    if (existing) {
      await db.offlineQueue.update(existing.id!, { status: newStatus, sync_status: 'pending' });
    } else {
      await db.offlineQueue.add({
        santri_id,
        jenis_kegiatan: jenis || '',
        jadwal_id: jadwalId,
        tanggal,
        status: newStatus,
        sync_status: 'pending'
      });
    }
    
    // Simulate sync attempt immediately if online
    if (navigator.onLine) {
      syncData();
    }
  };

  const handleLongPress = (santri_id: number) => {
    alert(`Long press Santri ID: ${santri_id}. Form detail keterlambatan/keterangan akan muncul disini.`);
  };

  if (isLoading) return <div>Memuat data santri...</div>;

  return (
    <div className="app-container">
      <header className="header">
        <div>
          <h1 className="ui-text-title">Absensi {jenis?.toUpperCase()}</h1>
          <p className="ui-text-body" style={{ color: 'var(--tinta-pudar)' }}>
            Tanggal: {tanggal}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => syncData()}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--aksen)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            className="ui-text-body"
          >
            Simpan absensi
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <IndikatorSinkron state={syncState} />
          </div>
        </div>
      </header>

      <div 
        style={{ 
          display: 'flex', 
          padding: '8px 16px',
          position: 'sticky', 
          top: '73px', 
          backgroundColor: 'var(--kertas-kartu)',
          borderBottom: '1px solid var(--garis)',
          zIndex: 9
        }}
      >
        <div className="ui-text-label" style={{ width: '40px', color: 'var(--tinta-pudar)' }}>No</div>
        <div className="ui-text-label" style={{ flex: 1, color: 'var(--tinta-pudar)' }}>Nama Santri</div>
        <div className="ui-text-label" style={{ textAlign: 'center', width: '80px', color: 'var(--tinta-pudar)' }}>Status</div>
      </div>

      <div className="ledger-container">
        {santriList?.map((item, index) => {
          // Merge with offline data
          const pendingItem = offlineQueue.find(q => q.santri_id === item.santri_id);
          const currentStatus = pendingItem ? pendingItem.status : 'Hadir'; // Default 'Hadir' if no server data yet

          return (
            <div key={item.santri_id} style={{
              transition: 'background-color 300ms',
              backgroundColor: isSaved && pendingItem?.sync_status !== 'pending' ? 'rgba(63, 125, 69, 0.2)' : 'transparent' // Kedip hijau tipis
            }}>
              <BarisLedger
                nomorUrut={index + 1}
                nama={item.nama}
                nis={item.nis}
                status={currentStatus}
                isEven={index % 2 !== 0} 
                onChangeStatus={(newStatus) => handleChangeStatus(item.santri_id, newStatus)}
                onLongPressStatus={() => handleLongPress(item.santri_id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
