import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { ContentSkeleton, ValuePulse } from '../components/LoadingSkeleton';

interface TargetAbsensi {
  target_id: number;
  nama_target: string;
  tingkat?: string;
  unit_kode?: string;
  unit_nama?: string;
  kategori_target?: string;
  nomor_target?: string | null;
}

interface JadwalAbsensi {
  jadwal_id: number;
  nama_jadwal: string;
  jam_mulai: string;
  jam_selesai: string;
}

interface OpsiAbsensi {
  jenis: string;
  nama: string;
  sumber: string;
  targets: TargetAbsensi[];
  jadwal: JadwalAbsensi[];
}

interface KelompokTampilan extends OpsiAbsensi {
  displayKey: string;
}
interface DashboardSummary { role: string; perizinan?: { aktif: number; berjalan: number; overdue: number }; notifikasi_belum_dibaca?: number; kamar?: { jumlah: number; headcount: number }; pelanggaran_terbaru?: Array<{ nama: string; tanggal: string; poin: number }> }

const PBS_CATEGORY_ORDER = ['KELOMPOK A', 'KELOMPOK B', 'KELOMPOK C', 'PASCA WISUDA', 'PASCA WISUDA MA', 'BANDONGAN', 'TAHSIN', 'TAHFIDZ', 'SOROGAN'];

const pbsDisplayCategory = (target: TargetAbsensi) => {
  const sourceCategory = (target.kategori_target ?? '').trim().toUpperCase();
  if (sourceCategory && sourceCategory !== 'MASTER_PUTRA' && sourceCategory !== 'LAINNYA') {
    return sourceCategory;
  }

  const name = target.nama_target.trim().toUpperCase();
  for (const category of PBS_CATEGORY_ORDER) {
    if (name.startsWith(category)) return category;
  }

  return sourceCategory || 'LAINNYA';
};

const pbsCategories = (targets: TargetAbsensi[]) => [...new Set(targets.map(pbsDisplayCategory))]
  .sort((left, right) => {
    const leftOrder = PBS_CATEGORY_ORDER.indexOf(left);
    const rightOrder = PBS_CATEGORY_ORDER.indexOf(right);
    if (leftOrder !== -1 || rightOrder !== -1) {
      return (leftOrder === -1 ? Number.MAX_SAFE_INTEGER : leftOrder)
        - (rightOrder === -1 ? Number.MAX_SAFE_INTEGER : rightOrder);
    }
    return left.localeCompare(right, 'id');
  });

const MADIN_JENJANG_ORDER = ['MTS', 'SMP', 'MA', 'SMA', 'SMK'];

const madinDisplayCategory = (target: TargetAbsensi) => {
  const sourceCategory = (target.kategori_target ?? '').trim().toUpperCase();
  if (sourceCategory && sourceCategory !== 'LAINNYA') {
    return sourceCategory;
  }
  const name = target.nama_target.trim().toUpperCase();
  for (const jenjang of MADIN_JENJANG_ORDER) {
    if (name.startsWith(jenjang)) return jenjang;
  }
  return sourceCategory || 'LAINNYA';
};

const madinCategories = (targets: TargetAbsensi[]) => [...new Set(targets.map(madinDisplayCategory))]
  .sort((left, right) => {
    const leftOrder = MADIN_JENJANG_ORDER.indexOf(left);
    const rightOrder = MADIN_JENJANG_ORDER.indexOf(right);
    if (leftOrder !== -1 || rightOrder !== -1) {
      return (leftOrder === -1 ? Number.MAX_SAFE_INTEGER : leftOrder)
        - (rightOrder === -1 ? Number.MAX_SAFE_INTEGER : rightOrder);
    }
    return left.localeCompare(right, 'id');
  });

const PBM_CATEGORY_ORDER = ['FASOHAH', 'ULA A', 'ULA B', 'WUSTHO A', 'WUSTHO B', 'ULYA', 'SOROGAN KHUSUS'];

const pbmDisplayCategory = (target: TargetAbsensi) => {
  const sourceCategory = (target.kategori_target ?? '').trim().toUpperCase();
  if (sourceCategory && sourceCategory !== 'MASTER_PUTRA' && sourceCategory !== 'LAINNYA') {
    return sourceCategory;
  }
  const name = target.nama_target.trim().toUpperCase();
  for (const category of PBM_CATEGORY_ORDER) {
    if (name.startsWith(category)) return category;
  }
  return sourceCategory || 'LAINNYA';
};

const pbmCategories = (targets: TargetAbsensi[]) => [...new Set(targets.map(pbmDisplayCategory))]
  .sort((left, right) => {
    const leftOrder = PBM_CATEGORY_ORDER.indexOf(left);
    const rightOrder = PBM_CATEGORY_ORDER.indexOf(right);
    if (leftOrder !== -1 || rightOrder !== -1) {
      return (leftOrder === -1 ? Number.MAX_SAFE_INTEGER : leftOrder)
        - (rightOrder === -1 ? Number.MAX_SAFE_INTEGER : rightOrder);
    }
    return left.localeCompare(right, 'id');
  });

type DashboardIconName = 'users' | 'alumni' | 'warning' | 'gate' | 'assignment' | 'account' | 'message' | 'arrow' | 'verify' | 'report';

