import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';

interface PelanggaranRecord {
  pelanggaran_id: number;
  santri_id: number;
  nama_santri: string;
  kategori_pelanggaran_id: number;
  uraian_pelanggaran: string;
  kategori: string;
  poin?: number | null;
  poin_maks: number;
  tanggal: string;
  catatan?: string | null;
  tindakan_sanksi?: string | null;
}

export function PelanggaranListPage() {
  const [pelanggaran, setPelanggaran] = useState<PelanggaranRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchParams] = useSearchParams();
  const selectedSantriId = searchParams.get('santri_id');

  const fetchPelanggaran = async () => {
    try {
      const response = await api.get('/api/pelanggaran', {
        params: selectedSantriId ? { santri_id: selectedSantriId } : undefined,
      });
      setPelanggaran(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat data pelanggaran.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPelanggaran();
  }, [selectedSantriId]);

  const filteredPelanggaran = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pelanggaran.filter(item => {
      const matchSearch = !q || [item.nama_santri, item.uraian_pelanggaran, item.catatan ?? '']
        .some(val => val.toLowerCase().includes(q));
      const matchKategori = !kategoriFilter || item.kategori.toLowerCase() === kategoriFilter.toLowerCase();
      const matchStart = !startDate || item.tanggal >= startDate;
      const matchEnd = !endDate || item.tanggal <= endDate;
      return matchSearch && matchKategori && matchStart && matchEnd;
    });
  }, [pelanggaran, search, kategoriFilter, startDate, endDate]);

  const totalPoin = useMemo(() => filteredPelanggaran.reduce((sum, item) => sum + (item.poin || item.poin_maks || 0), 0), [filteredPelanggaran]);
  const santriName = pelanggaran[0]?.nama_santri;
  const levelSummary = useMemo(() => ['Ringan', 'Sedang', 'Berat'].map(level => {
    const records = filteredPelanggaran.filter(item => item.kategori?.toLowerCase() === level.toLowerCase());
    return {
      level,
      count: records.length,
      points: records.reduce((sum, item) => sum + (item.poin || item.poin_maks || 0), 0),
    };
  }), [filteredPelanggaran]);

  if (loading) return <div className="empty-state">Memuat daftar pelanggaran...</div>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div className="pelanggaran-list-page">
      <header className="dashboard-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <span className="page-eyebrow">Rekap Pelanggaran</span>
            <h1>{selectedSantriId && santriName ? `Detail Pelanggaran ${santriName}` : 'Daftar Pelanggaran Santri'}</h1>
            <p>{selectedSantriId ? 'Riwayat pelanggaran santri berdasarkan level dan poin.' : 'Riwayat dan catatan pelanggaran santri yang telah diinputkan oleh petugas.'}</p>
          </div>
        </div>
      </header>

      {/* Stats Summary Cards */}
      <div className="violation-summary-row">
        <div className="dashboard-grid-premium violation-summary-cards">
          <div className="stat-card">
            <span className="stat-card-value">{filteredPelanggaran.length}</span>
            <span className="stat-card-label">Total Catatan</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-value">{totalPoin}</span>
            <span className="stat-card-label">Total Poin Sanksi</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-value">
              {filteredPelanggaran.filter(p => p.kategori?.toLowerCase() === 'berat').length}
            </span>
            <span className="stat-card-label">Pelanggaran Berat</span>
          </div>
        </div>
        <Link to="/pelanggaran/baru" className="primary-button violation-add-button">
          <span aria-hidden="true">＋</span> Input Pelanggaran
        </Link>
      </div>

      {selectedSantriId && (
        <div className="violation-level-summary" aria-label="Ringkasan pelanggaran per level">
          {levelSummary.map(item => (
            <div className={`violation-level-item level-${item.level.toLowerCase()}`} key={item.level}>
              <span className="violation-level-name">{item.level}</span>
              <strong>{item.points} poin</strong>
              <small>{item.count} catatan</small>
            </div>
          ))}
        </div>
      )}

      <section className="master-section">
        {/* Search & Filter Controls */}
        <div className="account-table-controls">
          <div className="account-search-control">
            <label htmlFor="search-pelanggaran">Pencarian</label>
            <input
              id="search-pelanggaran"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama santri, pelanggaran, catatan..."
            />
          </div>
          <div>
            <label htmlFor="filter-kategori">Kategori</label>
            <select
              id="filter-kategori"
              value={kategoriFilter}
              onChange={e => setKategoriFilter(e.target.value)}
            >
              <option value="">Semua Kategori</option>
              <option value="Ringan">Ringan</option>
              <option value="Sedang">Sedang</option>
              <option value="Berat">Berat</option>
            </select>
          </div>
          <div>
            <label htmlFor="filter-dari">Dari Tanggal</label>
            <input
              type="date"
              id="filter-dari"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="filter-sampai">Sampai Tanggal</label>
            <input
              type="date"
              id="filter-sampai"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <p className="account-result-count">
          Menampilkan {filteredPelanggaran.length} dari {pelanggaran.length} rekap pelanggaran.
        </p>

        {selectedSantriId && (
          <Link to="/pelanggaran/semua" className="secondary-button violation-clear-filter" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', marginBottom: 16 }}>
            ← Kembali ke semua pelanggaran
          </Link>
        )}

        {/* Table */}
        <div className="table-scroll">
          <table className="master-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal</th>
                <th>Nama Santri</th>
                <th>Kategori</th>
                <th>Uraian Pelanggaran</th>
                <th>Poin</th>
                <th>Catatan / Tindakan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredPelanggaran.map((item, idx) => {
                const isBerat = item.kategori?.toLowerCase() === 'berat';
                const isSedang = item.kategori?.toLowerCase() === 'sedang';
                const badgeColor = isBerat ? '#ef4444' : isSedang ? '#f59e0b' : '#3b82f6';
                const badgeBg = isBerat ? '#fef2f2' : isSedang ? '#fffbeb' : '#eff6ff';

                return (
                  <tr key={item.pelanggaran_id}>
                    <td>{idx + 1}</td>
                    <td><strong>{item.tanggal}</strong></td>
                    <td><strong>{item.nama_santri}</strong></td>
                    <td>
                      <span style={{
                        padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        color: badgeColor, backgroundColor: badgeBg
                      }}>
                        {item.kategori || 'Ringan'}
                      </span>
                    </td>
                    <td>{item.uraian_pelanggaran}</td>
                    <td>
                      <strong style={{ color: badgeColor, fontSize: 15 }}>
                        +{item.poin || item.poin_maks}
                      </strong>
                    </td>
                    <td>{item.catatan || item.tindakan_sanksi || '—'}</td>
                    <td>
                      <Link
                        to={`/pelanggaran/semua?santri_id=${item.santri_id}`}
                        className="table-detail-link"
                        title={`Lihat semua pelanggaran ${item.nama_santri}`}
                      >
                        Lihat detail
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredPelanggaran.length === 0 && (
            <div className="empty-state">Belum ada rekap pelanggaran yang sesuai dengan pencarian.</div>
          )}
        </div>
      </section>
    </div>
  );
}
