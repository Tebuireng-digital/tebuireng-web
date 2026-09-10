import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
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
  keterangan?: string | null;
  catatan?: string | null;
  tindakan_sanksi?: string | null;
  petugas_pencatat_id?: number;
  can_edit?: boolean;
  is_locked?: boolean;
  diubah_oleh_petugas_id?: number | null;
  alasan_koreksi?: string | null;
  waktu_koreksi?: string | null;
  jumlah_koreksi?: number;
}

interface KategoriMasterOption {
  kategori_pelanggaran_id: number;
  kode_pasal: string;
  kategori: string;
  uraian_pelanggaran: string;
  poin_maks: number;
  status_aktif: string;
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
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [pelanggaran, setPelanggaran] = useState<PelanggaranRecord[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriMasterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const selectedSantriId = searchParams.get('santri_id');

  // Modal Koreksi state
  const [editingRecord, setEditingRecord] = useState<PelanggaranRecord | null>(null);
  const [editTanggal, setEditTanggal] = useState('');
  const [editKategoriId, setEditKategoriId] = useState<number>(0);
  const [editKeterangan, setEditKeterangan] = useState('');
  const [editAlasan, setEditAlasan] = useState('');
  const [isSubmittingKoreksi, setIsSubmittingKoreksi] = useState(false);
  const [koreksiError, setKoreksiError] = useState('');

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast]);

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

  const fetchKategoriMaster = async () => {
    try {
      const response = await api.get('/api/pelanggaran/kategori?all=1');
      let data: KategoriMasterOption[] = response.data;
      if (user?.jabatan === 'Keamanan') {
        data = data.filter(item => ['sedang', 'berat'].includes(item.kategori?.toLowerCase().trim()));
      } else if (user?.jabatan === 'Pembina Kamar') {
        data = data.filter(item => item.kategori?.toLowerCase().trim() === 'ringan');
      }
      setKategoriList(data);
    } catch (err) {
      console.error('Gagal memuat master kategori:', err);
    }
  };

  useEffect(() => {
    fetchPelanggaran();
    fetchKategoriMaster();
  }, [selectedSantriId, user]);

  const filteredPelanggaran = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pelanggaran.filter(item => {
      const matchSearch = !q || [item.nama_santri, item.uraian_pelanggaran, item.keterangan ?? '', item.catatan ?? '', item.tindakan_sanksi ?? '']
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

  // Statistik ringkasan poin
  const totalPoin = useMemo(() => {
    return filteredPelanggaran.reduce((sum, item) => sum + (item.poin ?? item.poin_maks ?? 0), 0);
  }, [filteredPelanggaran]);

  const levelSummary = useMemo(() => {
    return ['Ringan', 'Sedang', 'Berat'].map(level => {
      const records = filteredPelanggaran.filter(item => item.kategori?.toLowerCase() === level.toLowerCase());
      return {
        level,
        count: records.length,
        points: records.reduce((sum, item) => sum + (item.poin ?? item.poin_maks ?? 0), 0),
      };
    });
  }, [filteredPelanggaran]);

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

  // Handler buka modal koreksi
  const handleOpenKoreksi = (record: PelanggaranRecord) => {
    setEditingRecord(record);
    setEditTanggal(record.tanggal);
    setEditKategoriId(record.kategori_pelanggaran_id);
    setEditKeterangan(record.keterangan || '');
    setEditAlasan('');
    setKoreksiError('');
  };

  const handleCloseKoreksi = () => {
    setEditingRecord(null);
    setKoreksiError('');
    setIsSubmittingKoreksi(false);
  };

  // Handler simpan koreksi
  const handleSubmitKoreksi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    if (!editAlasan.trim() || editAlasan.trim().length < 5) {
      setKoreksiError('Alasan koreksi wajib diisi minimal 5 karakter untuk audit kedisiplinan.');
      return;
    }

    setIsSubmittingKoreksi(true);
    setKoreksiError('');

    try {
      const payload = {
        santri_id: editingRecord.santri_id,
        kategori_pelanggaran_id: editKategoriId,
        tanggal: editTanggal,
        keterangan: editKeterangan.trim() || null,
        alasan_koreksi: editAlasan.trim(),
      };

      const response = await api.patch(`/api/pelanggaran/${editingRecord.pelanggaran_id}`, payload);
      const updatedData = response.data.data;

      // Update state lokal
      setPelanggaran(prev => prev.map(item => {
        if (item.pelanggaran_id === editingRecord.pelanggaran_id) {
          return {
            ...item,
            ...updatedData,
          };
        }
        return item;
      }));

      handleCloseKoreksi();
      setToast({
        message: 'Perubahan data berhasil dikoreksi',
        type: 'success',
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.alasan_koreksi?.[0] || 'Gagal menyimpan koreksi data pelanggaran.';
      setKoreksiError(msg);
    } finally {
      setIsSubmittingKoreksi(false);
    }
  };

  if (loading) return <PageSkeleton />;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div className="pelanggaran-list-page">
      {/* Toast Notifikasi Kanan Atas */}
      {toast && (
        <aside
          role="status"
          aria-live="polite"
          className={`toast-notification-top-right${toast.type === 'error' ? ' toast-error' : ''}`}
        >
          <div className="toast-notification-content">
            <span className="toast-icon-check" aria-hidden="true">
              {toast.type === 'error' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
            </span>
            <span className="toast-text">{toast.message}</span>
          </div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
          >
            ✕
          </button>
        </aside>
      )}

      {/* TAMPILAN 1: MODE DETAIL SANTRI (BEBAS AI SLOP) */}
      {selectedSantriId ? (
        <>
          <div className="santri-detail-breadcrumb">
            <Link to="/pelanggaran/semua" className="santri-back-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Kembali ke Semua Pelanggaran</span>
            </Link>
          </div>

          <header className="santri-detail-header-card">
            <div className="santri-detail-profile">
              <div className="santri-detail-avatar" aria-hidden="true">
                {(santriName || 'S').slice(0, 2).toUpperCase()}
              </div>
              <div className="santri-detail-info">
                <h1>{santriName || 'Detail Pelanggaran Santri'}</h1>
                <div className="santri-detail-meta">
                  <span>ID Santri: #{selectedSantriId}</span>
                  <span>•</span>
                  <span>{filteredPelanggaran.length} Catatan Kejadian</span>
                  <span>•</span>
                  <span>T.A. 2026/2027</span>
                </div>
              </div>
            </div>
          </header>

          {/* Compact Stats Bar (Menggantikan 6 kotak AI Slop) */}
          <div className="santri-detail-stats-bar" aria-label="Ringkasan poin santri">
            <div className="santri-stats-item">
              <span>Total Akumulasi:</span>
              <strong style={{ fontSize: 14, color: totalPoin >= 50 ? '#dc2626' : totalPoin >= 20 ? '#d97706' : '#2563eb' }}>
                {totalPoin} Poin
              </strong>
              <span style={{ color: '#64748b' }}>({filteredPelanggaran.length} catatan)</span>
            </div>
            <div className="santri-stats-divider" aria-hidden="true"></div>
            {levelSummary.map(item => (
              <div key={item.level} className="santri-stats-item">
                <span>{item.level}:</span>
                <strong>{item.points} poin</strong>
                <span style={{ color: '#64748b' }}>({item.count}x)</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* TAMPILAN 2: MODE UMUM SEMUA SANTRI */
        <>
          <header className="pelanggaran-module-hero">
            <div className="pelanggaran-module-hero-main">
              <span className="pelanggaran-hero-eyebrow">KEDISIPLINAN & TATA TERTIB</span>
              <h1 className="pelanggaran-module-hero-title">Daftar Pelanggaran Santri</h1>
              <p className="pelanggaran-module-hero-desc">
                Riwayat dan catatan pelanggaran santri Pondok Pesantren Tebuireng.
              </p>
              <div className="pelanggaran-hero-meta">
                <span className="pelanggaran-pill pelanggaran-pill-petugas">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  Petugas: {user?.nama || 'Petugas'}
                </span>
                <span className="pelanggaran-pill">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  {filteredPelanggaran.length} Catatan Riwayat
                </span>
                <span className="pelanggaran-pill">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  T.A. 2026/2027
                </span>
              </div>
            </div>

            <div className="pelanggaran-module-hero-actions">
              {['Admin', 'Keamanan'].includes(user?.jabatan ?? '') && (
                <Link to="/pelanggaran/master" className="pelanggaran-hero-btn secondary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2"/>
                    <line x1="8" y1="10" x2="16" y2="10"/>
                    <line x1="8" y1="14" x2="12" y2="14"/>
                  </svg>
                  <span>Master Pelanggaran</span>
                </Link>
              )}
              <Link to="/pelanggaran/baru" className="pelanggaran-hero-btn primary">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span>Input Pelanggaran</span>
              </Link>
            </div>
            <div className="dashboard-mosque-dark" aria-hidden="true"></div>
          </header>

          {/* Monthly insight cards hanya saat mode semua santri */}
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
          </div>
        </>
      )}

      {/* SECTION TABEL & KONTROL */}
      <section className="master-section">
        <div className="account-table-controls">
          <div className="account-search-control">
            <label htmlFor="search-pelanggaran">Pencarian</label>
            <input
              id="search-pelanggaran"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari uraian, catatan, tanggal..."
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

        {/* Tabel Data Pelanggaran */}
        <div className="table-scroll">
          <table className="master-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal</th>
                {!selectedSantriId && <th>Nama Santri</th>}
                <th>Kategori</th>
                <th>Uraian Pelanggaran</th>
                <th>Poin</th>
                <th>Catatan / Tindakan</th>
                <th>Riwayat Koreksi</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPelanggaran.map((item, idx) => {
                const isBerat = item.kategori?.toLowerCase() === 'berat';
                const isSedang = item.kategori?.toLowerCase() === 'sedang';
                const badgeColor = isBerat ? '#dc2626' : isSedang ? '#d97706' : '#2563eb';
                const badgeBg = isBerat ? '#fef2f2' : isSedang ? '#fffbeb' : '#eff6ff';

                return (
                  <tr key={item.pelanggaran_id}>
                    <td>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                    <td><strong>{item.tanggal}</strong></td>
                    {!selectedSantriId && (
                      <td><strong>{item.nama_santri}</strong></td>
                    )}
                    <td>
                      <span style={{
                        padding: '3px 8px', borderRadius: 5, fontSize: 12, fontWeight: 700,
                        color: badgeColor, backgroundColor: badgeBg
                      }}>
                        {item.kategori || 'Ringan'}
                      </span>
                    </td>
                    <td>{item.uraian_pelanggaran}</td>
                    <td>
                      <strong style={{ color: badgeColor, fontSize: 14 }}>
                        +{item.poin ?? item.poin_maks}
                      </strong>
                    </td>
                    <td>{item.keterangan || item.catatan || item.tindakan_sanksi || '—'}</td>
                    <td>
                      {item.jumlah_koreksi && item.jumlah_koreksi > 0 ? (
                        <span
                          className="violation-koreksi-badge"
                          title={`Koreksi: ${item.alasan_koreksi || 'Tanpa keterangan'} (${item.waktu_koreksi || 'waktu tercatat'})`}
                        >
                          Diedit ({item.jumlah_koreksi}x)
                        </span>
                      ) : (
                        <span style={{ color: 'var(--tinta-pudar)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td>
                      <div className="table-action-group">
                        {!selectedSantriId && (
                          <Link
                            to={`/pelanggaran/semua?santri_id=${item.santri_id}`}
                            className="table-detail-link"
                            title={`Lihat detail ${item.nama_santri}`}
                          >
                            Detail
                          </Link>
                        )}
                        {item.can_edit && (
                          <button
                            type="button"
                            className="btn-table-koreksi"
                            onClick={() => handleOpenKoreksi(item)}
                            title="Koreksi data pelanggaran ini"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Koreksi
                          </button>
                        )}
                        {item.is_locked && !item.can_edit && (
                          <span
                            className="badge-locked-table"
                            title="Data terkunci: telah melewati batas waktu 24 jam sejak pencatatan. Hubungi Admin untuk koreksi."
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            Terkunci
                          </span>
                        )}
                        {!item.can_edit && !item.is_locked && selectedSantriId && (
                          <span style={{ color: 'var(--tinta-pudar)', fontSize: 13 }}>—</span>
                        )}
                      </div>
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

      {/* MODAL KOREKSI PELANGGARAN */}
      {editingRecord && (
        <div
          className="koreksi-modal-backdrop"
          onClick={handleCloseKoreksi}
          role="dialog"
          aria-modal="true"
          aria-labelledby="koreksi-modal-title"
        >
          <div
            className="koreksi-modal-card"
            onClick={e => e.stopPropagation()}
          >
            <div className="koreksi-modal-header">
              <div>
                <h2 id="koreksi-modal-title">Koreksi Data Pelanggaran</h2>
                <p>Santri: <strong>{editingRecord.nama_santri}</strong> (ID #{editingRecord.santri_id})</p>
              </div>
              <button
                type="button"
                className="koreksi-modal-close"
                onClick={handleCloseKoreksi}
                aria-label="Tutup form koreksi"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitKoreksi}>
              <div className="koreksi-modal-body">
                {user?.jabatan === 'Admin' ? (
                  <div className="koreksi-modal-notice admin-notice">
                    <strong>Mode Admin:</strong> Anda memiliki hak mengoreksi data kapan saja. Wajib menyertakan alasan koreksi untuk pencatatan audit.
                  </div>
                ) : (
                  <div className="koreksi-modal-notice">
                    <strong>Ketentuan Keamanan:</strong> Koreksi mandiri diizinkan maksimal 24 jam sejak pencatatan. Perubahan dicatat secara transparan dalam log audit kedisiplinan.
                  </div>
                )}

                {koreksiError && (
                  <div className="koreksi-form-error">{koreksiError}</div>
                )}

                <div className="koreksi-form-group">
                  <label htmlFor="koreksi-tanggal">Tanggal Pelanggaran</label>
                  <input
                    type="date"
                    id="koreksi-tanggal"
                    value={editTanggal}
                    onChange={e => setEditTanggal(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                <div className="koreksi-form-group">
                  <label htmlFor="koreksi-kategori">Kategori & Pasal Pelanggaran</label>
                  <select
                    id="koreksi-kategori"
                    value={editKategoriId}
                    onChange={e => setEditKategoriId(Number(e.target.value))}
                    required
                  >
                    {kategoriList.map(kat => (
                      <option key={kat.kategori_pelanggaran_id} value={kat.kategori_pelanggaran_id}>
                        [{kat.kategori}] {kat.kode_pasal ? `${kat.kode_pasal} - ` : ''}{kat.uraian_pelanggaran} (+{kat.poin_maks} poin)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="koreksi-form-group">
                  <label htmlFor="koreksi-keterangan">Keterangan Tambahan / Kronologi (Opsional)</label>
                  <textarea
                    id="koreksi-keterangan"
                    rows={3}
                    value={editKeterangan}
                    onChange={e => setEditKeterangan(e.target.value)}
                    placeholder="Keterangan atau kronologi kejadian..."
                  />
                </div>

                <div className="koreksi-form-group">
                  <label htmlFor="koreksi-alasan">
                    Alasan Koreksi <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <textarea
                    id="koreksi-alasan"
                    rows={2}
                    value={editAlasan}
                    onChange={e => setEditAlasan(e.target.value)}
                    placeholder="Contoh: Salah pilih kategori pasal saat input malam, koreksi saksi, pembaruan data"
                    required
                  />
                  <small>Minimal 5 karakter. Alasan ini akan tercatat dalam log audit sistem.</small>
                </div>
              </div>

              <div className="koreksi-modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCloseKoreksi}
                  disabled={isSubmittingKoreksi}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSubmittingKoreksi}
                  style={{ minWidth: 120 }}
                >
                  {isSubmittingKoreksi ? 'Menyimpan...' : 'Simpan Koreksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
