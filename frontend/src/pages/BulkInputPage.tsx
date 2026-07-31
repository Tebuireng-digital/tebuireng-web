import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { BarisLedger } from '../components/BarisLedger';
import { IndikatorSinkron } from '../components/IndikatorSinkron';
import type { StatusAbsensi } from '../components/PillStatus';
import { db, type OfflineAbsensi } from '../db/db';
import { useBackgroundSync } from '../hooks/useBackgroundSync';

interface SantriAbsensi {
  santri_id: number;
  nis: string | null;
  nama: string;
  status: StatusAbsensi | null;
  menit_terlambat: number | null;
  keterangan: string | null;
}

interface SesiAbsensi {
  nama_kegiatan: string;
  target: { target_id: number; nama_target: string };
  jadwal: { jadwal_id: number; nama_jadwal: string; jam_mulai: string; jam_selesai: string };
  tanggal: string;
  santri: SantriAbsensi[];
}

const todayJakarta = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

export function BulkInputPage() {
  const { jenis = '', id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const jadwalId = Number(searchParams.get('jadwal'));
  const targetId = Number(id);
  const [tanggal, setTanggal] = useState(todayJakarta);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { syncState, syncData, isSaved } = useBackgroundSync(user!.petugas_id);

  const sessionQuery = useQuery<SesiAbsensi>({
    queryKey: ['absensi-session', jenis, targetId, jadwalId, tanggal],
    enabled: Boolean(jenis && targetId && jadwalId),
    queryFn: async () => (await api.get(`/api/absensi/${jenis}/session`, {
      params: { target_id: targetId, jadwal_id: jadwalId, tanggal },
    })).data,
  });

  const pendingItems = useLiveQuery(
    () => db.offlineQueue
      .where('petugas_id')
      .equals(user!.petugas_id)
      .and(item => item.jenis_kegiatan === jenis
        && item.target_id === targetId
        && item.jadwal_id === jadwalId
        && item.tanggal === tanggal
        && item.sync_status === 'pending')
      .toArray(),
    [user!.petugas_id, jenis, targetId, jadwalId, tanggal],
    [],
  );

  const pendingBySantri = new Map(pendingItems.map(item => [item.santri_id, item]));

  const savePending = async (
    santri: SantriAbsensi,
    status: StatusAbsensi,
    detail?: { menit_terlambat?: number | null; keterangan?: string | null },
  ) => {
    const key: [number, number, string, number, number, string] = [
      user!.petugas_id,
      santri.santri_id,
      jenis,
      targetId,
      jadwalId,
      tanggal,
    ];
    const existing = await db.offlineQueue
      .where('[petugas_id+santri_id+jenis_kegiatan+target_id+jadwal_id+tanggal]')
      .equals(key)
      .first();

    const values: Omit<OfflineAbsensi, 'id'> = {
      petugas_id: user!.petugas_id,
      santri_id: santri.santri_id,
      jenis_kegiatan: jenis,
      target_id: targetId,
      jadwal_id: jadwalId,
      tanggal,
      status,
      menit_terlambat: status === 'Terlambat' ? (detail?.menit_terlambat ?? existing?.menit_terlambat ?? null) : null,
      keterangan: detail?.keterangan ?? existing?.keterangan ?? santri.keterangan ?? null,
      sync_status: 'pending',
    };

    if (existing?.id !== undefined) {
      await db.offlineQueue.update(existing.id, values);
    } else {
      await db.offlineQueue.add(values);
    }
  };

  const handleLongPress = async (santri: SantriAbsensi) => {
    const current = pendingBySantri.get(santri.santri_id);
    const minuteText = window.prompt(
      `Menit keterlambatan ${santri.nama}`,
      String(current?.menit_terlambat ?? santri.menit_terlambat ?? ''),
    );
    if (minuteText === null) return;

    const minutes = Number(minuteText);
    if (!Number.isInteger(minutes) || minutes < 0) {
      window.alert('Menit keterlambatan harus berupa angka nol atau lebih.');
      return;
    }
    const note = window.prompt('Keterangan tambahan (opsional)', current?.keterangan ?? santri.keterangan ?? '');
    if (note === null) return;
    await savePending(santri, 'Terlambat', { menit_terlambat: minutes, keterangan: note || null });
  };

  const handleSave = async () => {
    if (!sessionQuery.data) return;
    await db.transaction('rw', db.offlineQueue, async () => {
      const latestPending = await db.offlineQueue
        .where('petugas_id')
        .equals(user!.petugas_id)
        .and(item => item.jenis_kegiatan === jenis
          && item.target_id === targetId
          && item.jadwal_id === jadwalId
          && item.tanggal === tanggal
          && item.sync_status === 'pending')
        .toArray();
      const queuedSantri = new Set(latestPending.map(item => item.santri_id));
      for (const santri of sessionQuery.data!.santri) {
        if (!queuedSantri.has(santri.santri_id)) {
          await savePending(santri, santri.status ?? 'Hadir');
        }
      }
    });
    await syncData();
    if (navigator.onLine) {
      await queryClient.invalidateQueries({ queryKey: ['absensi-session', jenis, targetId, jadwalId, tanggal] });
    }
  };

  if (!jadwalId || !targetId) {
    return <div className="error-box">Jadwal atau kelompok tidak valid. Kembali ke Dashboard dan pilih ulang.</div>;
  }
  if (sessionQuery.isLoading) return <div className="empty-state">Memuat daftar santri...</div>;
  if (sessionQuery.error || !sessionQuery.data) {
    return <div className="error-box">Daftar absensi tidak dapat dimuat. Pastikan akun Anda memiliki penugasan.</div>;
  }

  const session = sessionQuery.data;

  return (
    <div className="app-container">
      <header className="header attendance-header">
        <div>
          <Link to="/dashboard" className="back-link">← Dashboard</Link>
          <h1 className="ui-text-title">{session.nama_kegiatan}</h1>
          <p className="ui-text-body">{session.target.nama_target} · {session.jadwal.nama_jadwal}</p>
        </div>
        <div className="attendance-actions">
          <input
            aria-label="Tanggal absensi"
            className="date-input"
            type="date"
            value={tanggal}
            onChange={event => setTanggal(event.target.value)}
          />
          <button className="primary-button" disabled={session.santri.length === 0} onClick={() => void handleSave()}>
            Simpan absensi
          </button>
          <IndikatorSinkron state={syncState} />
        </div>
      </header>

      {syncState === 'offline' && <div className="offline-banner">Belum tersinkron—data aman di HP dan akan dikirim saat koneksi tersedia.</div>}
      {syncState === 'error' && <div className="error-box compact">Sinkronisasi gagal. Tekan “Simpan absensi” untuk mencoba lagi.</div>}

      <div className="ledger-header">
        <div className="ui-text-label" style={{ width: '40px' }}>No</div>
        <div className="ui-text-label" style={{ flex: 1 }}>Nama Santri</div>
        <div className="ui-text-label" style={{ width: '80px', textAlign: 'center' }}>Status</div>
      </div>

      {session.santri.length === 0 ? (
        <div className="empty-state">Belum ada santri pada kelompok ini. Periksa data master atau hasil import.</div>
      ) : (
        <div className="ledger-container">
          {session.santri.map((santri, index) => {
            const pending = pendingBySantri.get(santri.santri_id);
            const currentStatus = pending?.status ?? santri.status ?? 'Hadir';
            return (
              <div className={isSaved ? 'saved-row' : ''} key={santri.santri_id}>
                <BarisLedger
                  nomorUrut={index + 1}
                  nama={santri.nama}
                  nis={santri.nis ?? '—'}
                  status={currentStatus}
                  isEven={index % 2 !== 0}
                  onChangeStatus={status => void savePending(santri, status)}
                  onLongPressStatus={() => void handleLongPress(santri)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
