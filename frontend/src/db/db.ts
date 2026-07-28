import Dexie, { type EntityTable } from 'dexie';
import type { StatusAbsensi } from '../components/PillStatus';

export interface OfflineAbsensi {
  id?: number; // Auto-incremented primary key for offline tracking
  santri_id: number;
  jenis_kegiatan: string; // 'kamar', 'sekolah', etc.
  jadwal_id: number;
  tanggal: string; // YYYY-MM-DD
  status: StatusAbsensi;
  sync_status: 'pending' | 'synced';
}

const db = new Dexie('AbsensiDatabase') as Dexie & {
  offlineQueue: EntityTable<
    OfflineAbsensi,
    'id' 
  >;
};

// Schema declaration:
db.version(1).stores({
  // Unique composite index is not natively easy in Dexie v1 to upsert by.
  // We just keep the primary key 'id' auto-incremented, and create indexes for querying.
  // [santri_id+jenis_kegiatan+jadwal_id+tanggal] could be a compound index if we want.
  offlineQueue: '++id, santri_id, jenis_kegiatan, jadwal_id, tanggal, sync_status, [santri_id+jenis_kegiatan+jadwal_id+tanggal]'
});

export { db };
