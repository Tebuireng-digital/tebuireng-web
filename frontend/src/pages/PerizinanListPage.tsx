import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

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

export function PerizinanListPage() {
  const [perizinan, setPerizinan] = useState<PerizinanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
    try {
      const response = await api.get(`/api/perizinan/${perizinanId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Surat_Izin_Pulang_${namaSantri.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Gagal mengunduh PDF:', error);
      alert('Gagal mengunduh file PDF.');
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
      const matchStart = !startDate || item.tanggal_mulai >= startDate;
      const matchEnd = !endDate || item.tanggal_mulai <= endDate;
      return matchSearch && matchStatus && matchStart && matchEnd;
    });
  }, [perizinan, search, statusFilter, startDate, endDate]);

  const activeCount = useMemo(() => perizinan.filter(p => ['disetujui', 'sedang berjalan'].includes(p.status.toLowerCase())).length, [perizinan]);
  const finishedCount = useMemo(() => perizinan.filter(p => p.status.toLowerCase() === 'selesai').length, [perizinan]);

  if (loading) return <div className="empty-state">Memuat daftar perizinan...</div>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div className="permit-list-page">
      <header className="dashboard-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <span className="page-eyebrow">Rekap Perizinan</span>
            <h1>Daftar Perizinan Santri</h1>
            <p>Seluruh riwayat dan status perizinan santri (Aktif, Selesai, Kadaluarsa, Dibatalkan).</p>
          </div>
          <Link to="/catat-gerbang" className="primary-button" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>
            + Catat Izin Baru
          </Link>
        </div>
      </header>

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
              {filteredPerizinan.map((item, idx) => {
                const st = item.status.toLowerCase();
                const isAktif = st === 'sedang berjalan' || st === 'disetujui';
                const isSelesai = st === 'selesai';
                const isKadaluarsa = st === 'kadaluarsa';

                const badgeColor = isAktif ? '#0284c7' : isSelesai ? '#10b981' : isKadaluarsa ? '#ef4444' : '#64748b';
                const badgeBg = isAktif ? '#e0f2fe' : isSelesai ? '#ecfdf5' : isKadaluarsa ? '#fef2f2' : '#f1f5f9';

                return (
                  <tr key={item.perizinan_id}>
                    <td>{idx + 1}</td>
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
                        style={{ padding: '4px 8px', borderRadius: '8px', fontSize: '11px' }}
                        onClick={() => handleDownloadPdf(item.perizinan_id, item.nama_santri)}
                      >
                        📄 PDF
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
      </section>
    </div>
  );
}
