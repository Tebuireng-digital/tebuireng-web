import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { usePageMeta } from '../hooks/usePageMeta';

interface PerizinanRecord {
  perizinan_id: number;
  santri_id: number;
  nama_santri: string;
  nis: string | null;
  keperluan: string;
  status: 'Disetujui' | 'Sedang Berjalan' | 'Selesai' | 'Dibatalkan' | 'Kadaluarsa';
  tanggal_mulai: string;
  rencana_kembali: string;
  waktu_keluar_aktual?: string | null;
  waktu_masuk_aktual?: string | null;
}

function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="pagination-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, paddingTop: 14, borderTop: '1px solid #E2E8F0', flexWrap: 'wrap', gap: 12 }}>
      <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>
        Menampilkan {startItem}–{endItem} dari {totalItems} data
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          className="secondary-button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          style={{ padding: '6px 12px', fontSize: 12, minHeight: 32 }}
        >
          &laquo; Sblm
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', padding: '0 8px' }}>
          Halaman {currentPage} dari {totalPages}
        </span>
        <button
          type="button"
          className="secondary-button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          style={{ padding: '6px 12px', fontSize: 12, minHeight: 32 }}
        >
          Slnjt &raquo;
        </button>
      </div>
    </div>
  );
}

export function PerizinanListPage() {
  usePageMeta({
    title: 'Daftar Perizinan Santri',
    description: 'Daftar riwayat dan status perizinan santri (Aktif, Selesai, Kadaluarsa, Dibatalkan) Pondok Pesantren Tebuireng.',
  });

  const { user } = useAuth();
  const [perizinan, setPerizinan] = useState<PerizinanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Pagination State (10 rows max per page)
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const fetchPerizinan = async () => {
    try {
      const response = await api.get('/api/perizinan');
      setPerizinan(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat data perizinan.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (perizinanId: number, namaSantri: string) => {
    setDownloadingId(perizinanId);
    setDownloadMessage(null);
    try {
      const response = await api.get(`/api/perizinan/${perizinanId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Surat_Izin_${namaSantri.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setDownloadMessage({ text: `PDF surat izin ${namaSantri} berhasil diunduh.`, type: 'success' });
    } catch (error) {
      console.error('Gagal mengunduh PDF:', error);
      setDownloadMessage({ text: 'PDF gagal diunduh. Periksa koneksi lalu coba lagi.', type: 'error' });
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    fetchPerizinan();
  }, []);

  const filteredPerizinan = useMemo(() => {
    const q = search.trim().toLowerCase();
    return perizinan.filter(item => {
      const matchSearch = !q || [item.nama_santri, item.nis ?? '', item.keperluan]
        .some(val => val.toLowerCase().includes(q));
      const matchStatus = !statusFilter || item.status.toLowerCase() === statusFilter.toLowerCase();
      const waktuMulai = new Date(item.tanggal_mulai.replace(' ', 'T')).getTime();
      const matchStart = !startDate || waktuMulai >= new Date(`${startDate}T00:00:00`).getTime();
      const matchEnd = !endDate || waktuMulai <= new Date(`${endDate}T23:59:59`).getTime();
      return matchSearch && matchStatus && matchStart && matchEnd;
    });
  }, [perizinan, search, statusFilter, startDate, endDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, startDate, endDate]);

  const totalPages = Math.ceil(filteredPerizinan.length / ITEMS_PER_PAGE) || 1;
  const paginatedPerizinan = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPerizinan.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPerizinan, currentPage]);

  const activeCount = useMemo(() => perizinan.filter(p => ['disetujui', 'sedang berjalan'].includes(p.status.toLowerCase())).length, [perizinan]);
  const finishedCount = useMemo(() => perizinan.filter(p => p.status.toLowerCase() === 'selesai').length, [perizinan]);

  if (loading) return <PageSkeleton />;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div className="permit-list-page">
      <header className="dashboard-header" style={{ marginBottom: 24 }}>
        <div>
          <span className="page-eyebrow">Rekap Perizinan</span>
          <h1>Daftar Perizinan Santri</h1>
          <p>Seluruh riwayat dan status perizinan santri (Aktif, Selesai, Kadaluarsa, Dibatalkan).</p>
        </div>
      </header>

      {downloadMessage && <div className={downloadMessage.type === 'success' ? 'success-box' : 'error-box'} role="status">{downloadMessage.text}</div>}

      {/* Stats Summary Cards */}
      <div className="dashboard-grid-premium" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-card-value">{perizinan.length}</span>
          <span className="stat-card-label">Total Permohonan</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-value" style={{ color: '#0284c7' }}>{activeCount}</span>
          <span className="stat-card-label">Izin Aktif / Berjalan</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-value" style={{ color: '#10b981' }}>{finishedCount}</span>
          <span className="stat-card-label">Selesai (Sudah Kembali)</span>
        </div>
        {['Admin', 'Keamanan'].includes(user?.jabatan ?? '') && (
          <Link to="/catat-gerbang" className="stat-card stat-card-cta">
            <span className="stat-card-cta-icon">+</span>
            <span className="stat-card-cta-text">Catat Izin Baru</span>
          </Link>
        )}
      </div>

      <section className="master-section">
        {/* Search & Filter Controls */}
        <div className="account-table-controls">
          <div className="account-search-control">
            <label htmlFor="search-perizinan">Pencarian Santri / Keperluan</label>
            <input
              id="search-perizinan"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama santri, NIS, keperluan..."
            />
          </div>
          <div>
            <label htmlFor="filter-status-perizinan">Filter Status</label>
            <select
              id="filter-status-perizinan"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">Semua Status</option>
              <option value="Disetujui">Disetujui (Belum Keluar)</option>
              <option value="Sedang Berjalan">Sedang Berjalan (Di Luar)</option>
              <option value="Selesai">Selesai (Sudah Kembali)</option>
              <option value="Kadaluarsa">Kadaluarsa</option>
              <option value="Dibatalkan">Dibatalkan</option>
            </select>
          </div>
          <div>
            <label htmlFor="filter-dari-izin">Mulai Izin Dari</label>
            <input
              type="date"
              id="filter-dari-izin"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="filter-sampai-izin">Mulai Izin Sampai</label>
            <input
              type="date"
              id="filter-sampai-izin"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <p className="account-result-count">
          Menampilkan {filteredPerizinan.length} dari {perizinan.length} perizinan santri.
        </p>

        {/* Data Table */}
        <div className="table-scroll">
          <table className="master-table">
            <thead>
              <tr>
                <th>No</th>
                <th>NIS</th>
                <th>Nama Santri</th>
                <th>Keperluan</th>
                <th>Mulai Izin</th>
                <th>Rencana Kembali</th>
                <th>Waktu Real Keluar/Kembali</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPerizinan.map((item, idx) => {
                const st = item.status.toLowerCase();
                const isAktif = st === 'sedang berjalan' || st === 'disetujui';
                const isSelesai = st === 'selesai';
                const isKadaluarsa = st === 'kadaluarsa';

                const badgeColor = isAktif ? '#0284c7' : isSelesai ? '#10b981' : isKadaluarsa ? '#ef4444' : '#64748b';
                const badgeBg = isAktif ? '#e0f2fe' : isSelesai ? '#ecfdf5' : isKadaluarsa ? '#fef2f2' : '#f1f5f9';
                const rowNum = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;

                return (
                  <tr key={item.perizinan_id}>
                    <td>{rowNum}</td>
                    <td>{item.nis || <small style={{ color: '#888' }}>—</small>}</td>
                    <td><strong>{item.nama_santri}</strong></td>
                    <td>{item.keperluan}</td>
                    <td>{item.tanggal_mulai}</td>
                    <td>{item.rencana_kembali}</td>
                    <td>
                      <small style={{ color: '#475569', display: 'block' }}>
                        Keluar: {item.waktu_keluar_aktual || '—'}
                      </small>
                      <small style={{ color: '#475569', display: 'block' }}>
                        Kembali: {item.waktu_masuk_aktual || '—'}
                      </small>
                    </td>
                    <td>
                      <span style={{
                        padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        color: badgeColor, backgroundColor: badgeBg
                      }}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="download-pdf-btn"
                        onClick={() => handleDownloadPdf(item.perizinan_id, item.nama_santri)}
                        disabled={downloadingId === item.perizinan_id}
                        aria-label={`Unduh PDF surat izin ${item.nama_santri}`}
                      >
                        {downloadingId === item.perizinan_id ? 'Mengunduh…' : 'Unduh PDF'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredPerizinan.length === 0 && (
            <div className="empty-state">Belum ada perizinan yang sesuai dengan filter pencarian.</div>
          )}
        </div>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredPerizinan.length}
          pageSize={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </section>
    </div>
  );
}
