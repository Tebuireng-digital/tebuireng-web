import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { StatusAbsensi } from '../components/PillStatus';
import { usePageMeta } from '../hooks/usePageMeta';

interface TargetKelas { target_id: number; nama_target: string }
interface JadwalKelas { jadwal_id: number; nama_jadwal: string }
interface OpsiSekolah { jenis: string; targets: TargetKelas[]; jadwal: JadwalKelas[] }
interface BarisRekap { santri_id: number; nis: string | null; nama: string; status: StatusAbsensi | null }
interface SesiRekap {
  target: { nama_target: string; nama_penanggung_jawab: string | null };
  jadwal: JadwalKelas;
  santri: BarisRekap[];
}

const todayJakarta = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const statuses: Array<StatusAbsensi | 'Belum diisi'> = ['Hadir', 'Izin', 'Sakit', 'Alpha', 'Terlambat', 'Belum diisi'];

export function RekapKelasPage() {
  usePageMeta({
    title: 'Rekap Kelas Formal',
    description: 'Pantau rekap kehadiran harian santri untuk kelas formal penugasan wali kelas Pondok Pesantren Tebuireng.',
  });

  const [searchParams] = useSearchParams();
  const [targetId, setTargetId] = useState(Number(searchParams.get('kelas')) || 0);
  const [tanggal, setTanggal] = useState(searchParams.get('tanggal') || todayJakarta());

  const optionsQuery = useQuery<OpsiSekolah[]>({
    queryKey: ['absensi-options-rekap-kelas'],
    queryFn: async () => (await api.get('/api/absensi-options')).data,
  });
  const sekolah = optionsQuery.data?.find(item => item.jenis === 'sekolah');
  const jadwalId = Number(searchParams.get('jadwal')) || sekolah?.jadwal[0]?.jadwal_id || 0;

  useEffect(() => {
    if (sekolah?.targets.length && !sekolah.targets.some(target => target.target_id === targetId)) {
      setTargetId(sekolah.targets[0].target_id);
    }
  }, [sekolah, targetId]);

  const sessionQuery = useQuery<SesiRekap>({
    queryKey: ['rekap-kelas', targetId, jadwalId, tanggal],
    enabled: Boolean(targetId && jadwalId),
    queryFn: async () => (await api.get('/api/absensi/sekolah/session', {
      params: { target_id: targetId, jadwal_id: jadwalId, tanggal },
    })).data,
  });

  const totals = useMemo(() => {
    const result = Object.fromEntries(statuses.map(status => [status, 0])) as Record<string, number>;
    for (const santri of sessionQuery.data?.santri ?? []) {
      result[santri.status ?? 'Belum diisi'] += 1;
    }
    return result;
  }, [sessionQuery.data]);

  if (optionsQuery.isLoading) return <div className="empty-state">Memuat kelas yang ditugaskan...</div>;
  if (!sekolah?.targets.length) return <div className="empty-state">Belum ada kelas formal yang ditugaskan kepada akun ini.</div>;

  return (
    <section className="rekap-page">
      <header className="dashboard-header">
        <div>
          <span className="page-eyebrow">Absensi kelas</span>
          <h1>Rekap Kelas</h1>
          <p>Pantau hasil absensi harian hanya untuk kelas yang menjadi tanggung jawab Anda.</p>
        </div>
      </header>

      <div className="rekap-filters">
        <div><label>Kelas</label><select value={targetId} onChange={event => setTargetId(Number(event.target.value))}>{sekolah.targets.map(target => <option key={target.target_id} value={target.target_id}>{target.nama_target}</option>)}</select></div>
        <div><label>Tanggal</label><input type="date" value={tanggal} onChange={event => setTanggal(event.target.value)} /></div>
      </div>

      {sessionQuery.isLoading && <div className="empty-state">Memuat rekap absensi...</div>}
      {sessionQuery.error && <div className="error-box">Rekap kelas gagal dimuat. Periksa koneksi lalu coba kembali.</div>}

      {sessionQuery.data && <>
        <div className="rekap-heading">
          <div><h2>{sessionQuery.data.target.nama_target}</h2><p>{sessionQuery.data.jadwal.nama_jadwal}{sessionQuery.data.target.nama_penanggung_jawab ? ` · ${sessionQuery.data.target.nama_penanggung_jawab}` : ''}</p></div>
          <strong>{sessionQuery.data.santri.length} santri</strong>
        </div>

        <div className="rekap-summary">
          {statuses.map(status => <div className={`rekap-summary-card ${status.toLowerCase().replaceAll(' ', '-')}`} key={status}><strong>{totals[status]}</strong><span>{status}</span></div>)}
        </div>

        <div className="table-scroll"><table className="master-table rekap-table">
          <thead><tr><th>No</th><th>Nama santri</th><th>Status</th></tr></thead>
          <tbody>{sessionQuery.data.santri.map((santri, index) => <tr key={santri.santri_id}><td>{index + 1}</td><td><strong>{santri.nama}</strong><small>{santri.nis || 'NIS belum tersedia'}</small></td><td><span className={`rekap-status ${(santri.status ?? 'belum').toLowerCase()}`}>{santri.status ?? 'Belum diisi'}</span></td></tr>)}</tbody>
        </table></div>
      </>}
    </section>
  );
}