function DashboardIcon({ name }: { name: DashboardIconName }) {
  const paths: Record<DashboardIconName, ReactNode> = {
    users: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7" r="3" /><path d="M16 4.5a3 3 0 0 1 0 5.8M18 14.5a4 4 0 0 1 4 4V20" /></>,
    alumni: <><path d="m3 9 9-5 9 5-9 5-9-5Z" /><path d="M7 11.5V16c2.7 2.1 7.3 2.1 10 0v-4.5M21 10v6" /></>,
    warning: <><path d="M12 3 2.8 19h18.4L12 3Z" /><path d="M12 9v4M12 16.5h.01" /></>,
    gate: <><path d="M4 20V8l8-4 8 4v12M8 20V10h8v10M8 14h8" /></>,
    assignment: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4" /></>,
    account: <><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0 1 14 0M18 4h3v3" /></>,
    message: <><path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v5A2.5 2.5 0 0 1 16.5 15H11l-4 4v-4H7.5A2.5 2.5 0 0 1 5 12.5Z" /><path d="M8.5 8.5h7M8.5 11.5H14" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    verify: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
    report: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
  };

  return <svg className="dashboard-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}



export function DashboardPage() {
  const { user } = useAuth();
  const { jenis: routeJenis } = useParams<{ jenis?: string }>();
  const [searchParams] = useSearchParams();
  const urlJenis = routeJenis || searchParams.get('jenis') || '';

  const [expandedRosterGroup, setExpandedRosterGroup] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data = [], isLoading, error, refetch } = useQuery<OpsiAbsensi[]>({
    queryKey: ['absensi-options', user?.petugas_id],
    queryFn: async () => (await api.get('/api/absensi-options')).data,
  });

  const { data: santriCount, isLoading: isSantriLoading, isError: isSantriError } = useQuery<{ total: number }>({
    queryKey: ['santri-summary'],
    queryFn: async () => (await api.get('/api/master/santri/count')).data,
    enabled: user?.jabatan === 'Admin',
  });

  const { data: alumniStats, isLoading: isAlumniLoading, isError: isAlumniError } = useQuery<{ total: number }>({
    queryKey: ['alumni-summary'],
    queryFn: async () => (await api.get('/api/master/alumni/stats')).data,
    enabled: user?.jabatan === 'Admin',
  });
  const { data: dashboardSummary } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary', user?.petugas_id],
    queryFn: async () => (await api.get('/api/dashboard/summary')).data,
    enabled: Boolean(user),
  });

  interface VerificationSummaryData {
    total_santri_aktif: number;
    santri_baru: {
      total: number;
      perlu_verifikasi: number;
      tanpa_no_id?: number;
    };
    most_missing_fields: Array<{
      key: string;
      label: string;
      count: number;
    }>;
  }

  const { data: verificationAttention = { santri: 0, review: 0, petugas: 0, petugasDetails: null }, isLoading: isAttentionLoading } = useQuery({
    queryKey: ['verification-attention-dashboard', user?.petugas_id],
    queryFn: async () => {
      const [santriResponse, reviewResponse, penugasanResponse] = await Promise.all([
        api.get('/api/master/santri/verifikasi', { params: { per_page: 1 } }),
        api.get('/api/master/import-reviews'),
        api.get('/api/master/penugasan-attention'),
      ]);
      const reviewList = Array.isArray(reviewResponse.data) ? reviewResponse.data : [];
      return {
        santri: santriResponse.data.total ?? 0,
        review: reviewList.filter((item: { status: string }) => item.status === 'perlu_tinjau' || item.status === 'perlu_mapping_kamar').length,
        petugas: penugasanResponse.data.total_unassigned ?? 0,
        petugasDetails: penugasanResponse.data,
      };
    },
    enabled: user?.jabatan === 'Admin',
    refetchInterval: 30_000,
  });

  const { data: verificationSummary, isLoading: isSummaryLoading } = useQuery<VerificationSummaryData>({
    queryKey: ['verification-summary-stats', user?.petugas_id],
    queryFn: async () => (await api.get('/api/master/santri/verifikasi-summary')).data,
    enabled: user?.jabatan === 'Admin',
    refetchInterval: 30_000,
  });

  const kelompokTampilan: KelompokTampilan[] = data.map(kegiatan => ({
    ...kegiatan,
    displayKey: kegiatan.jenis,
    nama: kegiatan.jenis === 'sekolah' ? 'Kelas Formal' : kegiatan.nama,
  }));

  const activeJenis = kelompokTampilan.some(item => item.displayKey === urlJenis)
    ? urlJenis
    : (kelompokTampilan[0]?.displayKey ?? '');

  useEffect(() => {
    const kegiatan = kelompokTampilan.find(item => item.displayKey === activeJenis);
    if (!kegiatan) {
      setExpandedRosterGroup(null);
      return;
    }

    let firstGroupKey = `${kegiatan.jenis}:all`;
    if (kegiatan.jenis === 'sekolah') {
      const schoolUnits = [...new Set(kegiatan.targets.map(target => (target.unit_nama || target.unit_kode || (target.tingkat ? `Tingkat ${target.tingkat}` : 'Kelas Formal')).trim()))]
        .sort((left, right) => left.localeCompare(right, 'id', { numeric: true }));
      const firstUnit = schoolUnits[0];
      if (firstUnit) firstGroupKey = `sekolah:${firstUnit}`;
    } else if (kegiatan.jenis === 'kamar' || kegiatan.jenis === 'keberangkatan') {
      const firstCategory = [...new Set(kegiatan.targets.map(target => target.kategori_target ?? 'Kamar lainnya'))]
        .sort((left, right) => left.localeCompare(right, 'id', { numeric: true }))[0];
      if (firstCategory) firstGroupKey = `${kegiatan.jenis}:${firstCategory}`;
    } else if (kegiatan.jenis === 'pbs') {
      const firstCategory = pbsCategories(kegiatan.targets)[0];
      if (firstCategory) firstGroupKey = `pbs:${firstCategory}`;
    } else if (kegiatan.jenis === 'diniyah') {
      const firstCategory = madinCategories(kegiatan.targets)[0];
      if (firstCategory) firstGroupKey = `diniyah:${firstCategory}`;
    } else if (kegiatan.jenis === 'pbm') {
      const firstCategory = pbmCategories(kegiatan.targets)[0];
      if (firstCategory) firstGroupKey = `pbm:${firstCategory}`;
    }

    setExpandedRosterGroup(firstGroupKey);
  }, [activeJenis, data]);

  const activeActivity = kelompokTampilan.find(item => item.displayKey === activeJenis);
  const headerTitle = urlJenis && activeActivity
    ? (activeActivity.nama.startsWith('Absensi') ? activeActivity.nama : `Absensi ${activeActivity.nama}`)
    : 'Absensi Santri';

  const displayedKelompok = urlJenis && activeJenis
    ? kelompokTampilan.filter(item => item.displayKey === activeJenis)
    : kelompokTampilan;

  const toggleRosterGroup = (key: string) => {
    setExpandedRosterGroup(current => current === key ? null : key);
  };

  const cleanTargetLabel = (kegiatan: KelompokTampilan, target: TargetAbsensi) => {
    let label = target.nama_target;
    if (['pbs', 'diniyah', 'pbm'].includes(kegiatan.jenis)) {
      const dashIdx = label.indexOf(' - ');
      if (dashIdx !== -1) {
        label = label.slice(dashIdx + 3).trim();
      }
    }
    return label;
  };

  const targetCards = (kegiatan: KelompokTampilan, targets: TargetAbsensi[]) => {
    const sortedTargets = [...targets].sort((left, right) =>
      cleanTargetLabel(kegiatan, left).localeCompare(cleanTargetLabel(kegiatan, right), 'id', { numeric: true, sensitivity: 'base' })
    );
    return (
      <div className="target-grid">
        {sortedTargets.map(target => {
          const displayLabel = cleanTargetLabel(kegiatan, target);
          return (
            <Link
              className="target-card"
              key={target.target_id}
              aria-label={`Buka absensi ${displayLabel}`}
              to={`/absensi/${kegiatan.jenis}/${target.target_id}?jadwal=${kegiatan.jadwal[0].jadwal_id}`}
            >
              <span className="target-card-label">{displayLabel}</span>
              <span className="target-card-action" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          );
        })}
      </div>
    );
  };

  const collapsibleTargetGroup = (
    kegiatan: KelompokTampilan,
    key: string,
    label: string,
    targets: TargetAbsensi[],
  ) => {
    const isExpanded = expandedRosterGroup === key;
    const contentId = `roster-content-${key.replace(/[^a-z0-9]+/gi, '-')}`;
    return (
      <section className="roster-category-group" key={key}>
        <button
          aria-controls={contentId}
          aria-expanded={isExpanded}
          className={`roster-category-toggle${isExpanded ? ' is-expanded' : ''}`}
          onClick={() => toggleRosterGroup(key)}
          type="button"
        >
          <span className="roster-category-label">{label}</span>
          <span className="roster-category-toggle-meta">
            <span className="roster-count-mono">
              {targets.length} {kegiatan.jenis === 'sekolah' ? 'kelas' : ((kegiatan.jenis === 'kamar' || kegiatan.jenis === 'keberangkatan') ? 'kamar' : 'kelompok')}
            </span>
            <span className="roster-chevron-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </span>
        </button>
        {isExpanded && <div className="roster-category-content" id={contentId}>{targetCards(kegiatan, targets)}</div>}
      </section>
    );
  };

  const isDashboardView = !urlJenis;
  const roleDashboardTitle: Record<string, string> = {
    Keamanan: 'Pengawasan izin dan pelanggaran',
    'Pembina Kamar': 'Tugas pembinaan kamar',
    'Wali Kelas': 'Tugas kelas formal',
    'Piket Pengajian': 'Tugas pengajian hari ini',
  };


  const [activeDraft, setActiveDraft] = useState<{
    storageKey: string;
    jenis: string;
    targetId: number;
    jadwalId: number;
    namaTarget: string;
    namaJadwal: string;
    tanggal: string;
    tanggalLabel: string;
    updatedAt: number;
    expiresAt: number;
    totalFilled: number;
  } | null>(null);

  useEffect(() => {
    try {
      const keys = Object.keys(localStorage);
      const draftKeys = keys.filter(k => k.startsWith('simanteb_attendance_draft_'));
      const nowMs = Date.now();
      let found: any = null;

      for (const key of draftKeys) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const item = JSON.parse(raw);
          if (!item || !item.expiresAt || nowMs >= item.expiresAt) {
            localStorage.removeItem(key);
            continue;
          }
          if (urlJenis) {
            if (item.jenis === urlJenis) {
              found = { ...item, storageKey: key };
              break;
            }
          } else {
            if (!found || item.updatedAt > found.updatedAt) {
              found = { ...item, storageKey: key };
            }
          }
        } catch {}
      }
      setActiveDraft(found);
    } catch {}
  }, [urlJenis]);

  const handleDismissDraft = (storageKey: string) => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setActiveDraft(null);
  };

  usePageMeta({
    title: isDashboardView ? (user?.jabatan === 'Admin' ? 'Pusat Administrasi' : 'Beranda Utama') : headerTitle,
    description: isDashboardView
      ? 'Kelola data santri, alumni, dan operasional pesantren dari satu tempat.'
      : `Pencatatan dan pengelolaan ${headerTitle} Pondok Pesantren Tebuireng.`,
  });

  return (
    <div>
      {isDashboardView ? (
        <header className="dashboard-header dashboard-header-compact">
          <div>
            <h1 className="dashboard-hero-title">Assalamu'alaikum, {user?.nama || 'User Admin'}</h1>
            <p>Kelola data santri, antrean verifikasi, dan operasional pesantren dari satu tempat.</p>
          </div>
          <div className="dashboard-header-right">
            <div className="dashboard-header-time-container">
              <span className="dashboard-header-date">
                {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className="dashboard-header-clock">
                {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')} WIB
              </span>
            </div>
          </div>
          <div className="dashboard-mosque-dark" aria-hidden="true"></div>
        </header>
      ) : (
        <header className="absensi-module-hero">
          <div className="absensi-module-hero-main">
            <h1 className="absensi-module-hero-title">{headerTitle}</h1>
            <p className="absensi-module-hero-desc">
              {activeActivity?.jenis === 'kamar' && 'Pilih kamar binaan untuk mencatat dan memantau kehadiran santri di asrama.'}
              {activeActivity?.jenis === 'sekolah' && 'Pilih kelas formal untuk mencatat absensi kegiatan belajar mengajar harian santri.'}
              {activeActivity?.jenis === 'keberangkatan' && 'Pilih wisma untuk memantau ketepatan waktu keberangkatan santri menuju kelas.'}
              {activeActivity?.jenis === 'pbs' && "Pilih kelompok Al-Qur'an untuk mencatat presensi kegiatan mengaji ba'da Subuh."}
              {activeActivity?.jenis === 'diniyah' && 'Pilih kelas madrasah diniyah untuk presensi santri pada kurikulum pesantren.'}
              {activeActivity?.jenis === 'pbm' && "Pilih kelompok takhassus untuk mencatat presensi belajar malam ba'da Maghrib."}
              {!['kamar', 'sekolah', 'keberangkatan', 'pbs', 'diniyah', 'pbm'].includes(activeActivity?.jenis ?? '') && 'Pilih kelompok sesuai penugasan Anda untuk mulai mencatat kehadiran santri.'}
            </p>
            <div className="absensi-module-hero-meta">
              <span className="absensi-module-pill absensi-module-pill-petugas">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                Petugas: {user?.nama || 'Petugas Absensi'}
              </span>
              {activeActivity?.jadwal[0] && (
                <span className="absensi-module-pill absensi-module-pill-schedule">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Waktu Absensi: {activeActivity.jadwal[0].jam_mulai.slice(0, 5)} – {activeActivity.jadwal[0].jam_selesai.slice(0, 5)} WIB
                </span>
              )}
              <span className="absensi-module-pill absensi-module-pill-count">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
                </svg>
                {activeActivity?.targets.length ?? 0} {activeActivity?.jenis === 'sekolah' ? 'Kelas' : (activeActivity?.jenis === 'kamar' ? 'Kamar' : 'Kelompok')}
              </span>
              <span className="absensi-module-pill absensi-module-pill-period">
                T.A. 2026/2027
              </span>
            </div>
          </div>
          <div className="absensi-module-hero-actions">
            {['Admin', 'Pembina Kamar', 'Wali Kelas', 'Piket Pengajian'].includes(user?.jabatan ?? '') && (
              <Link to="/absensi-histori" className="absensi-module-action-btn secondary">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/>
                </svg>
                <span>Histori Absensi</span>
              </Link>
            )}
          </div>
          <div className="dashboard-mosque-dark" aria-hidden="true"></div>
        </header>
      )}

      {isLoading && <ContentSkeleton rows={4} />}
      {error && (
        <div className="error-box" role="alert">
          <span>Data penugasan tidak dapat dimuat. Periksa koneksi lalu coba lagi.</span>
          <button type="button" className="secondary-button" onClick={() => void refetch()}>
            Coba lagi
          </button>
        </div>
      )}

      {!isLoading && !error && data.length === 0 && (
        <div className="empty-state">
          Belum ada penugasan yang diatur untuk akun ini. Hubungi Admin jika butuh akses penugasan.
        </div>
      )}

      {isDashboardView && user?.jabatan !== 'Admin' && !isLoading && !error && data.length > 0 && (
        <section className="dashboard-duty-panel" aria-labelledby="dashboard-duty-title">
          <div className="dashboard-section-heading">
            <div><span className="dashboard-section-kicker">Penugasan aktif</span><h2 id="dashboard-duty-title">{roleDashboardTitle[user?.jabatan ?? ''] ?? 'Tugas operasional'}</h2></div>
          </div>
          <div className="dashboard-duty-list">
            {data.map(kegiatan => <Link key={kegiatan.jenis} className="dashboard-duty-row" to={`/absensi-kegiatan/${kegiatan.jenis}`}>
              <span><strong>{kegiatan.nama}</strong><small>{kegiatan.targets.length} roster ditugaskan</small></span>
              <span>{kegiatan.jadwal[0] ? `${kegiatan.jadwal[0].jam_mulai.slice(0, 5)}–${kegiatan.jadwal[0].jam_selesai.slice(0, 5)}` : 'Jadwal belum diatur'}</span>
            </Link>)}
          </div>
        </section>
      )}

      {isDashboardView && user?.jabatan === 'Keamanan' && dashboardSummary?.perizinan && (
        <section className="dashboard-duty-panel" aria-labelledby="security-summary-title"><div className="dashboard-section-heading"><div><span className="dashboard-section-kicker">Pengawasan hari ini</span><h2 id="security-summary-title">Perizinan dan gerbang</h2></div></div><div className="dashboard-metric-inline"><span><strong>{dashboardSummary.perizinan.aktif}</strong> izin aktif</span><span><strong>{dashboardSummary.perizinan.berjalan}</strong> sedang berjalan</span><span className={dashboardSummary.perizinan.overdue > 0 ? 'is-alert' : ''}><strong>{dashboardSummary.perizinan.overdue}</strong> izin melewati batas waktu</span><span><strong>{dashboardSummary.notifikasi_belum_dibaca ?? 0}</strong> notifikasi belum dibaca</span></div><Link className="dashboard-duty-row" to="/catat-gerbang"><strong>Buka Catat Izin & Gerbang</strong><span>Lihat tindakan pos</span></Link></section>
      )}

      {isDashboardView && user?.jabatan === 'Pembina Kamar' && dashboardSummary?.kamar && (
        <section className="dashboard-duty-panel" aria-labelledby="room-summary-title"><div className="dashboard-section-heading"><div><span className="dashboard-section-kicker">Pembinaan kamar</span><h2 id="room-summary-title">Headcount dan catatan terbaru</h2></div></div><div className="dashboard-metric-inline"><span><strong>{dashboardSummary.kamar.jumlah}</strong> kamar ditugaskan</span><span><strong>{dashboardSummary.kamar.headcount}</strong> santri binaan</span><span><strong>{dashboardSummary.pelanggaran_terbaru?.length ?? 0}</strong> pelanggaran terbaru</span></div><Link className="dashboard-duty-row" to="/pelanggaran/semua"><strong>Buka catatan pelanggaran</strong><span>Scope kamar binaan</span></Link></section>
      )}



      {/* ANTREAN VERIFIKASI DATA & RINGKASAN ADMIN — hanya tampil di Beranda Admin */}
      {isDashboardView && user?.jabatan === 'Admin' && !isLoading && !error && (
        <>
          {/* SECTION 1: ANTREAN VERIFIKASI DATA */}
          <section className="dashboard-data-summary" aria-labelledby="verification-summary-title">
            <div className="dashboard-section-heading">
              <div>
                <h2 id="verification-summary-title">Need Action</h2>
              </div>
            </div>
            <div className="admin-verification-grid admin-verification-grid-trio">
              <Link to="/verifikasi-data/santri" className="admin-verif-card">
                <div className="admin-verif-card-header">
                  <span className="admin-verif-icon"><DashboardIcon name="verify" /></span>
                  {verificationAttention.santri > 0 && <span className="admin-verif-badge">{verificationAttention.santri}</span>}
                </div>
                <span className="admin-verif-title">Verifikasi Data Santri</span>
                <small className="admin-verif-desc">
                  {isAttentionLoading ? <ValuePulse width={32} /> : `${verificationAttention.santri} santri perlu pemetaan / verifikasi`}
                </small>
              </Link>

              <Link to="/verifikasi-data/review" className="admin-verif-card">
                <div className="admin-verif-card-header">
                  <span className="admin-verif-icon"><DashboardIcon name="verify" /></span>
                  {verificationAttention.review > 0 && <span className="admin-verif-badge warning">{verificationAttention.review}</span>}
                </div>
                <span className="admin-verif-title">Review Kemiripan</span>
                <small className="admin-verif-desc">
                  {isAttentionLoading ? <ValuePulse width={32} /> : `${verificationAttention.review} kandidat ambigu`}
                </small>
              </Link>

              <Link to="/data-master/penugasan" className="admin-verif-card">
                <div className="admin-verif-card-header">
                  <span className="admin-verif-icon"><DashboardIcon name="account" /></span>
                  {verificationAttention.petugas > 0 && <span className="admin-verif-badge warning">{verificationAttention.petugas}</span>}
                </div>
                <span className="admin-verif-title">Penugasan Petugas</span>
                <small className="admin-verif-desc">
                  {isAttentionLoading ? (
                    <ValuePulse width={32} />
                  ) : verificationAttention.petugasDetails ? (
                    [
                      verificationAttention.petugasDetails.kamar > 0 && `${verificationAttention.petugasDetails.kamar} Kamar`,
                      verificationAttention.petugasDetails.kelas_formal > 0 && `${verificationAttention.petugasDetails.kelas_formal} Formal`,
                      verificationAttention.petugasDetails.kelompok_madin > 0 && `${verificationAttention.petugasDetails.kelompok_madin} Madin`,
                      verificationAttention.petugasDetails.kelompok_pbs > 0 && `${verificationAttention.petugasDetails.kelompok_pbs} Subuh`,
                      verificationAttention.petugasDetails.kelompok_pbm > 0 && `${verificationAttention.petugasDetails.kelompok_pbm} Maghrib`,
                    ].filter(Boolean).join(' • ') + ' belum di-assign'
                  ) : (
                    `${verificationAttention.petugas} unit/kelompok belum ber-pengampu`
                  )}
                </small>
              </Link>
            </div>

            {/* PANEL KELENGKAPAN DATA & PEMETAAN SANTRI */}
            <div className="admin-completeness-panel">
              <div className="admin-completeness-header">
                <div className="admin-completeness-title-group">
                  <h3 className="admin-completeness-title">Kelengkapan Identitas & Pemetaan Santri</h3>
                  <p className="admin-completeness-subtitle">Daftar atribut santri aktif yang paling banyak belum diisi di database master</p>
                </div>
                {verificationSummary?.total_santri_aktif && (
                  <div className="admin-completeness-total-badge">
                    <span className="admin-completeness-total-label">BASIS DATA SANTRI</span>
                    <strong className="admin-completeness-total-val mono-num">{verificationSummary.total_santri_aktif.toLocaleString('id')}</strong>
                    <span className="admin-completeness-total-sub">santri aktif</span>
                  </div>
                )}
              </div>

              {isSummaryLoading ? (
                <div style={{ padding: '24px 0', textAlign: 'center' }}><ValuePulse width={160} /></div>
              ) : verificationSummary?.most_missing_fields ? (
                <div className="admin-completeness-table-wrapper">
                  <table className="admin-completeness-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>NO</th>
                        <th>ATRIBUT DATA / PEMETAAN</th>
                        <th style={{ textAlign: 'right' }}>JUMLAH BELUM LENGKAP</th>
                        <th style={{ textAlign: 'right' }}>PERSENTASE DB</th>
                        <th style={{ textAlign: 'center' }}>TINDAKAN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verificationSummary.most_missing_fields
                        .filter((field) => field.count > 0)
                        .map((field, idx) => {
                          const pct = verificationSummary.total_santri_aktif > 0
                            ? Math.round((field.count / verificationSummary.total_santri_aktif) * 100)
                            : 0;
                          const isTanpaNoId = field.key === 'tanpa_no_id';
                          return (
                            <tr key={field.key} className={isTanpaNoId ? 'row-priority' : ''}>
                              <td className="admin-completeness-idx mono-num">{idx + 1}</td>
                              <td className="admin-completeness-field-cell">
                                <div className="admin-completeness-field-name">
                                  <strong>{field.label}</strong>
                                  {isTanpaNoId && <span className="admin-priority-tag">Prioritas Induk</span>}
                                </div>
                              </td>
                              <td className="admin-completeness-count" style={{ textAlign: 'right' }}>
                                <span className="mono-num alert-val">{field.count.toLocaleString('id')}</span>
                                <small className="unit-text">santri</small>
                              </td>
                              <td className="admin-completeness-pct" style={{ textAlign: 'right' }}>
                                <span className="mono-num">{pct}%</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <Link
                                  to={`/verifikasi-data/santri?missing=${field.key}`}
                                  className={`admin-completeness-action-link ${isTanpaNoId ? 'action-priority' : ''}`}
                                >
                                  {isTanpaNoId ? 'Beri Nomor Induk' : 'Verifikasi'}
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </section>

          {/* SECTION 2: RINGKASAN STATUS PONDOK */}
          <section className="dashboard-data-summary" aria-labelledby="dashboard-summary-title">
            <div className="dashboard-section-heading">
              <div>
                <span className="dashboard-section-kicker">Ringkasan pondok</span>
                <h2 id="dashboard-summary-title">Status Data Master & Perizinan</h2>
              </div>
            </div>
            <div className="dashboard-grid-premium">
              <Link to="/data-master/santri" className="stat-card stat-card-santri">
                <span className="stat-card-label">TOTAL SANTRI PUTRA</span>
                <strong className="stat-card-value">
                  {isSantriLoading ? <ValuePulse width={48} /> : isSantriError ? '—' : santriCount?.total.toLocaleString('id') ?? '—'}
                </strong>
                <span className="stat-card-action">Buka Data Santri →</span>
              </Link>

              <Link to="/data-master/alumni" className="stat-card stat-card-sekolah">
                <span className="stat-card-label">TOTAL DATA ALUMNI</span>
                <strong className="stat-card-value">
                  {isAlumniLoading ? <ValuePulse width={48} /> : isAlumniError ? '—' : alumniStats?.total.toLocaleString('id') ?? '—'}
                </strong>
                <span className="stat-card-action">Buka Data Alumni →</span>
              </Link>

              <Link to="/perizinan/semua" className="stat-card stat-card-perizinan">
                <span className="stat-card-label">PERIZINAN AKTIF</span>
                <strong className="stat-card-value">
                  {dashboardSummary?.perizinan?.aktif ?? 0}
                </strong>
                <span className="stat-card-action">
                  {dashboardSummary?.perizinan?.overdue && dashboardSummary.perizinan.overdue > 0
                    ? `${dashboardSummary.perizinan.overdue} overdue! →`
                    : 'Lihat Perizinan →'}
                </span>
              </Link>

              <Link to="/catat-gerbang" className="stat-card stat-card-pbs">
                <span className="stat-card-label">IZIN SEDANG BERJALAN</span>
                <strong className="stat-card-value">
                  {dashboardSummary?.perizinan?.berjalan ?? 0}
                </strong>
                <span className="stat-card-action">Pos Gerbang →</span>
              </Link>
            </div>
          </section>
        </>
      )}

      {/* SHORTCUT OPERASIONAL — hanya tampil di Beranda */}
      {isDashboardView && !isLoading && !error && (
        <section className="dashboard-shortcuts" aria-labelledby="dashboard-shortcuts-title">
          <div className="dashboard-section-heading">
            <div>
              <h2 id="dashboard-shortcuts-title">Modul administrasi</h2>
            </div>
          </div>
          <div className="dashboard-shortcut-grid">
            {user?.jabatan === 'Admin' && (
              <Link to="/periode-akademik" className="dashboard-shortcut account">
                <span className="dashboard-shortcut-icon"><DashboardIcon name="assignment" /></span>
                <span className="dashboard-shortcut-copy">
                  <span className="dashboard-shortcut-title">Periode Akademik</span>
                  <span className="dashboard-shortcut-description">Kelola tahun ajaran & semester aktif</span>
                </span>
                <span className="dashboard-shortcut-arrow"><DashboardIcon name="arrow" /></span>
              </Link>
            )}
            {['Admin', 'Keamanan', 'Pembina Kamar'].includes(user?.jabatan ?? '') && (
              <Link to="/pelanggaran/semua" className="dashboard-shortcut warning">
                <span className="dashboard-shortcut-icon"><DashboardIcon name="warning" /></span>
                <span className="dashboard-shortcut-copy">
                  <span className="dashboard-shortcut-title">Daftar Pelanggaran</span>
                  <span className="dashboard-shortcut-description">Tinjau catatan pelanggaran santri</span>
                </span>
                <span className="dashboard-shortcut-arrow"><DashboardIcon name="arrow" /></span>
              </Link>
            )}
            {['Admin', 'Keamanan'].includes(user?.jabatan ?? '') && (
              <Link to="/perizinan/semua" className="dashboard-shortcut gate">
                <span className="dashboard-shortcut-icon"><DashboardIcon name="gate" /></span>
                <span className="dashboard-shortcut-copy">
                  <span className="dashboard-shortcut-title">Daftar Perizinan</span>
                  <span className="dashboard-shortcut-description">Pantau perizinan dan status gerbang</span>
                </span>
                <span className="dashboard-shortcut-arrow"><DashboardIcon name="arrow" /></span>
              </Link>
            )}
            {user?.jabatan === 'Admin' && (
              <Link to="/data-master/penugasan" className="dashboard-shortcut assignment">
                <span className="dashboard-shortcut-icon"><DashboardIcon name="assignment" /></span>
                <span className="dashboard-shortcut-copy">
                  <span className="dashboard-shortcut-title">Penugasan Absensi</span>
                  <span className="dashboard-shortcut-description">Atur tanggung jawab kelompok petugas</span>
                </span>
                <span className="dashboard-shortcut-arrow"><DashboardIcon name="arrow" /></span>
              </Link>
            )}
            {user?.jabatan === 'Admin' && (
              <Link to="/data-master/akun" className="dashboard-shortcut account">
                <span className="dashboard-shortcut-icon"><DashboardIcon name="account" /></span>
                <span className="dashboard-shortcut-copy">
                  <span className="dashboard-shortcut-title">Akun Petugas</span>
                  <span className="dashboard-shortcut-description">Kelola akun dan akses operasional</span>
                </span>
                <span className="dashboard-shortcut-arrow"><DashboardIcon name="arrow" /></span>
              </Link>
            )}
            {user?.jabatan === 'Admin' && (
              <Link to="/laporan/detail" className="dashboard-shortcut assignment">
                <span className="dashboard-shortcut-icon"><DashboardIcon name="report" /></span>
                <span className="dashboard-shortcut-copy">
                  <span className="dashboard-shortcut-title">Laporan Detail</span>
                  <span className="dashboard-shortcut-description">Rekapitulasi laporan seluruh kegiatan</span>
                </span>
                <span className="dashboard-shortcut-arrow"><DashboardIcon name="arrow" /></span>
              </Link>
            )}
            {user?.jabatan === 'Admin' && (
              <Link to="/data-master/wa-bot" className="dashboard-shortcut account whatsapp-shortcut">
                <span className="dashboard-shortcut-icon"><DashboardIcon name="message" /></span>
                <span className="dashboard-shortcut-copy">
                  <span className="dashboard-shortcut-title">Pengaturan Bot WA</span>
                  <span className="dashboard-shortcut-description">Pindai QR Code & kelola WhatsApp Bot</span>
                </span>
                <span className="dashboard-shortcut-arrow"><DashboardIcon name="arrow" /></span>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ROSTER ABSENSI TARGETS — hanya tampil saat membuka menu absensi */}
      {!isDashboardView && (
        <div className="attendance-groups">
          {displayedKelompok.map(kegiatan => (
            <section
              className={`attendance-group${activeJenis === kegiatan.displayKey ? ' mobile-active' : ''}`}
              key={kegiatan.displayKey}
              role="tabpanel"
            >
              <div className="attendance-group-heading">
                <div>
                  <h2>
                    {kegiatan.jadwal[0]
                      ? `Waktu Absensi: ${kegiatan.jadwal[0].jam_mulai.slice(0, 5)} – ${kegiatan.jadwal[0].jam_selesai.slice(0, 5)} WIB`
                      : 'Waktu Absensi Belum Diatur'}
                  </h2>
                </div>
              </div>

              {/* Draft Attendance Inline Banner (Under Waktu Absensi) */}
              {activeDraft && (activeDraft.jenis === kegiatan.jenis || isDashboardView) && (
                <div className="attendance-draft-banner-inline" role="status">
                  <div className="draft-banner-left">
                    <div className="draft-banner-text">
                      <div className="draft-banner-title">
                        Draft Absensi Belum Selesai: <span className="draft-target-highlight">{activeDraft.namaTarget}</span>
                      </div>
                      <div className="draft-banner-sub">
                        <span>Sesi: <strong>{activeDraft.namaJadwal}</strong></span>
                        <span className="draft-sub-dot">·</span>
                        <span>{activeDraft.tanggalLabel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="draft-banner-actions">
                    <Link
                      to={`/absensi/${activeDraft.jenis}/${activeDraft.targetId}?jadwal=${activeDraft.jadwalId}`}
                      className="draft-banner-btn-primary"
                    >
                      <span>Lanjutkan Absensi</span>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </Link>
                    <button
                      type="button"
                      className="draft-banner-btn-close"
                      onClick={() => handleDismissDraft(activeDraft.storageKey)}
                      title="Hapus dan tutup draft ini"
                      aria-label="Hapus dan tutup draft ini"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {kegiatan.jadwal.length === 0 ? (
                <div className="warning-box">Jadwal belum diatur oleh Admin.</div>
              ) : kegiatan.jenis === 'sekolah' ? (
                <div className="roster-category-groups">
                  {[...new Set(kegiatan.targets.map(target => (target.unit_nama || target.unit_kode || (target.tingkat ? `Tingkat ${target.tingkat}` : 'Kelas Formal')).trim()))]
                    .sort((left, right) => left.localeCompare(right, 'id', { numeric: true }))
                    .map(unitName => {
                      const targets = kegiatan.targets.filter(target => (target.unit_nama || target.unit_kode || (target.tingkat ? `Tingkat ${target.tingkat}` : 'Kelas Formal')).trim() === unitName);
                      if (targets.length === 0) return null;
                      return collapsibleTargetGroup(kegiatan, `sekolah:${unitName}`, unitName, targets);
                    })}
                </div>
              ) : (kegiatan.jenis === 'kamar' || kegiatan.jenis === 'keberangkatan') ? (
                <div className="roster-category-groups">
                  {[...new Set(kegiatan.targets.map(target => target.kategori_target ?? 'Kamar lainnya'))]
                    .sort((left, right) => left.localeCompare(right, 'id', { numeric: true }))
                    .map(category => collapsibleTargetGroup(
                      kegiatan,
                      `${kegiatan.jenis}:${category}`,
                      category.toLowerCase().startsWith('wisma') ? category : `Wisma ${category}`,
                      kegiatan.targets.filter(target => (target.kategori_target ?? 'Kamar lainnya') === category),
                    ))}
                </div>
              ) : kegiatan.jenis === 'pbs' ? (
                <div className="roster-category-groups">
                  {pbsCategories(kegiatan.targets).map(category => collapsibleTargetGroup(
                    kegiatan,
                    `pbs:${category}`,
                    category,
                    kegiatan.targets.filter(target => pbsDisplayCategory(target) === category),
                  ))}
                </div>
              ) : kegiatan.jenis === 'diniyah' ? (
                <div className="roster-category-groups">
                  {madinCategories(kegiatan.targets).map(category => collapsibleTargetGroup(
                    kegiatan,
                    `diniyah:${category}`,
                    `Jenjang ${category}`,
                    kegiatan.targets.filter(target => madinDisplayCategory(target) === category),
                  ))}
                </div>
              ) : kegiatan.jenis === 'pbm' ? (
                <div className="roster-category-groups">
                  {pbmCategories(kegiatan.targets).map(category => collapsibleTargetGroup(
                    kegiatan,
                    `pbm:${category}`,
                    category,
                    kegiatan.targets.filter(target => pbmDisplayCategory(target) === category),
                  ))}
                </div>
              ) : (
                <div className="roster-category-groups">
                  {collapsibleTargetGroup(kegiatan, `${kegiatan.jenis}:all`, 'Kelompok absensi', kegiatan.targets)}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
