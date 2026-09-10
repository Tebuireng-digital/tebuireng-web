import { useEffect, useMemo, useState } from 'react';
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
  usePageMeta({
    title: 'Histori & Rekap Absensi',
    description: 'Catatan histori dan rekap absensi santri sesuai penugasan aktif petugas SIMANTEB.',
  });

  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ santri: '', jenis: '', status: '', dari: '', sampai: '' });
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const query = useQuery<AttendanceRecord[]>({
    queryKey: ['absensi-history', filters, user?.petugas_id],
    queryFn: async () => (await api.get('/api/absensi', { params: filters })).data,
    enabled: Boolean(user),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; status: string; menit_terlambat: number | null; keterangan: string }) =>
      api.patch(`/api/absensi/${payload.id}`, payload),
    onSuccess: () => {
      setEditing(null);
      setToast({ text: 'Perubahan absensi tersimpan dan tercatat di audit.', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['absensi-history'] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) =>
      setToast({
        text: error.response?.data?.message ?? 'Perubahan belum tersimpan. Periksa batas waktu edit atau penugasan Anda.',
        type: 'error',
      }),
  });

  const records = query.data ?? [];
  const resultLabel = useMemo(
    () => `${records.length} catatan${records.length === 500 ? ' (dibatasi 500 terbaru)' : ''}`,
    [records.length],
  );

  const hasActiveFilters = Boolean(filters.santri || filters.jenis || filters.status || filters.dari || filters.sampai);

  const resetFilters = () => {
    setFilters({ santri: '', jenis: '', status: '', dari: '', sampai: '' });
  };

  return (
    <section className="page-shell attendance-history-page">
      {/* Toast Notifikasi Floating Pojok Kanan Atas */}
      {toast && (
        <div
          className={`toast-notification-top-right${toast.type === 'error' ? ' toast-error' : ''}`}
          role="status"
          aria-live="polite"
        >
          <div className="toast-notification-content">
            <span className="toast-icon-check" aria-hidden="true">
              {toast.type === 'error' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
            <span className="toast-text">{toast.text}</span>
          </div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <header className="page-heading">
        <div>
          <p className="eyebrow">AUDIT OPERASIONAL</p>
          <h1>Histori &amp; Rekap Absensi</h1>
          <p>Menampilkan catatan absensi santri dalam lingkup penugasan Anda. Data di luar penugasan otomatis tidak ditampilkan.</p>
        </div>
      </header>

      {/* FILTER PANEL */}
      <section className="panel history-filter-panel">
        <div className="history-filter-grid">
          <label>
            Nama santri
            <input
              value={filters.santri}
              onChange={event => setFilters({ ...filters, santri: event.target.value })}
              placeholder="Cari nama santri..."
            />
          </label>
          <label>
            Jenis kegiatan
            <select
              value={filters.jenis}
              onChange={event => setFilters({ ...filters, jenis: event.target.value })}
            >
              <option value="">Semua jenis</option>
              <option value="SEKOLAH">Kelas formal</option>
              <option value="KAMAR">Kamar</option>
              <option value="PBS">Al-Qur'an Subuh (PBS)</option>
              <option value="PBM">Takhasus Maghrib (PBM)</option>
              <option value="DINIYAH">Madin</option>
            </select>
          </label>
          <label>
            Status
            <select
              value={filters.status}
              onChange={event => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="">Semua status</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dari
            <input
              type="date"
              value={filters.dari}
              onChange={event => setFilters({ ...filters, dari: event.target.value })}
            />
          </label>
          <label>
            Sampai
            <input
              type="date"
              value={filters.sampai}
              onChange={event => setFilters({ ...filters, sampai: event.target.value })}
            />
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <p className="history-result-count" style={{ margin: 0 }}>
            {query.isLoading ? 'Memuat catatan…' : resultLabel}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              style={{
                border: 0,
                background: 'transparent',
                color: '#0f6e56',
                fontWeight: 600,
                fontSize: 12.5,
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              ✕ Reset Filter
            </button>
          )}
        </div>
      </section>

      {/* UNIFIED MASTER TABLE */}
      <section className="panel history-table-panel">
        {query.isError ? (
          <div className="empty-state">Data absensi belum dapat dimuat. Periksa koneksi dan penugasan aktif.</div>
        ) : records.length === 0 && !query.isLoading ? (
          <div className="empty-state">Belum ada catatan yang sesuai filter dan penugasan Anda.</div>
        ) : (
          <div className="table-scroll">
            <table className="master-table history-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Santri</th>
                  <th>Kegiatan</th>
                  <th>Jadwal</th>
                  <th>Status</th>
                  <th>Keterangan / Jam</th>
                  <th>Waktu Input</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {records.map(record => (
                  <tr key={record.absensi_id}>
                    <td>{record.tanggal}</td>
                    <td>
                      <strong>{record.nama_santri}</strong>
                      <small>{record.kamar || record.unit || 'Penempatan belum tersedia'}</small>
                    </td>
                    <td>{record.nama_kegiatan}</td>
                    <td>{record.nama_jadwal}</td>
                    <td>
                      <span className={`history-status history-status-${record.status.toLowerCase()}`}>
                        {record.status}
                      </span>
                    </td>
                    <td>
                      {record.status === 'Terlambat' && record.menit_terlambat ? (
                        <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600, display: 'block' }}>
                          Terlambat {record.menit_terlambat} mnt
                        </span>
                      ) : null}
                      {record.keterangan ? (
                        <span style={{ fontSize: 12, color: '#64748b', display: 'block' }}>
                          {record.keterangan}
                        </span>
                      ) : null}
                      {!record.keterangan && (!record.status || record.status !== 'Terlambat') && (
                        <span style={{ color: '#cbd5e1' }}>—</span>
                      )}
                    </td>
                    <td>{new Date(record.waktu_input).toLocaleString('id-ID')}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setEditing(record)}
                        style={{ padding: '6px 12px', fontSize: 12 }}
                      >
                        Koreksi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* EDIT / KOREKSI MODAL */}
      {editing && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card history-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-edit-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Koreksi terukur</p>
                <h2 id="history-edit-title">Edit absensi {editing.nama_santri}</h2>
                <p>
                  {editing.tanggal} · {editing.nama_kegiatan} · {editing.nama_jadwal}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setEditing(null)}
                aria-label="Tutup edit"
              >
                ×
              </button>
            </div>

            <label>
              Status
              <select
                value={editing.status}
                onChange={event =>
                  setEditing({ ...editing, status: event.target.value as AttendanceRecord['status'] })
                }
              >
                {statusOptions.map(status => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            {editing.status === 'Terlambat' && (
              <label>
                Menit terlambat
                <input
                  type="number"
                  min="0"
                  value={editing.menit_terlambat ?? 0}
                  onChange={event =>
                    setEditing({ ...editing, menit_terlambat: Number(event.target.value) })
                  }
                />
              </label>
            )}

            <label>
              Keterangan
              <textarea
                value={editing.keterangan ?? ''}
                onChange={event => setEditing({ ...editing, keterangan: event.target.value })}
                placeholder="Alasan koreksi status atau catatan..."
              />
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEditing(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    id: editing.absensi_id,
                    status: editing.status,
                    menit_terlambat: editing.status === 'Terlambat' ? editing.menit_terlambat ?? null : null,
                    keterangan: editing.keterangan ?? '',
                  })
                }
              >
                {updateMutation.isPending ? 'Menyimpan…' : 'Simpan koreksi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
