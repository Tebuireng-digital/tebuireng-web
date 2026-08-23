import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './AuthContext';
import { PageSkeleton, Spinner } from './components/LoadingSkeleton';
import { SantriPortalPage } from './pages/SantriPortalPage';
import { useLocation as useRouterLocation } from 'react-router-dom';
import { RoleLoginSelectionPage } from './pages/RoleLoginSelectionPage';

const BulkInputPage = lazy(() => import('./pages/BulkInputPage').then(module => ({ default: module.BulkInputPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const PelanggaranFormPage = lazy(() => import('./pages/PelanggaranFormPage').then(module => ({ default: module.PelanggaranFormPage })));
const PelanggaranListPage = lazy(() => import('./pages/PelanggaranListPage').then(module => ({ default: module.PelanggaranListPage })));
const PrestasiListPage = lazy(() => import('./pages/PrestasiListPage').then(module => ({ default: module.PrestasiListPage })));
const CatatGerbangPage = lazy(() => import('./pages/CatatGerbangPage').then(module => ({ default: module.CatatGerbangPage })));
const PerizinanListPage = lazy(() => import('./pages/PerizinanListPage').then(module => ({ default: module.PerizinanListPage })));
const DataMasterPage = lazy(() => import('./pages/DataMasterPage').then(module => ({ default: module.DataMasterPage })));
const LaporanPage = lazy(() => import('./pages/LaporanPage').then(module => ({ default: module.LaporanPage })));
const GantiPasswordPage = lazy(() => import('./pages/GantiPasswordPage').then(module => ({ default: module.GantiPasswordPage })));
const RekapKelasPage = lazy(() => import('./pages/RekapKelasPage').then(module => ({ default: module.RekapKelasPage })));
const RaportInputPage = lazy(() => import('./pages/RaportInputPage').then(module => ({ default: module.RaportInputPage })));
const RaportViewPage = lazy(() => import('./pages/RaportViewPage').then(module => ({ default: module.RaportViewPage })));
const UbudiyahFormPage = lazy(() => import('./pages/UbudiyahFormPage').then(module => ({ default: module.UbudiyahFormPage })));
const UbudiyahViewPage = lazy(() => import('./pages/UbudiyahViewPage').then(module => ({ default: module.UbudiyahViewPage })));
const UbudiyahMasterPage = lazy(() => import('./pages/UbudiyahMasterPage').then(module => ({ default: module.UbudiyahMasterPage })));

type IconName = 'home' | 'school' | 'room' | 'quran' | 'madin' | 'takhasus' | 'warning' | 'verify' | 'gate' | 'database' | 'report' | 'lock' | 'menu' | 'logout' | 'more' | 'raport' | 'ubudiyah';

interface OpsiAbsensiItem {
  jenis: string;
  nama: string;
}
interface VerificationAttention {
  santri: number;
  orda: number;
  kamar: number;
  review: number;
}

const ABSENSI_CONFIG: Record<string, { nama: string; icon: IconName }> = {
  sekolah: { nama: 'Absensi Kelas Formal', icon: 'school' },
  kamar: { nama: 'Absensi Kamar', icon: 'room' },
  pbs: { nama: 'Absensi Al-Qur\'an Subuh', icon: 'quran' },
  diniyah: { nama: 'Absensi Kelas Madin', icon: 'madin' },
  pbm: { nama: 'Absensi Takhasus Maghrib', icon: 'takhasus' },
};

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9h13v-9M9 19v-5h6v5"/></>,
    school: <><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></>,
    room: <><path d="M3 21v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8"/><path d="M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/><path d="M3 17h18"/></>,
    quran: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>,
    madin: <><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></>,
    takhasus: <><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></>,
    warning: <><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4M12 16.5h.01"/></>,
    verify: <><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.3 2.3 4.8-5"/></>,
    gate: <><path d="M4 20V8l8-4 8 4v12M8 20V10h8v10M8 14h8"/></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
    report: <><path d="M6 3h9l3 3v15H6zM14 3v4h4"/><path d="M9 16v-3M12 16V9M15 16v-5"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    raport: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
    ubudiyah: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
  };
  return <svg className="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Layout() {
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentJenis = searchParams.get('jenis');
  const { data: ubudiyahStatus, isError: ubudiyahStatusError } = useQuery<{ ready: boolean; instrument_count: number }>({
    queryKey: ['ubudiyah-status'],
    queryFn: async () => (await api.get('/api/ubudiyah/status')).data,
    enabled: Boolean(user),
    retry: false,
  });
  const ubudiyahReady = !ubudiyahStatusError && ubudiyahStatus?.ready !== false;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const updateViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
      if (mediaQuery.matches) setIsMobileMenuOpen(false);
    };

    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleScrollHide = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY <= 35) {
        setIsNavVisible(true);
      } else if (currentScrollY > lastScrollYRef.current + 8) {
        setIsNavVisible(false);
      } else if (currentScrollY < lastScrollYRef.current - 8) {
        setIsNavVisible(true);
      }
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScrollHide, { passive: true });
    return () => window.removeEventListener('scroll', handleScrollHide);
  }, []);
  const [isAbsensiMenuOpen, setIsAbsensiMenuOpen] = useState(() => location.pathname.startsWith('/absensi-kegiatan') || (location.pathname === '/dashboard' && !!currentJenis));
  const [isPelanggaranMenuOpen, setIsPelanggaranMenuOpen] = useState(() => location.pathname.startsWith('/pelanggaran'));
  const [isPerizinanMenuOpen, setIsPerizinanMenuOpen] = useState(() => location.pathname.startsWith('/perizinan') || location.pathname === '/catat-gerbang');
  const [isMasterMenuOpen, setIsMasterMenuOpen] = useState(() => location.pathname.startsWith('/data-master'));
  const [isRaportMenuOpen, setIsRaportMenuOpen] = useState(true);
  const [isVerificationMenuOpen, setIsVerificationMenuOpen] = useState(() => location.pathname.startsWith('/verifikasi-data'));
  const [isUbudiyahMenuOpen, setIsUbudiyahMenuOpen] = useState(() => location.pathname.startsWith('/ubudiyah'));
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const timers = new WeakMap<EventTarget, number>();

    const showScrollbar = (event: Event) => {
      const target = event.target instanceof HTMLElement ? event.target : document.documentElement;
      target.dataset.scrollState = 'active';

      const currentTimer = timers.get(target);
      if (currentTimer) window.clearTimeout(currentTimer);

      timers.set(target, window.setTimeout(() => {
        target.dataset.scrollState = 'idle';
        timers.set(target, window.setTimeout(() => {
          delete target.dataset.scrollState;
          timers.delete(target);
        }, 220));
      }, 900));
    };

    window.addEventListener('scroll', showScrollbar, true);
    return () => window.removeEventListener('scroll', showScrollbar, true);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleMenuKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleMenuKeyDown);
    return () => document.removeEventListener('keydown', handleMenuKeyDown);
  }, [isMobileMenuOpen]);

  const { data: absensiOptions = [] } = useQuery<OpsiAbsensiItem[]>({
    queryKey: ['absensi-options', user?.petugas_id],
    queryFn: async () => (await api.get('/api/absensi-options')).data,
    enabled: !!user,
  });
  const { data: verificationAttention = { santri: 0, orda: 0, kamar: 0, review: 0 } } = useQuery<VerificationAttention>({
    queryKey: ['verification-attention', user?.petugas_id],
    queryFn: async () => {
      const [santriResponse, ordaResponse, kamarResponse, reviewResponse] = await Promise.all([
        api.get('/api/master/santri/verifikasi', { params: { per_page: 10 } }),
        api.get('/api/master/santri/verifikasi-orda', { params: { per_page: 10 } }),
        api.get('/api/master/kamar-mappings'),
        api.get('/api/master/import-reviews'),
      ]);
      const reviewList = Array.isArray(reviewResponse.data) ? reviewResponse.data : [];
      return {
        santri: santriResponse.data.total ?? 0,
        orda: ordaResponse.data.total ?? 0,
        kamar: kamarResponse.data.filter((mapping: { nama_kamar?: string | null }) => !mapping.nama_kamar).length,
        review: reviewList.filter((item: { status: string }) => item.status === 'perlu_tinjau' || item.status === 'perlu_mapping_kamar').length,
      };
    },
    enabled: user?.jabatan === 'Admin',
    refetchInterval: 30_000,
  });
  const hasVerificationAttention = Object.values(verificationAttention).some(total => total > 0);

  if (loading) {
    return <div className="auth-loading-screen"><Spinner size="lg" /></div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  if (user.wajib_ganti_password && location.pathname !== '/ganti-kata-sandi') {
    return <Navigate to="/ganti-kata-sandi" replace />;
  }

  const openMenu = () => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    setIsMobileMenuOpen(true);
  };
  const closeMenu = () => {
    setIsMobileMenuOpen(false);
    previouslyFocusedRef.current?.focus();
  };
  const toggleAbsensiMenu = () => {
    setIsAbsensiMenuOpen(open => {
      const next = !open;
      if (next) {
        setIsPelanggaranMenuOpen(false);
        setIsPerizinanMenuOpen(false);
        setIsMasterMenuOpen(false);
        setIsVerificationMenuOpen(false);
        setIsUbudiyahMenuOpen(false);
      }
      return next;
    });
  };
  const togglePelanggaranMenu = () => {
    setIsPelanggaranMenuOpen(open => {
      const next = !open;
      if (next) {
        setIsAbsensiMenuOpen(false);
        setIsPerizinanMenuOpen(false);
        setIsMasterMenuOpen(false);
        setIsVerificationMenuOpen(false);
        setIsUbudiyahMenuOpen(false);
      }
      return next;
    });
  };
  const togglePerizinanMenu = () => {
    setIsPerizinanMenuOpen(open => {
      const next = !open;
      if (next) {
        setIsAbsensiMenuOpen(false);
        setIsPelanggaranMenuOpen(false);
        setIsMasterMenuOpen(false);
        setIsVerificationMenuOpen(false);
        setIsUbudiyahMenuOpen(false);
      }
      return next;
    });
  };
  const toggleMasterMenu = () => {
    setIsMasterMenuOpen(open => {
      const next = !open;
      if (next) {
        setIsAbsensiMenuOpen(false);
        setIsPelanggaranMenuOpen(false);
        setIsPerizinanMenuOpen(false);
        setIsRaportMenuOpen(false);
        setIsVerificationMenuOpen(false);
        setIsUbudiyahMenuOpen(false);
      }
      return next;
    });
  };
  const toggleRaportMenu = () => {
    setIsRaportMenuOpen(open => {
      const next = !open;
      if (next) {
        setIsAbsensiMenuOpen(false);
        setIsPelanggaranMenuOpen(false);
        setIsPerizinanMenuOpen(false);
        setIsMasterMenuOpen(false);
        setIsVerificationMenuOpen(false);
        setIsUbudiyahMenuOpen(false);
      }
      return next;
    });
  };
  const toggleVerificationMenu = () => {
    setIsVerificationMenuOpen(open => {
      const next = !open;
      if (next) {
        setIsAbsensiMenuOpen(false);
        setIsPelanggaranMenuOpen(false);
        setIsPerizinanMenuOpen(false);
        setIsMasterMenuOpen(false);
        setIsUbudiyahMenuOpen(false);
      }
      return next;
    });
  };
  const toggleUbudiyahMenu = () => {
    setIsUbudiyahMenuOpen(open => {
      const next = !open;
      if (next) {
        setIsAbsensiMenuOpen(false);
        setIsPelanggaranMenuOpen(false);
        setIsPerizinanMenuOpen(false);
        setIsMasterMenuOpen(false);
        setIsRaportMenuOpen(false);
        setIsVerificationMenuOpen(false);
      }
      return next;
    });
  };

  const userAbsensiMenus = absensiOptions.map(opt => ({
    jenis: opt.jenis,
    nama: ABSENSI_CONFIG[opt.jenis]?.nama || opt.nama,
    icon: ABSENSI_CONFIG[opt.jenis]?.icon || 'home',
  }));

  return (
    <div className="premium-layout">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="mobile-brand"><span className="brand-mark"><img src="/new_icon.jpeg" alt="Logo SIMANTEB" /></span><div><h2 className="mobile-header-title">SIMANTEB</h2><small>Sistem Manajemen Tebuireng</small></div></div>
        <button ref={mobileMenuButtonRef} className="mobile-menu-btn" aria-label="Buka menu navigasi" aria-expanded={isMobileMenuOpen} aria-controls="primary-navigation" onClick={openMenu}>
          <NavIcon name="menu" />
        </button>
      </header>

      {/* Sidebar Overlay for Mobile */}
      <div className={`sidebar-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={closeMenu}></div>

      {/* Sidebar / Navigation */}
      <div
        className={`premium-sidebar ${isMobileMenuOpen ? 'open' : ''}`}
        aria-hidden={isMobileViewport && !isMobileMenuOpen ? true : undefined}
        inert={isMobileViewport && !isMobileMenuOpen ? true : undefined}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div className="sidebar-brand"><span className="brand-mark"><img src="/new_icon.jpeg" alt="Logo SIMANTEB" /></span><div><h2 className="sidebar-title">SIMANTEB</h2><p>Sistem Manajemen Tebuireng</p></div></div>
          <button className="mobile-close-btn" aria-label="Tutup menu navigasi" onClick={closeMenu}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="sidebar-user-box">
          <span className="user-avatar">{user.nama.slice(0, 1).toUpperCase()}</span>
          <div><p>{user.nama}</p><span>{user.jabatan}</span></div>
        </div>

        <nav id="primary-navigation" className="sidebar-nav" aria-label="Navigasi sidebar">
          <Link
            to="/dashboard"
            className={`sidebar-nav-link ${location.pathname === '/dashboard' && !currentJenis ? 'active' : ''}`}
            aria-current={location.pathname === '/dashboard' && !currentJenis ? 'page' : undefined}
            onClick={closeMenu}
          >
            <NavIcon name="home"/><span>Beranda</span>
          </Link>

          {/* KELOMPOK MENU ABSENSI (COLLAPSIBLE) */}
          {userAbsensiMenus.length > 0 && (
            <div className="sidebar-master-menu">
              <button
                type="button"
                aria-label="Buka atau tutup Menu Absensi"
                aria-expanded={isAbsensiMenuOpen}
                aria-controls="absensi-subnav"
                className={`sidebar-nav-link sidebar-master-trigger ${(location.pathname.startsWith('/absensi-kegiatan') || (location.pathname === '/dashboard' && !!currentJenis)) ? 'active' : ''}`}
                onClick={toggleAbsensiMenu}
              >
                <span className="nav-label"><NavIcon name="quran"/><span>Menu Absensi</span></span>
                <span aria-hidden="true">{isAbsensiMenuOpen ? '⌃' : '⌄'}</span>
              </button>
              <div id="absensi-subnav" className={`sidebar-subnav ${isAbsensiMenuOpen ? 'open' : 'closed'}`} aria-hidden={!isAbsensiMenuOpen}>
                  {userAbsensiMenus.map(item => {
                    const isActive = (location.pathname === '/dashboard' && currentJenis === item.jenis) ||
                                     (location.pathname === `/absensi-kegiatan/${item.jenis}`);
                    return (
                      <Link
                        key={item.jenis}
                        to={`/absensi-kegiatan/${item.jenis}`}
                        className={`sidebar-subnav-link ${isActive ? 'active' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={closeMenu}
                      >
                        {item.nama}
                      </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* KELOMPOK MENU PELANGGARAN (COLLAPSIBLE) */}
          {['Admin', 'Keamanan', 'Pembina Kamar', 'Pengasuh'].includes(user.jabatan) && (
            <div className="sidebar-master-menu">
              <button
                type="button"
                aria-label="Buka atau tutup menu Pelanggaran"
                aria-expanded={isPelanggaranMenuOpen}
                aria-controls="pelanggaran-subnav"
                className={`sidebar-nav-link sidebar-master-trigger ${location.pathname.startsWith('/pelanggaran') ? 'active' : ''}`}
                onClick={togglePelanggaranMenu}
              >
                <span className="nav-label"><NavIcon name="warning"/><span>Pelanggaran</span></span>
                <span aria-hidden="true">{isPelanggaranMenuOpen ? '⌃' : '⌄'}</span>
              </button>
              <div id="pelanggaran-subnav" className={`sidebar-subnav ${isPelanggaranMenuOpen ? 'open' : 'closed'}`} aria-hidden={!isPelanggaranMenuOpen}>
                  {['Admin', 'Keamanan', 'Pembina Kamar'].includes(user.jabatan) && (
                    <Link
                      to="/pelanggaran/baru"
                      className={`sidebar-subnav-link ${location.pathname === '/pelanggaran/baru' ? 'active' : ''}`}
                      aria-current={location.pathname === '/pelanggaran/baru' ? 'page' : undefined}
                      onClick={closeMenu}
                    >
                      Input Pelanggaran
                    </Link>
                  )}
                  <Link
                    to="/pelanggaran/semua"
                    className={`sidebar-subnav-link ${location.pathname === '/pelanggaran/semua' || location.pathname === '/pelanggaran' ? 'active' : ''}`}
                    aria-current={location.pathname === '/pelanggaran/semua' || location.pathname === '/pelanggaran' ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    Daftar Pelanggaran
                  </Link>
              </div>
            </div>
          )}

          {['Admin', 'Keamanan', 'Pembina Kamar', 'Pengasuh'].includes(user.jabatan) && (
            <Link
              to="/prestasi/semua"
              className={`sidebar-nav-link ${location.pathname.startsWith('/prestasi') ? 'active' : ''}`}
              aria-current={location.pathname.startsWith('/prestasi') ? 'page' : undefined}
              onClick={closeMenu}
            >
              <NavIcon name="report"/><span>Prestasi</span>
            </Link>
          )}

          {/* KELOMPOK MENU PERIZINAN & GERBANG (COLLAPSIBLE) */}
          {['Admin', 'Keamanan', 'Pengasuh'].includes(user.jabatan) && (
            <div className="sidebar-master-menu">
              <button
                type="button"
                aria-label="Buka atau tutup menu Perizinan dan Gerbang"
                aria-expanded={isPerizinanMenuOpen}
                aria-controls="perizinan-subnav"
                className={`sidebar-nav-link sidebar-master-trigger ${location.pathname.startsWith('/perizinan') || location.pathname === '/catat-gerbang' ? 'active' : ''}`}
                onClick={togglePerizinanMenu}
              >
                <span className="nav-label"><NavIcon name="gate"/><span>Perizinan & Gerbang</span></span>
                <span aria-hidden="true">{isPerizinanMenuOpen ? '⌃' : '⌄'}</span>
              </button>
              <div id="perizinan-subnav" className={`sidebar-subnav ${isPerizinanMenuOpen ? 'open' : 'closed'}`} aria-hidden={!isPerizinanMenuOpen}>
                  {['Admin', 'Keamanan'].includes(user.jabatan) && (
                    <Link
                      to="/catat-gerbang"
                      className={`sidebar-subnav-link ${location.pathname === '/catat-gerbang' ? 'active' : ''}`}
                      aria-current={location.pathname === '/catat-gerbang' ? 'page' : undefined}
                      onClick={closeMenu}
                    >
                      Catat Izin & Gerbang
                    </Link>
                  )}
                  <Link
                    to="/perizinan/semua"
                    className={`sidebar-subnav-link ${location.pathname === '/perizinan/semua' || location.pathname === '/perizinan' ? 'active' : ''}`}
                    aria-current={location.pathname === '/perizinan/semua' || location.pathname === '/perizinan' ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    Daftar Perizinan
                  </Link>
              </div>
            </div>
          )}

          {['Admin', 'Wali Kelas'].includes(user.jabatan) && (
            <Link to="/rekap-kelas" className={`sidebar-nav-link ${location.pathname === '/rekap-kelas' ? 'active' : ''}`} aria-current={location.pathname === '/rekap-kelas' ? 'page' : undefined} onClick={closeMenu}><NavIcon name="report"/><span>Rekap Kelas</span></Link>
          )}

          {/* KELOMPOK MENU RAPORT PENGAJIAN (COLLAPSIBLE) */}
          {Boolean(user) && (
            <div className="sidebar-master-menu">
              <button
                type="button"
                aria-label="Buka atau tutup menu Raport Pengajian"
                aria-expanded={isRaportMenuOpen}
                aria-controls="raport-subnav"
                className={`sidebar-nav-link sidebar-master-trigger ${location.pathname.startsWith('/raport') ? 'active' : ''}`}
                onClick={toggleRaportMenu}
              >
                <span className="nav-label"><NavIcon name="raport"/><span>Raport Pengajian</span></span>
                <span aria-hidden="true">{isRaportMenuOpen ? '⌃' : '⌄'}</span>
              </button>
              <div id="raport-subnav" className={`sidebar-subnav ${isRaportMenuOpen ? 'open' : 'closed'}`} aria-hidden={!isRaportMenuOpen}>
                  {['Admin', 'Ustadz'].includes(user.jabatan) && (
                    <Link
                      to="/raport/input"
                      className={`sidebar-subnav-link ${location.pathname === '/raport/input' ? 'active' : ''}`}
                      aria-current={location.pathname === '/raport/input' ? 'page' : undefined}
                      onClick={closeMenu}
                    >
                      Input Raport
                    </Link>
                  )}
                  <Link
                    to="/raport/lihat"
                    className={`sidebar-subnav-link ${location.pathname === '/raport/lihat' ? 'active' : ''}`}
                    aria-current={location.pathname === '/raport/lihat' ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    Lihat Raport
                  </Link>
              </div>
            </div>
          )}

          {/* KELOMPOK MENU UBUDIYAH (COLLAPSIBLE) */}
          {['Admin', 'Pembina Kamar', 'Pengasuh'].includes(user.jabatan) && (
            <div className="sidebar-master-menu">
              <button
                type="button"
                aria-label="Buka atau tutup menu Ubudiyah"
                aria-expanded={isUbudiyahMenuOpen}
                aria-controls="ubudiyah-subnav"
                className={`sidebar-nav-link sidebar-master-trigger ${location.pathname.startsWith('/ubudiyah') ? 'active' : ''}`}
                onClick={toggleUbudiyahMenu}
              >
                <span className="nav-label"><NavIcon name="ubudiyah"/><span>Menu Ubudiyah</span></span>
                <span aria-hidden="true">{isUbudiyahMenuOpen ? '⌃' : '⌄'}</span>
              </button>
              <div id="ubudiyah-subnav" className={`sidebar-subnav ${isUbudiyahMenuOpen ? 'open' : 'closed'}`} aria-hidden={!isUbudiyahMenuOpen}>
                {!ubudiyahReady && <p className="sidebar-subnav-notice" role="status">Modul belum siap</p>}
                {ubudiyahReady && <>
                  {['Admin', 'Pembina Kamar'].includes(user.jabatan) && (
                    <Link
                      to="/ubudiyah/input"
                      className={`sidebar-subnav-link ${location.pathname === '/ubudiyah/input' ? 'active' : ''}`}
                      aria-current={location.pathname === '/ubudiyah/input' ? 'page' : undefined}
                      onClick={closeMenu}
                    >
                      Input Ubudiyah
                    </Link>
                  )}
                  <Link
                    to="/ubudiyah/lihat"
                    className={`sidebar-subnav-link ${location.pathname === '/ubudiyah/lihat' ? 'active' : ''}`}
                    aria-current={location.pathname === '/ubudiyah/lihat' ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    Lihat Ubudiyah
                  </Link>
                  {['Admin', 'Pembina Kamar'].includes(user.jabatan) && (
                    <Link
                      to="/ubudiyah/master"
                      className={`sidebar-subnav-link ${location.pathname === '/ubudiyah/master' ? 'active' : ''}`}
                      aria-current={location.pathname === '/ubudiyah/master' ? 'page' : undefined}
                      onClick={closeMenu}
                    >
                      Master Kriteria
                    </Link>
                  )}
                </>}
              </div>
            </div>
          )}

          {user.jabatan === 'Admin' && (
            <div className="sidebar-master-menu">
              <button type="button" aria-label="Buka atau tutup Verifikasi Data" aria-expanded={isVerificationMenuOpen} aria-controls="verification-subnav" className={`sidebar-nav-link sidebar-master-trigger ${location.pathname.startsWith('/verifikasi-data') ? 'active' : ''}`} onClick={toggleVerificationMenu}>
                <span className="nav-label"><NavIcon name="verify"/><span>Verifikasi Data</span>{hasVerificationAttention && <span className="nav-attention-dot" aria-label="Masih ada antrean verifikasi"/>}</span>
                <span aria-hidden="true">{isVerificationMenuOpen ? '⌃' : '⌄'}</span>
              </button>
              <div id="verification-subnav" className={`sidebar-subnav ${isVerificationMenuOpen ? 'open' : 'closed'}`} aria-hidden={!isVerificationMenuOpen}>
                <Link to="/verifikasi-data/santri" className={`sidebar-subnav-link ${location.pathname === '/verifikasi-data/santri' ? 'active' : ''}`} onClick={closeMenu}>Verifikasi data santri{verificationAttention.santri > 0 && <span className="nav-attention-dot" aria-label={`${verificationAttention.santri} data perlu diverifikasi`}/>}</Link>
                <Link to="/verifikasi-data/orda" className={`sidebar-subnav-link ${location.pathname === '/verifikasi-data/orda' ? 'active' : ''}`} onClick={closeMenu}>Verifikasi ORDA{verificationAttention.orda > 0 && <span className="nav-attention-dot" aria-label={`${verificationAttention.orda} ORDA perlu diverifikasi`}/>}</Link>
                <Link to="/verifikasi-data/kamar" className={`sidebar-subnav-link ${location.pathname === '/verifikasi-data/kamar' ? 'active' : ''}`} onClick={closeMenu}>Verifikasi data kamar{verificationAttention.kamar > 0 && <span className="nav-attention-dot" aria-label={`${verificationAttention.kamar} mapping kamar perlu diverifikasi`}/>}</Link>
                <Link to="/verifikasi-data/review" className={`sidebar-subnav-link ${location.pathname === '/verifikasi-data/review' ? 'active' : ''}`} onClick={closeMenu}>Review kemiripan data{verificationAttention.review > 0 && <span className="nav-attention-dot" aria-label={`${verificationAttention.review} kemiripan data perlu diverifikasi`}/>}</Link>
              </div>
            </div>
          )}

          {user.jabatan === 'Admin' && (
            <div className="sidebar-master-menu">
              <button
                type="button"
                aria-label="Buka atau tutup Data Master"
                aria-expanded={isMasterMenuOpen}
                aria-controls="master-subnav"
                className={`sidebar-nav-link sidebar-master-trigger ${location.pathname.startsWith('/data-master') ? 'active' : ''}`}
                onClick={toggleMasterMenu}
              >
                <span className="nav-label"><NavIcon name="database"/><span>Data Master</span></span>
                <span aria-hidden="true">{isMasterMenuOpen ? '⌃' : '⌄'}</span>
              </button>
              <div id="master-subnav" className={`sidebar-subnav ${isMasterMenuOpen ? 'open' : 'closed'}`} aria-hidden={!isMasterMenuOpen}>
                <Link to="/data-master/santri" className={`sidebar-subnav-link ${location.pathname === '/data-master/santri' ? 'active' : ''}`} aria-current={location.pathname === '/data-master/santri' ? 'page' : undefined} onClick={closeMenu}>Data santri</Link>
                <Link to="/data-master/alumni" className={`sidebar-subnav-link ${location.pathname === '/data-master/alumni' ? 'active' : ''}`} aria-current={location.pathname === '/data-master/alumni' ? 'page' : undefined} onClick={closeMenu}>Data alumni</Link>
                <Link to="/data-master/organisasi-daerah" className={`sidebar-subnav-link ${location.pathname === '/data-master/organisasi-daerah' ? 'active' : ''}`} onClick={closeMenu}>Data ORDA</Link>
                <Link to="/data-master/ekstrakurikuler" className={`sidebar-subnav-link ${location.pathname === '/data-master/ekstrakurikuler' ? 'active' : ''}`} onClick={closeMenu}>Data ekstrakurikuler</Link>
                <Link to="/data-master/wisma" className={`sidebar-subnav-link ${location.pathname === '/data-master/wisma' ? 'active' : ''}`} onClick={closeMenu}>Data wisma</Link>
                <Link to="/data-master/penugasan" className={`sidebar-subnav-link ${location.pathname === '/data-master/penugasan' ? 'active' : ''}`} onClick={closeMenu}>Penugasan absensi</Link>
                <Link to="/data-master/akun" className={`sidebar-subnav-link ${location.pathname === '/data-master/akun' ? 'active' : ''}`} onClick={closeMenu}>Akun petugas</Link>
              </div>
            </div>
          )}

          {['Admin', 'Pengasuh'].includes(user.jabatan) && (
            <Link to="/laporan/detail" className={`sidebar-nav-link ${location.pathname === '/laporan/detail' ? 'active' : ''}`} aria-current={location.pathname === '/laporan/detail' ? 'page' : undefined} onClick={closeMenu}><NavIcon name="report"/><span>Laporan Detail</span></Link>
          )}

          <Link to="/ganti-kata-sandi" className={`sidebar-nav-link ${location.pathname === '/ganti-kata-sandi' ? 'active' : ''}`} aria-current={location.pathname === '/ganti-kata-sandi' ? 'page' : undefined} onClick={closeMenu}><NavIcon name="lock"/><span>Ganti Password</span></Link>

        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
          <button onClick={logout} className="sidebar-logout-btn">
            <NavIcon name="logout"/> Keluar
          </button>
        </div>
      </div>

      <main className="dashboard-content">
        <Suspense fallback={<PageSkeleton rows={6} />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/absensi-kegiatan/:jenis" element={<DashboardPage />} />

            <Route path="/pelanggaran" element={<Navigate to="/pelanggaran/semua" replace />} />
            <Route path="/pelanggaran/semua" element={<PelanggaranListPage />} />
            <Route path="/pelanggaran/baru" element={<PelanggaranFormPage />} />
            <Route path="/prestasi" element={<Navigate to="/prestasi/semua" replace />} />
            <Route path="/prestasi/semua" element={<PrestasiListPage />} />

            <Route path="/perizinan" element={<Navigate to="/perizinan/semua" replace />} />
            <Route path="/perizinan/semua" element={['Admin', 'Keamanan', 'Pengasuh'].includes(user.jabatan) ? <PerizinanListPage /> : <Navigate to="/dashboard" />} />
            <Route path="/catat-gerbang" element={
              ['Admin', 'Keamanan'].includes(user.jabatan)
                ? <CatatGerbangPage />
                : <Navigate to="/dashboard" />
            } />

            <Route path="/ganti-kata-sandi" element={<GantiPasswordPage />} />

            {/* Protected Routes based on Jabatan */}
            <Route path="/absensi/:jenis/:id" element={<BulkInputPage />} />
            <Route path="/rekap-kelas" element={['Admin', 'Wali Kelas'].includes(user.jabatan) ? <RekapKelasPage /> : <Navigate to="/dashboard" />} />

            <Route path="/raport/input" element={
              ['Admin', 'Ustadz'].includes(user.jabatan)
                ? <RaportInputPage />
                : <Navigate to="/dashboard" />
            } />
            <Route path="/raport/lihat" element={<RaportViewPage />} />

            <Route path="/ubudiyah/input" element={
              ['Admin', 'Pembina Kamar'].includes(user.jabatan)
                ? <UbudiyahFormPage />
                : <Navigate to="/dashboard" />
            } />
            <Route path="/ubudiyah/lihat" element={
              ['Admin', 'Pembina Kamar', 'Pengasuh'].includes(user.jabatan)
                ? <UbudiyahViewPage />
                : <Navigate to="/dashboard" />
            } />
            <Route path="/ubudiyah/master" element={
              ['Admin', 'Pembina Kamar'].includes(user.jabatan)
                ? <UbudiyahMasterPage />
                : <Navigate to="/dashboard" />
            } />

            <Route path="/data-master" element={
              user.jabatan === 'Admin'
                ? <Navigate to="/data-master/santri" replace />
                : <Navigate to="/dashboard" />
            } />
            <Route path="/verifikasi-data" element={user.jabatan === 'Admin' ? <Navigate to="/verifikasi-data/santri" replace /> : <Navigate to="/dashboard" />} />
            <Route path="/verifikasi-data/:tab" element={user.jabatan === 'Admin' ? <DataMasterPage /> : <Navigate to="/dashboard" />} />
            <Route path="/data-master/:tab" element={
              user.jabatan === 'Admin'
                ? <DataMasterPage />
                : <Navigate to="/dashboard" />
            } />

            <Route path="/laporan/detail" element={
              ['Admin', 'Pengasuh'].includes(user.jabatan)
                ? <LaporanPage />
                : <Navigate to="/dashboard" />
            } />

            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Suspense>
      </main>

      <nav className={`mobile-bottom-nav ${isNavVisible ? 'is-visible' : 'is-hidden'}`} aria-label="Navigasi mobile">
        <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''} aria-current={location.pathname === '/dashboard' ? 'page' : undefined} onClick={closeMenu}>
          <NavIcon name="home"/><span>Beranda</span>
        </Link>

        {['Admin', 'Wali Kelas'].includes(user.jabatan) && (
          <Link to="/rekap-kelas" className={location.pathname === '/rekap-kelas' ? 'active' : ''} aria-current={location.pathname === '/rekap-kelas' ? 'page' : undefined} onClick={closeMenu}>
            <NavIcon name="report"/><span>Rekap</span>
          </Link>
        )}

        {['Admin', 'Keamanan', 'Pembina Kamar', 'Pengasuh'].includes(user.jabatan) && (
          <Link to="/pelanggaran/semua" className={location.pathname.startsWith('/pelanggaran') ? 'active' : ''} aria-current={location.pathname.startsWith('/pelanggaran') ? 'page' : undefined} onClick={closeMenu}>
            <NavIcon name="warning"/><span>Pelanggaran</span>
          </Link>
        )}

        {['Admin', 'Keamanan', 'Pengasuh'].includes(user.jabatan) && (
          <Link to="/perizinan/semua" className={location.pathname.startsWith('/perizinan') || location.pathname === '/catat-gerbang' ? 'active' : ''} aria-current={location.pathname.startsWith('/perizinan') || location.pathname === '/catat-gerbang' ? 'page' : undefined} onClick={closeMenu}>
            <NavIcon name="gate"/><span>Perizinan</span>
          </Link>
        )}

        {['Admin', 'Pengasuh'].includes(user.jabatan) && (
          <Link to="/laporan/detail" className={location.pathname === '/laporan/detail' ? 'active' : ''} aria-current={location.pathname === '/laporan/detail' ? 'page' : undefined} onClick={closeMenu}>
            <NavIcon name="report"/><span>Laporan</span>
          </Link>
        )}

        <Link to="/raport/lihat" className={location.pathname.startsWith('/raport') ? 'active' : ''} aria-current={location.pathname.startsWith('/raport') ? 'page' : undefined} onClick={closeMenu}>
          <NavIcon name="raport"/><span>Raport</span>
        </Link>

        <button type="button" aria-label="Buka menu navigasi" aria-expanded={isMobileMenuOpen} aria-controls="primary-navigation" className={isMobileMenuOpen ? 'active' : ''} onClick={openMenu}>
          <NavIcon name="more"/><span>Menu</span>
        </button>
      </nav>
    </div>
  );
}

function AppRouter() {
  const location = useRouterLocation();
  if (location.pathname === '/' || location.pathname === '/pilih-login') return <RoleLoginSelectionPage />;
  return location.pathname.startsWith('/portal-santri') ? <SantriPortalPage /> : <Layout />;
}

export default AppRouter;
