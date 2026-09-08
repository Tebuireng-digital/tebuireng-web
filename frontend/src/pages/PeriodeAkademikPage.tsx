import { useState } from 'react';
import type { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { usePageMeta } from '../hooks/usePageMeta';

interface Period {
  periode_id: number;
  tahun_pelajaran: string;
  semester: 'Ganjil' | 'Genap';
  tanggal_mulai: string;
  tanggal_selesai: string;
  status: 'Draft' | 'Aktif' | 'Ditutup';
}
interface ApiError { message?: string }

export function PeriodeAkademikPage() {
  usePageMeta({ title: 'Periode Akademik', description: 'Kelola periode akademik dan histori rollover SIMANTEB.' });
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ tahun_pelajaran: '2026/2027', semester: 'Ganjil', tanggal_mulai: '', tanggal_selesai: '', status: 'Draft' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ periode_id: number; items: Array<{ santri_id: number; nama: string; data_belum_lengkap: string[] }> } | null>(null);
  const periods = useQuery<Period[]>({ queryKey: ['periode-akademik'], queryFn: async () => (await api.get('/api/periode-akademik')).data });
  const create = useMutation({
    mutationFn: () => api.post('/api/periode-akademik', form),
    onSuccess: () => { setMessage('Periode akademik tersimpan.'); setError(''); queryClient.invalidateQueries({ queryKey: ['periode-akademik'] }); },
    onError: (cause: AxiosError<ApiError>) => { setError(cause.response?.data?.message ?? 'Periode belum tersimpan. Periksa tanggal dan tahun pelajaran.'); setMessage(''); },
  });
  const close = useMutation({
    mutationFn: (id: number) => api.post(`/api/periode-akademik/${id}/tutup`, { konfirmasi: true }),
    onSuccess: () => { setMessage('Periode ditutup. Input periode ini sekarang menjadi arsip read-only.'); queryClient.invalidateQueries({ queryKey: ['periode-akademik'] }); },
    onError: (cause: AxiosError<ApiError>) => setError(cause.response?.data?.message ?? 'Periode belum dapat ditutup.'),
  });
  const loadPreview = async (periodId: number) => {
    try { const response = await api.get('/api/kenaikan-kelas/preview', { params: { periode_id: periodId } }); setPreview({ periode_id: periodId, items: response.data.items }); setError(''); } catch (cause) { setError((cause as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Preview kenaikan kelas belum dapat dimuat.'); }
  };
  const applyPreview = async () => {
    if (!preview || !window.confirm('Terapkan assignment periode untuk semua santri pada preview ini?')) return;
    try { await api.post('/api/kenaikan-kelas/terapkan', { periode_id: preview.periode_id, items: preview.items }); setMessage('Assignment periode berhasil diterapkan.'); setError(''); } catch (cause) { setError((cause as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Assignment belum diterapkan.'); }
  };

  return <section className="page-shell period-page">
    <header className="page-heading"><div><p className="eyebrow">KENDALI AKADEMIK</p><h1>Periode Akademik</h1><p>Kelola semester aktif, checklist penutupan, dan arsip histori santri.</p></div></header>
    {(message || error) && <div className={error ? 'alert error' : 'alert success'} role="status">{error || message}</div>}
    <div className="period-layout">
      <form className="panel period-form" onSubmit={event => { event.preventDefault(); create.mutate(); }}>
        <div className="panel-heading"><div><h2>Buat periode</h2><p>Periode baru dimulai sebagai Draft.</p></div></div>
        <label>Tahun pelajaran<input value={form.tahun_pelajaran} onChange={event => setForm({ ...form, tahun_pelajaran: event.target.value })} required /></label>
        <label>Semester<select value={form.semester} onChange={event => setForm({ ...form, semester: event.target.value })}><option>Ganjil</option><option>Genap</option></select></label>
        <label>Status awal<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option>Draft</option><option>Aktif</option></select></label>
        <div className="period-date-grid"><label>Mulai<input type="date" value={form.tanggal_mulai} onChange={event => setForm({ ...form, tanggal_mulai: event.target.value })} required /></label><label>Selesai<input type="date" value={form.tanggal_selesai} onChange={event => setForm({ ...form, tanggal_selesai: event.target.value })} required /></label></div>
        <button className="primary-button" disabled={create.isPending}>{create.isPending ? 'Menyimpan…' : 'Simpan periode'}</button>
      </form>
      <div className="panel"><div className="panel-heading"><div><h2>Daftar periode</h2><p>Hanya satu periode pada tahun pelajaran dan semester yang sama boleh aktif.</p></div></div>
        {periods.isLoading ? <p className="muted">Memuat periode…</p> : periods.data?.length ? <div className="period-list">{periods.data.map(period => <article key={period.periode_id} className="period-row"><div><strong>{period.tahun_pelajaran} · {period.semester}</strong><span>{period.tanggal_mulai} — {period.tanggal_selesai}</span></div><div className="period-actions"><span className={`status status-${period.status.toLowerCase()}`}>{period.status}</span>{period.status !== 'Ditutup' && <><button className="secondary-button" onClick={() => void loadPreview(period.periode_id)}>Preview kenaikan</button><button className="secondary-button" onClick={() => close.mutate(period.periode_id)} disabled={close.isPending}>Tutup periode</button></>}</div></article>)}</div> : <p className="empty-state">Belum ada periode. Buat periode pertama untuk memulai siklus akademik.</p>}
        {preview && <div className="period-preview" role="status"><strong>Preview assignment: {preview.items.length} santri</strong><span>{preview.items.filter(item => item.data_belum_lengkap.length > 0).length} santri masih memiliki data penempatan yang belum lengkap.</span><button className="primary-button" onClick={() => void applyPreview()}>Terapkan assignment</button></div>}
      </div>
    </div>
  </section>;
}
