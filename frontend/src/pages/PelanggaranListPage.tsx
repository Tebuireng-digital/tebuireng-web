import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { AppDropdown } from '../components/AppDropdown';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { usePageMeta } from '../hooks/usePageMeta';

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

const getMonthKey = (dateValue: string) => dateValue.slice(0, 7);
const ITEMS_PER_PAGE = 10;
type PaginationItem = number | 'ellipsis';

const getPaginationItems = (current: number, total: number): PaginationItem[] => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, 6, 'ellipsis', total];
  if (current >= total - 3) return [1, 'ellipsis', total - 5, total - 4, total - 3, total - 2, total - 1, total];
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
};

function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination-controls">
      <button
        type="button"
        className="secondary-button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      >
        ← Sebelumnya
      </button>
      <div className="pagination-pages" aria-label="Pilih halaman daftar pelanggaran">
        {getPaginationItems(currentPage, totalPages).map((item, index) => item === 'ellipsis' ? (
          <span className="pagination-ellipsis" key={`ellipsis-${index}`} aria-hidden="true">…</span>
        ) : (
          <button
            type="button"
            className={`pagination-page${currentPage === item ? ' active' : ''}`}
            aria-label={`Halaman ${item}`}
            aria-current={currentPage === item ? 'page' : undefined}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="secondary-button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
      >
        Berikutnya →
      </button>
    </div>
  );
}

export function PelanggaranListPage() {
  const [searchParams] = useSearchParams();
  const [pelanggaran, setPelanggaran] = useState<PelanggaranRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const selectedSantriId = searchParams.get('santri_id');

  const santriName = pelanggaran[0]?.nama_santri;
  usePageMeta({
    title: selectedSantriId && santriName ? `Detail Pelanggaran ${santriName}` : 'Daftar Pelanggaran Santri',
    description: selectedSantriId && santriName
      ? `Riwayat dan akumulasi poin pelanggaran santri ${santriName} Pondok Pesantren Tebuireng.`
      : 'Riwayat dan catatan pelanggaran santri yang telah diinputkan oleh petugas Pondok Pesantren Tebuireng.',
  });

  const fetchPelanggaran = async () => {
    setLoading(true);
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

  const totalPages = Math.ceil(filteredPelanggaran.length / ITEMS_PER_PAGE);
  const paginatedPelanggaran = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPelanggaran.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredPelanggaran, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, kategoriFilter, startDate, endDate, selectedSantriId]);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const levelSummary = useMemo(() => ['Ringan', 'Sedang', 'Berat'].map(level => {
    const records = filteredPelanggaran.filter(item => item.kategori?.toLowerCase() === level.toLowerCase());
    return {
      level,
      count: records.length,
      points: records.reduce((sum, item) => sum + (item.poin || item.poin_maks || 0), 0),
    };
  }), [filteredPelanggaran]);
  const currentDate = new Date();
  const currentMonthLabel = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(currentDate);
  const currentMonthKey = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0');
  const monthlyInsights = useMemo(() => {
    const currentMonthRecords = pelanggaran.filter(record => getMonthKey(record.tanggal) === currentMonthKey);
    const santriCounts = new Map<number, { name: string; count: number }>();
    const violationCounts = new Map<string, number>();

    currentMonthRecords.forEach(record => {
      const existingSantri = santriCounts.get(record.santri_id);
      santriCounts.set(record.santri_id, {
        name: existingSantri?.name || record.nama_santri,
        count: (existingSantri?.count || 0) + 1,
      });

      const violationName = record.uraian_pelanggaran || 'Uraian tidak tercatat';
      violationCounts.set(violationName, (violationCounts.get(violationName) || 0) + 1);
    });

    const topSantri = [...santriCounts.values()]
      .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name))[0] || null;
    const topViolation = [...violationCounts.entries()]
      .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))[0] || null;

    return {
      santriCount: santriCounts.size,
      topSantri,
      topViolation: topViolation ? { name: topViolation[0], count: topViolation[1] } : null,
    };
  }, [pelanggaran, currentMonthKey]);

  if (loading) return <PageSkeleton />;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div className="pelanggaran-list-page">
      <header className="dashboard-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <span className="page-eyebrow">Rekap Santri</span>
            <h1>{selectedSantriId && santriName ? `Detail Santri ${santriName}` : 'Daftar Pelanggaran Santri'}</h1>
            <p>{selectedSantriId ? 'Riwayat pelanggaran santri.' : 'Riwayat dan catatan pelanggaran santri Pondok Pesantren Tebuireng.'}</p>
          </div>
        </div>
      </header>

      <>
          {/* Monthly insight cards */}
          <div className="violation-summary-row">
            <div className="dashboard-grid-premium violation-summary-cards violation-monthly-summary">
              <div className="stat-card violation-insight-card">
                <span className="stat-card-label">Santri melakukan pelanggaran</span>
                <strong className="stat-card-value">{monthlyInsights.santriCount}</strong>
                <small className="stat-card-context">{currentMonthLabel}</small>
              </div>
              <div className="stat-card violation-insight-card">
                <span className="stat-card-label">Santri dengan catatan terbanyak</span>
                <strong className="stat-card-value stat-card-value-text">
                  {monthlyInsights.topSantri?.name || 'Belum ada data'}
                </strong>
                <small className="stat-card-context">
                  {monthlyInsights.topSantri ? monthlyInsights.topSantri.count + ' catatan · ' + currentMonthLabel : currentMonthLabel}
                </small>
              </div>
              <div className="stat-card violation-insight-card">
                <span className="stat-card-label">Pelanggaran paling sering</span>
                <strong className="stat-card-value stat-card-value-text">
                  {monthlyInsights.topViolation?.name || 'Belum ada data'}
                </strong>
                <small className="stat-card-context">
                  {monthlyInsights.topViolation ? monthlyInsights.topViolation.count + ' catatan · ' + currentMonthLabel : currentMonthLabel}
                </small>
              </div>
            </div>
            <Link to="/pelanggaran/baru" className="primary-button violation-add-button">
              + Input Pelanggaran
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
              <AppDropdown
                id="filter-kategori"
                label="Kategori"
                value={kategoriFilter}
                onChange={setKategoriFilter}
                placeholder="Semua Kategori"
                options={[
                  { value: '', label: 'Semua Kategori' },
                  { value: 'Ringan', label: 'Ringan' },
                  { value: 'Sedang', label: 'Sedang' },
                  { value: 'Berat', label: 'Berat' },
                ]}
              />
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
                  {paginatedPelanggaran.map((item, idx) => {
                    const isBerat = item.kategori?.toLowerCase() === 'berat';
                    const isSedang = item.kategori?.toLowerCase() === 'sedang';
                    const badgeColor = isBerat ? '#ef4444' : isSedang ? '#f59e0b' : '#3b82f6';
                    const badgeBg = isBerat ? '#fef2f2' : isSedang ? '#fffbeb' : '#eff6ff';

                    return (
                      <tr key={item.pelanggaran_id}>
                        <td>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
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
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </section>
        </>
    </div>
  );
}
