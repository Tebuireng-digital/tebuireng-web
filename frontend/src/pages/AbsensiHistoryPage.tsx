import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { usePageMeta } from '../hooks/usePageMeta';

interface AttendanceRecord {
  absensi_id: number;
  tanggal: string;
  jenis_kegiatan: string;
  nama_kegiatan: string;
  nama_jadwal: string;
  santri_id: number;
  nama_santri: string;
  unit?: string | null;
  kamar?: string | null;
  status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpha' | 'Terlambat';
  menit_terlambat?: number | null;
  keterangan?: string | null;
  waktu_input: string;
}

const statusOptions = ['Hadir', 'Izin', 'Sakit', 'Alpha', 'Terlambat'] as const;

export function AbsensiHistoryPage() {
  const { user } = useAuth();
  usePageMeta({ title: 'Histori Absensi', description: 'Histori absensi sesuai penugasan aktif petugas SIMANTEB.' });
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ santri: '', jenis: '', status: '', dari: '', sampai: '' });
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [message, setMessage] = useState('');
  const query = useQuery<AttendanceRecord[]>({ queryKey: ['absensi-history', filters, user?.petugas_id], queryFn: async () => (await api.get('/api/absensi', { params: filters })).data, enabled: Boolean(user) });
  const update = useMutation({
    mutationFn: (payload: { id: number; status: string; menit_terlambat: number | null; keterangan: string }) => api.patch(`/api/absensi/${payload.id}`, payload),
    onSuccess: () => { setEditing(null); setMessage('Perubahan absensi tersimpan dan tercatat di audit.'); queryClient.invalidateQueries({ queryKey: ['absensi-history'] }); },
    onError: (error: { response?: { data?: { message?: string } } }) => setMessage(error.response?.data?.message ?? 'Perubahan belum tersimpan. Periksa jendela edit atau penugasan Anda.'),
  });
  const records = query.data ?? [];
  const resultLabel = useMemo(() => `${records.length} catatan${records.length === 500 ? ' (dibatasi 500 terbaru)' : ''}`, [records.length]);

  return <section className="page-shell attendance-history-page">
    <header className="page-heading"><div><p className="eyebrow">AUDIT OPERASIONAL</p><h1>Histori Absensi</h1><p>Menampilkan catatan dalam scope penugasan Anda. Data di luar scope tidak ikut terbaca.</p></div></header>
    {message && <div className="alert success" role="status">{message}</div>}
    <section className="panel history-filter-panel"><div className="history-filter-grid"><label>Nama santri<input value={filters.santri} onChange={event => setFilters({ ...filters, santri: event.target.value })} placeholder="Cari nama"/></label><label>Jenis<select value={filters.jenis} onChange={event => setFilters({ ...filters, jenis: event.target.value })}><option value="">Semua jenis</option><option value="SEKOLAH">Kelas formal</option><option value="KAMAR">Kamar</option><option value="PBS">PBS</option><option value="PBM">PBM</option><option value="DINIYAH">Madin</option></select></label><label>Status<select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}><option value="">Semua status</option>{statusOptions.map(status => <option key={status}>{status}</option>)}</select></label><label>Dari<input type="date" value={filters.dari} onChange={event => setFilters({ ...filters, dari: event.target.value })}/></label><label>Sampai<input type="date" value={filters.sampai} onChange={event => setFilters({ ...filters, sampai: event.target.value })}/></label></div><p className="history-result-count">{query.isLoading ? 'Memuat histori…' : resultLabel}</p></section>
    <section className="panel history-table-panel">{query.isError ? <div className="empty-state">Histori belum dapat dimuat. Periksa koneksi dan penugasan aktif.</div> : records.length === 0 && !query.isLoading ? <div className="empty-state">Belum ada catatan yang sesuai filter dan penugasan Anda.</div> : <div className="table-scroll"><table className="master-table history-table"><thead><tr><th>Tanggal</th><th>Santri</th><th>Kegiatan</th><th>Jadwal</th><th>Status</th><th>Waktu input</th><th>Aksi</th></tr></thead><tbody>{records.map(record => <tr key={record.absensi_id}><td>{record.tanggal}</td><td><strong>{record.nama_santri}</strong><small>{record.kamar || record.unit || 'Penempatan belum tersedia'}</small></td><td>{record.nama_kegiatan}</td><td>{record.nama_jadwal}</td><td><span className={`history-status history-status-${record.status.toLowerCase()}`}>{record.status}</span></td><td>{new Date(record.waktu_input).toLocaleString('id-ID')}</td><td><button className="secondary-button" onClick={() => setEditing(record)}>Detail / edit</button></td></tr>)}</tbody></table></div>}</section>
    {editing && <div className="modal-backdrop" role="presentation"><div className="modal-card history-edit-modal" role="dialog" aria-modal="true" aria-labelledby="history-edit-title"><div className="modal-header"><div><p className="eyebrow">Koreksi terukur</p><h2 id="history-edit-title">Edit absensi {editing.nama_santri}</h2><p>{editing.tanggal} · {editing.nama_kegiatan} · {editing.nama_jadwal}</p></div><button className="modal-close" onClick={() => setEditing(null)} aria-label="Tutup edit">×</button></div><label>Status<select value={editing.status} onChange={event => setEditing({ ...editing, status: event.target.value as AttendanceRecord['status'] })}>{statusOptions.map(status => <option key={status}>{status}</option>)}</select></label>{editing.status === 'Terlambat' && <label>Menit terlambat<input type="number" min="0" value={editing.menit_terlambat ?? 0} onChange={event => setEditing({ ...editing, menit_terlambat: Number(event.target.value) })}/></label>}<label>Keterangan<textarea value={editing.keterangan ?? ''} onChange={event => setEditing({ ...editing, keterangan: event.target.value })}/></label><div className="modal-actions"><button className="secondary-button" onClick={() => setEditing(null)}>Batal</button><button className="primary-button" disabled={update.isPending} onClick={() => update.mutate({ id: editing.absensi_id, status: editing.status, menit_terlambat: editing.status === 'Terlambat' ? editing.menit_terlambat ?? null : null, keterangan: editing.keterangan ?? '' })}>{update.isPending ? 'Menyimpan…' : 'Simpan koreksi'}</button></div></div></div>}
  </section>;
}
