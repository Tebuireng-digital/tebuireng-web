import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { AppDropdown } from '../components/AppDropdown';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { usePageMeta } from '../hooks/usePageMeta';

interface RoomSummary {
  kamar_id: number;
  nama_kamar: string;
  pembina_nama: string;
  santri_count: number;
  active_instruments_count: number;
  completed_santri_count: number;
  total_expected_scores: number;
  filled_scores_count: number;
  percentage: number;
  status: 'draft' | 'dikunci' | 'belum_mulai';
  is_locked: boolean;
  dikunci_pada?: string | null;
}

const BULAN_NAMA = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const nowJakarta = () => {
  const d = new Date();
  const jkt = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  return { bulan: jkt.getMonth() + 1, tahun: jkt.getFullYear() };
};

const getSemester = (bulan: number): 'Ganjil' | 'Genap' => (bulan >= 7 ? 'Ganjil' : 'Genap');

export function UbudiyahLandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { bulan: initBulan, tahun: initTahun } = nowJakarta();

  const [bulan, setBulan] = useState(initBulan);
  const [tahun, setTahun] = useState(initTahun);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'dikunci' | 'belum_mulai'>('all');

  usePageMeta({
    title: 'Raport Pembinaan Santri',
    description: 'Pusat manajemen dan pengisian Raport Pembinaan asrama santri Pondok Pesantren Tebuireng.',
  });

  const { data: rooms = [], isLoading, error, refetch } = useQuery<RoomSummary[]>({
    queryKey: ['ubudiyah-kamar-summary', bulan, tahun, user?.petugas_id],
    queryFn: async () => (await api.get('/api/ubudiyah/kamar-summary', { params: { bulan, tahun } })).data,
    enabled: !!user,
  });

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchSearch = room.nama_kamar.toLowerCase().includes(search.toLowerCase()) ||
                          room.pembina_nama.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' ? true : room.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rooms, search, statusFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalRooms = rooms.length;
    const totalSantri = rooms.reduce((acc, r) => acc + r.santri_count, 0);
    const lockedCount = rooms.filter(r => r.is_locked).length;
    const draftCount = rooms.filter(r => r.status === 'draft').length;
    const unstartedCount = rooms.filter(r => r.status === 'belum_mulai').length;

    const totalExpectedScores = rooms.reduce((acc, r) => acc + r.total_expected_scores, 0);
    const totalFilledScores = rooms.reduce((acc, r) => acc + r.filled_scores_count, 0);
    const overallPercentage = totalExpectedScores > 0 ? Math.round((totalFilledScores / totalExpectedScores) * 100) : 0;

    return {
      totalRooms,
      totalSantri,
      lockedCount,
      draftCount,
      unstartedCount,
      totalExpectedScores,
      totalFilledScores,
      overallPercentage,
    };
  }, [rooms]);

  const firstDraft = useMemo(() => rooms.find(r => r.status === 'draft'), [rooms]);

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="ubudiyah-hub-page" style={{ paddingBottom: '40px', background: 'transparent' }}>
      {/* =========================================================
          HERO SECTION (MIRIP DAFTAR PELANGGARAN)
         ========================================================= */}
      <header className="pelanggaran-module-hero" style={{ marginBottom: '24px' }}>
        <div className="pelanggaran-module-hero-main">
          <span className="pelanggaran-hero-eyebrow">RAPORT &amp; PEMBINAAN ASRAMA</span>
          <h1 className="pelanggaran-module-hero-title">Raport Pembinaan Santri</h1>
          <p className="pelanggaran-module-hero-desc">
            Monitoring kelengkapan evaluasi ibadah yaumiyah, adab santri, serta input raport pembinaan kamar santri.
          </p>

          <div className="pelanggaran-hero-meta">
            <span className="pelanggaran-pill pelanggaran-pill-petugas">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              {user?.nama || 'Petugas'} ({user?.jabatan || 'Pembina Kamar'})
            </span>

            <span className="pelanggaran-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              {user?.jabatan === 'Admin' ? `${rooms.length} Kamar Terdaftar` : `${rooms.length} Kamar Ditugaskan`}
            </span>

            <span className="pelanggaran-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Periode: {BULAN_NAMA[bulan]} {tahun} ({getSemester(bulan)})
            </span>
          </div>
        </div>

        <div className="dashboard-mosque-dark" aria-hidden="true"></div>
      </header>

      {/* =========================================================
          INDIKATOR PROGRES PENGISIAN TOTAL (HORIZONTAL PROGRESS BAR)
         ========================================================= */}
      <div
        className="ubudiyah-progress-strip"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          marginBottom: '16px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
              Progres Pengisian Total
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: stats.overallPercentage === 100 ? '#dcfce7' : '#f1f5f9',
                color: stats.overallPercentage === 100 ? '#166534' : '#475569',
              }}
            >
              {stats.lockedCount} dari {stats.totalRooms} Kamar Terkunci
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: stats.overallPercentage === 100 ? '#166534' : '#0f172a',
              }}
            >
              {stats.overallPercentage}%
            </span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              ({stats.totalFilledScores}/{stats.totalExpectedScores} entri nilai)
            </span>
          </div>
        </div>

        {/* Progress Bar Track */}
        <div
          role="progressbar"
          aria-valuenow={stats.overallPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#e2e8f0',
            borderRadius: '9999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${stats.overallPercentage}%`,
              height: '100%',
              backgroundColor: stats.overallPercentage === 100 ? '#16a34a' : '#0d6e4f',
              borderRadius: '9999px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '8px',
            fontSize: '12px',
            color: '#64748b',
          }}
        >
          <span>{stats.totalSantri} santri aktif dalam binaan</span>
          <span>
            {stats.unstartedCount > 0
              ? `${stats.unstartedCount} kamar belum dimulai`
              : 'Semua kamar telah dimulai'}
          </span>
        </div>
      </div>

      {/* =========================================================
          ACTIONABLE SNACKBAR / NOTICE UNTUK DRAFT SEDANG DIISI
         ========================================================= */}
      {stats.draftCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            padding: '12px 18px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#fef3c7',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e' }}>
                Ada {stats.draftCount} kamar dengan draft pengisian yang belum selesai / belum dikunci
              </div>
              <div style={{ fontSize: '12px', color: '#b45309' }}>
                {firstDraft
                  ? `Draft terdekat: ${firstDraft.nama_kamar} (${firstDraft.percentage}% terisi)`
                  : 'Lengkapi seluruh nilai sebelum mengunci raport.'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {firstDraft && (
              <button
                type="button"
                style={{
                  backgroundColor: '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() =>
                  navigate(`/ubudiyah/input?kamar=${firstDraft.kamar_id}&bulan=${bulan}&tahun=${tahun}`)
                }
              >
                <span>Lanjutkan Isi {firstDraft.nama_kamar}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}

            {statusFilter !== 'draft' ? (
              <button
                type="button"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#78350f',
                  border: '1px solid #fcd34d',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
                onClick={() => setStatusFilter('draft')}
              >
                Filter Draft ({stats.draftCount})
              </button>
            ) : (
              <button
                type="button"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
                onClick={() => setStatusFilter('all')}
              >
                Tampilkan Semua Status
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          FILTER & PERIODE SELECTOR
         ========================================================= */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          backgroundColor: '#ffffff',
          padding: '16px 20px',
          borderRadius: '16px',
          border: '1px solid #cbd5e1',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: '1 1 300px' }}>
          <div style={{ minWidth: '160px' }}>
            <AppDropdown
              id="hub-filter-bulan"
              label="Bulan Laporan"
              value={String(bulan)}
              options={BULAN_NAMA.slice(1).map((nama, index) => ({ value: String(index + 1), label: nama }))}
              onChange={val => setBulan(Number(val))}
            />
          </div>

          <div style={{ minWidth: '120px' }}>
            <AppDropdown
              id="hub-filter-tahun"
              label="Tahun"
              value={String(tahun)}
              options={Array.from({ length: 5 }, (_, i) => {
                const year = initTahun - 2 + i;
                return { value: String(year), label: String(year) };
              })}
              onChange={val => setTahun(Number(val))}
            />
          </div>

          <div style={{ minWidth: '150px' }}>
            <AppDropdown
              id="hub-filter-status"
              label="Status Raport"
              value={statusFilter}
              options={[
                { value: 'all', label: 'Semua Status' },
                { value: 'draft', label: 'Draft (Dalam Proses)' },
                { value: 'dikunci', label: 'Terkunci (Final)' },
                { value: 'belum_mulai', label: 'Belum Dimulai' },
              ]}
              onChange={val => setStatusFilter(val as any)}
            />
          </div>
        </div>

        <div style={{ flex: '1 1 240px', maxWidth: '350px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label htmlFor="hub-search-kamar" style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
              Cari Kamar
            </label>
            <span style={{ fontSize: '11.5px', color: '#1e293b', fontWeight: 500 }}>
              Menampilkan <strong style={{ color: '#0f172a', fontWeight: 800 }}>{filteredRooms.length}</strong> dari {rooms.length}
            </span>
          </div>
          <input
            id="hub-search-kamar"
            type="text"
            className="matrix-note-input"
            style={{ width: '100%', fontWeight: 500 }}
            placeholder="Ketik nama kamar atau pembina..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="error-box" role="alert" style={{ marginBottom: '20px' }}>
          Gagal memuat data ringkasan kamar pembinaan.
          <button type="button" className="secondary-button" onClick={() => void refetch()}>Coba lagi</button>
        </div>
      )}

      {/* =========================================================
          DAFTAR KARTU KAMAR (ROOM CARDS GRID)
         ========================================================= */}
      {filteredRooms.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 20px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
          {rooms.length === 0
            ? 'Tidak ada kamar yang ditugaskan kepada akun Anda. Hubungi Admin bila penugasan belum aktif.'
            : 'Tidak ada kamar yang sesuai dengan kriteria pencarian atau filter status.'}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '12px',
          }}
        >
          {filteredRooms.map(room => {
            const isComplete = room.percentage === 100 && room.filled_scores_count > 0;
            const isLocked = room.is_locked;
            const isDraft = !isLocked && !isComplete && (room.status === 'draft' || room.filled_scores_count > 0 || room.percentage > 0);

            return (
              <div
                key={room.kamar_id}
                className="stat-card ubudiyah-room-card"
                style={{
                  borderRadius: '12px',
                  border: isLocked || isComplete ? '1px solid #a7f3d0' : isDraft ? '1px solid #fde68a' : '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'space-between',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  cursor: 'pointer',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                onClick={() => navigate(`/ubudiyah/input?kamar=${room.kamar_id}&bulan=${bulan}&tahun=${tahun}`)}
              >
                <div style={{ width: '100%', boxSizing: 'border-box' }}>
                  {/* Card Header: Nama Kamar & Badge Status */}
                  {/* Card Header: Nama Kamar & Status Pill (Row 1) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px', width: '100%' }}>
                    <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {room.nama_kamar}
                    </h2>

                    {/* Status Pill (Dinamis) */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        backgroundColor: isLocked ? '#ecfdf5' : isComplete ? '#dcfce7' : isDraft ? '#fef3c7' : '#dc2626',
                        color: isLocked ? '#065f46' : isComplete ? '#15803d' : isDraft ? '#92400e' : '#ffffff',
                        border: isLocked ? '1px solid #a7f3d0' : isComplete ? '1px solid #86efac' : isDraft ? '1px solid #fde68a' : 'none',
                      }}
                    >
                      {isLocked ? (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                          </svg>
                          Terkunci (Final)
                        </>
                      ) : isComplete ? (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          Lengkap (100%)
                        </>
                      ) : isDraft ? (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                          </svg>
                          Draft ({room.percentage}%)
                        </>
                      ) : (
                        'Belum Diisi'
                      )}
                    </span>
                  </div>

                  <div style={{ color: '#334155', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Pembina: <span style={{ color: '#0f172a', fontWeight: 700 }}>{room.pembina_nama}</span>
                  </div>

                  {/* Room Meta (Santri count & Aspek) */}
                  <div style={{ display: 'flex', gap: '10px', fontSize: '12.5px', color: '#1e293b', fontWeight: 500, marginTop: '8px', marginBottom: '10px' }}>
                    <span>
                      Santri: <strong style={{ color: '#0f172a', fontWeight: 800 }}>{room.santri_count} anak</strong>
                    </span>
                    <span style={{ color: '#94a3b8' }}>•</span>
                    <span>
                      Lengkap: <strong style={{ color: '#0f172a', fontWeight: 800 }}>{room.completed_santri_count}/{room.santri_count}</strong>
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginTop: '6px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                      <span style={{ color: '#1e293b', fontWeight: 700 }}>Kemajuan Nilai:</span>
                      <strong style={{ color: isLocked || isComplete ? '#059669' : '#0f172a', fontWeight: 800 }}>
                        {room.percentage}%
                      </strong>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '7px',
                        backgroundColor: '#e2e8f0',
                        borderRadius: '999px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${room.percentage}%`,
                          height: '100%',
                          backgroundColor: isLocked ? '#059669' : isComplete ? '#10b981' : isDraft ? '#f59e0b' : '#cbd5e1',
                          borderRadius: '999px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    paddingTop: '12px',
                    borderTop: '1px solid #f1f5f9',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#2563eb')}
                    onClick={() => navigate(`/ubudiyah/lihat?kamar=${room.kamar_id}&bulan=${bulan}&tahun=${tahun}`)}
                  >
                    Lihat Raport
                  </button>

                  <button
                    type="button"
                    style={{
                      width: '100%',
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '8px 8px',
                      borderRadius: '6px',
                      border: 'none',
                      color: '#ffffff',
                      textAlign: 'center',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      backgroundColor: isLocked ? '#059669' : '#16a34a',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = isLocked ? '#047857' : '#15803d')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = isLocked ? '#059669' : '#16a34a')}
                    onClick={() => navigate(`/ubudiyah/input?kamar=${room.kamar_id}&bulan=${bulan}&tahun=${tahun}`)}
                  >
                    {isLocked ? 'Tinjau Nilai' : isDraft ? 'Lanjutkan Isi' : 'Mulai Isi Nilai'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default UbudiyahLandingPage;
