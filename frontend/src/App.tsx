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
const DataMasterPage = lazy(() => import('./pages/DataMasterPage').then(module => ({ default: module.DataMasterPage })));
const LaporanPage = lazy(() => import('./pages/LaporanPage').then(module => ({ default: module.LaporanPage })));
const GantiPasswordPage = lazy(() => import('./pages/GantiPasswordPage').then(module => ({ default: module.GantiPasswordPage })));
const RaportLandingPage = lazy(() => import('./pages/RaportLandingPage').then(module => ({ default: module.RaportLandingPage })));
const RaportInputPage = lazy(() => import('./pages/RaportInputPage').then(module => ({ default: module.RaportInputPage })));
const RaportViewPage = lazy(() => import('./pages/RaportViewPage').then(module => ({ default: module.RaportViewPage })));
const UbudiyahLandingPage = lazy(() => import('./pages/UbudiyahLandingPage').then(module => ({ default: module.UbudiyahLandingPage })));
const UbudiyahFormPage = lazy(() => import('./pages/UbudiyahFormPage').then(module => ({ default: module.UbudiyahFormPage })));
const UbudiyahViewPage = lazy(() => import('./pages/UbudiyahViewPage').then(module => ({ default: module.UbudiyahViewPage })));
const UbudiyahMasterPage = lazy(() => import('./pages/UbudiyahMasterPage').then(module => ({ default: module.UbudiyahMasterPage })));
const PeriodeAkademikPage = lazy(() => import('./pages/PeriodeAkademikPage').then(module => ({ default: module.PeriodeAkademikPage })));
const AbsensiHistoryPage = lazy(() => import('./pages/AbsensiHistoryPage').then(module => ({ default: module.AbsensiHistoryPage })));
const PelanggaranMasterPage = lazy(() => import('./pages/PelanggaranMasterPage').then(module => ({ default: module.PelanggaranMasterPage })));
const RaportMasterPage = lazy(() => import('./pages/RaportMasterPage').then(module => ({ default: module.RaportMasterPage })));
const JadwalAbsensiMasterPage = lazy(() => import('./pages/JadwalAbsensiMasterPage').then(module => ({ default: module.JadwalAbsensiMasterPage })));

type IconName = 'home' | 'school' | 'room' | 'quran' | 'madin' | 'takhasus' | 'warning' | 'verify' | 'gate' | 'database' | 'report' | 'lock' | 'menu' | 'logout' | 'more' | 'raport' | 'ubudiyah' | 'management';

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
  keberangkatan: { nama: 'Absensi Kamar Pagi', icon: 'room' },
  kamar: { nama: 'Absensi Kamar Malam', icon: 'room' },
  pbs: { nama: 'Absensi Al-Qur\'an Subuh', icon: 'quran' },
  diniyah: { nama: 'Absensi Kelas Madin', icon: 'madin' },
  pbm: { nama: 'Absensi Takhasus Maghrib', icon: 'takhasus' },
};

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: (
      <path d="M39.5,43h-9c-1.381,0-2.5-1.119-2.5-2.5v-9c0-1.105-0.895-2-2-2h-4c-1.105,0-2,0.895-2,2v9c0,1.381-1.119,2.5-2.5,2.5h-9 C7.119,43,6,41.881,6,40.5V21.413c0-2.299,1.054-4.471,2.859-5.893L23.071,4.321c0.545-0.428,1.313-0.428,1.857,0L39.142,15.52 C40.947,16.942,42,19.113,42,21.411V40.5C42,41.881,40.881,43,39.5,43z" />
    ),
    quran: (
      <>
        <path d="M21.5,13.2 C15.5,10.8 9.5,11.2 6.8,11.6 C5.2,11.9 4,13.2 4,14.8 L4,34.2 C4,35.9 5.4,37.3 7.1,37.1 C10.2,36.6 16.2,36.2 21.5,38.8 Z" />
        <path d="M26.5,13.2 C32.5,10.8 38.5,11.2 41.2,11.6 C42.8,11.9 44,13.2 44,14.8 L44,34.2 C44,35.9 42.6,37.3 40.9,37.1 C37.8,36.6 31.8,36.2 26.5,38.8 Z" />
        <path d="M23,10 h2 v13 l-1,-1.5 l-1,1.5 Z" />
      </>
    ),
    warning: (
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M21.5,5.8 L4.2,36.8 C2.9,39.1 4.6,42 7.2,42 L40.8,42 C43.4,42 45.1,39.1 43.8,36.8 L26.5,5.8 C25.2,3.5 22.8,3.5 21.5,5.8 Z M21.5,18 C21.5,16.6 22.6,15.5 24,15.5 C25.4,15.5 26.5,16.6 26.5,18 L26,28 C26,29.1 25.1,30 24,30 C22.9,30 22,29.1 22,28 Z M24,33 C25.4,33 26.5,34.1 26.5,35.5 C26.5,36.9 25.4,38 24,38 C22.6,38 21.5,36.9 21.5,35.5 C21.5,34.1 22.6,33 24,33 Z"
      />
    ),
    report: (
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11,5 C9.3,5 8,6.3 8,8 L8,40 C8,41.7 9.3,43 11,43 L37,43 C38.7,43 40,41.7 40,40 L40,16 L29,5 Z M30,5 L30,14 C30,15.1 30.9,16 32,16 L40,16 Z M14,30.5 C14,29.7 14.7,29 15.5,29 L18,29 C18.8,29 19.5,29.7 19.5,30.5 L19.5,37.5 L14,37.5 Z M21.2,25 C21.2,24.2 21.9,23.5 22.7,23.5 L25.2,23.5 C26,23.5 26.7,24.2 26.7,25 L26.7,37.5 L21.2,37.5 Z M28.5,19 C28.5,18.2 29.2,17.5 30,17.5 L32.5,17.5 C33.3,17.5 34,18.2 34,19 L34,37.5 L28.5,37.5 Z"
      />
    ),
    gate: (
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M24,4 L5,13 L5,17 L43,17 L43,13 Z M7,19 L7,43 L16.5,43 L16.5,28 C16.5,23.9 19.9,20.5 24,20.5 C28.1,20.5 31.5,23.9 31.5,28 L31.5,43 L41,43 L41,19 Z"
      />
    ),
    raport: (
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11,5 C9.3,5 8,6.3 8,8 L8,40 C8,41.7 9.3,43 11,43 L37,43 C38.7,43 40,41.7 40,40 L40,16 L29,5 Z M30,5 L30,14 C30,15.1 30.9,16 32,16 L40,16 Z M14,22 C14,21.2 14.7,20.5 15.5,20.5 L26,20.5 C26.8,20.5 27.5,21.2 27.5,22 C27.5,22.8 26.8,23.5 26,23.5 L15.5,23.5 C14.7,23.5 14,22.8 14,22 Z M14,28 C14,27.2 14.7,26.5 15.5,26.5 L33.5,26.5 C34.3,26.5 35,27.2 35,28 C35,28.8 34.3,29.5 33.5,29.5 L15.5,29.5 C14.7,29.5 14,28.8 14,28 Z M14,34 C14,33.2 14.7,32.5 15.5,32.5 L33.5,32.5 C34.3,32.5 35,33.2 35,34 C35,34.8 34.3,35.5 33.5,35.5 L15.5,35.5 C14.7,35.5 14,34.8 14,34 Z"
      />
    ),
    ubudiyah: (
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18,4 C16.3,4 15,5.3 15,7 L12,7 C9.8,7 8,8.8 8,11 L8,40 C8,42.2 9.8,44 12,44 L36,44 C38.2,44 40,42.2 40,40 L40,11 C40,8.8 38.2,7 36,7 L33,7 C33,5.3 31.7,4 30,4 L18,4 Z M18,7 L30,7 L30,9 L18,9 L18,7 Z M12,10 L15,10 L15,11 C15,12.1 15.9,13 17,13 L31,13 C32.1,13 33,12.1 33,11 L33,10 L36,10 C36.6,10 37,10.4 37,11 L37,40 C37,40.6 36.6,41 36,41 L12,41 C11.4,41 11,40.6 11,40 L11,11 C11,10.4 11.4,10 12,10 Z M21.2,28.8 C20.4,28 19.1,28 18.3,28.8 C17.5,29.6 17.5,30.9 18.3,31.7 L22.3,35.7 C23.1,36.5 24.4,36.5 25.2,35.7 L33.2,27.7 C34,26.9 34,25.6 33.2,24.8 C32.4,24 31.1,24 30.3,24.8 L23.7,31.4 L21.2,28.8 Z"
      />
    ),
    verify: (
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M24,4 C13,4 4,13 4,24 C4,35 13,44 24,44 C35,44 44,35 44,24 C44,13 35,4 24,4 Z M20.9,33.1 C20.3,33.7 19.3,33.7 18.7,33.1 L12.9,27.3 C12.3,26.7 12.3,25.7 12.9,25.1 C13.5,24.5 14.5,24.5 15.1,25.1 L19.8,29.8 L32.9,16.7 C33.5,16.1 34.5,16.1 35.1,16.7 C35.7,17.3 35.7,18.3 35.1,18.9 L20.9,33.1 Z"
      />
    ),
    database: (
      <path d="M40,11 C40,7.7 32.8,5 24,5 C15.2,5 8,7.7 8,11 L8,37 C8,40.3 15.2,43 24,43 C32.8,43 40,40.3 40,37 Z M24,8 C31.2,8 37,9.8 37,11 C37,12.2 31.2,14 24,14 C16.8,14 11,12.2 11,11 C11,9.8 16.8,8 24,8 Z M11,19 C14.3,21.2 19,22 24,22 C29,22 33.7,21.2 37,19 L37,23 C37,25.2 31.2,27 24,27 C16.8,27 11,25.2 11,23 Z M11,31 C14.3,33.2 19,34 24,34 C29,34 33.7,33.2 37,31 L37,36 C37,38.2 31.2,40 24,40 C16.8,40 11,38.2 11,36 Z" />
    ),
    lock: (
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16,18 L16,13 C16,8.6 19.6,5 24,5 C28.4,5 32,8.6 32,13 L32,18 L35,18 C36.7,18 38,19.3 38,21 L38,40 C38,41.7 36.7,43 35,43 L13,43 C11.3,43 10,41.7 10,40 L10,21 C10,19.3 11.3,18 13,18 Z M20.5,18 L27.5,18 L27.5,13 C27.5,11.1 25.9,9.5 24,9.5 C22.1,9.5 20.5,11.1 20.5,13 Z M24,26 C22.3,26 21,27.3 21,29 C21,30.2 21.7,31.2 22.7,31.7 L22.2,36 C22.1,36.6 22.5,37 23,37 L25,37 C25.5,37 25.9,36.6 25.8,36 L25.3,31.7 C26.3,31.2 27,30.2 27,29 C27,27.3 25.7,26 24,26 Z"
      />
    ),
    logout: (
      <path d="M10,8 C10,6.3 11.3,5 13,5 L24,5 C25.7,5 27,6.3 27,8 L27,13 L22.5,13 L22.5,9.5 L14.5,9.5 L14.5,38.5 L22.5,38.5 L22.5,35 L27,35 L27,40 C27,41.7 25.7,43 24,43 L13,43 C11.3,43 10,41.7 10,40 Z M28,21.5 L28,16 L39.5,24 L28,32 L28,26.5 L19,26.5 L19,21.5 Z" />
    ),
    school: (
      <>
        <path d="M24,7 L4,17 L24,27 L44,17 Z" />
        <path d="M11,23.5 L11,33 C11,37.5 16.8,41 24,41 C31.2,41 37,37.5 37,33 L37,23.5 L33,25.5 L33,32 C33,34.5 29,37 24,37 C19,37 15,34.5 15,32 L15,25.5 Z" />
        <path d="M40.5,19 L40.5,33 C39.5,33.5 39,34.5 39,35.5 C39,37 40.2,38 41.5,38 C42.8,38 44,37 44,35.5 C44,34.5 43.5,33.5 42.5,33 L42.5,18 Z" />
      </>
    ),
    room: (
      <path d="M6,13 C6,11.3 7.3,10 9,10 L11,10 C12.7,10 14,11.3 14,13 L14,22 L34,22 L34,13 C34,11.3 35.3,10 37,10 L39,10 C40.7,10 42,11.3 42,13 L42,37 L38,37 L38,33 L10,33 L10,37 L6,37 Z M14,24 L34,24 C35.7,24 37,25.3 37,27 L37,30 L11,30 L11,27 C11,25.3 12.3,24 14,24 Z M13,16 C13,14.9 13.9,14 15,14 L20,14 C21.1,14 22,14.9 22,16 L22,20 L13,20 Z M26,16 C26,14.9 26.9,14 28,14 L33,14 C34.1,14 35,14.9 35,16 L35,20 L26,20 Z" />
    ),
    madin: (
      <path d="M9,5 C7.3,5 6,6.3 6,8 L6,40 C6,41.7 7.3,43 9,43 L37,43 C39.8,43 42,40.8 42,38 L42,8 C42,6.3 40.7,5 39,5 L9,5 Z M37,39 L10,39 C9.4,39 9,38.6 9,38 C9,37.4 9.4,37 10,37 L37,37 C38.1,37 39,37.9 39,39 C38.4,39 37.7,39 37,39 Z M14,13 H34 V16 H14 Z M14,20 H34 V23 H14 Z M14,27 H28 V30 H14 Z" />
    ),
    takhasus: (
      <>
        <path d="M26.5,5 C15.7,5 7,13.7 7,24.5 C7,35.3 15.7,44 26.5,44 C33.1,44 38.9,40.7 42.4,35.7 C33.2,36.5 25.2,29.3 25.2,20 C25.2,13.6 28.5,8 33.6,5.3 C31.3,5.1 28.9,5 26.5,5 Z" />
        <path d="M37,13 L38.5,17.5 L43,17.5 L39.5,20 L41,24.5 L37,22 L33,24.5 L34.5,20 L31,17.5 L35.5,17.5 Z" />
      </>
    ),
    menu: (
      <path d="M6,10 C6,8.9 6.9,8 8,8 L40,8 C41.1,8 42,8.9 42,10 C42,11.1 41.1,12 40,12 L8,12 C6.9,12 6,11.1 6,10 Z M6,24 C6,22.9 6.9,22 8,22 L40,22 C41.1,22 42,22.9 42,24 C42,25.1 41.1,26 40,26 L8,26 C6.9,26 6,25.1 6,24 Z M6,38 C6,36.9 6.9,36 8,36 L40,36 C41.1,36 42,36.9 42,38 C42,39.1 41.1,40 40,40 L8,40 C6.9,40 6,39.1 6,38 Z" />
    ),
    more: (
      <path d="M12,24 C12,21.8 13.8,20 16,20 C18.2,20 20,21.8 20,24 C20,26.2 18.2,28 16,28 C13.8,28 12,26.2 12,24 Z M22,24 C22,21.8 23.8,20 26,20 C28.2,20 30,21.8 30,24 C30,26.2 28.2,28 26,28 C23.8,28 22,26.2 22,24 Z M32,24 C32,21.8 33.8,20 36,20 C38.2,20 40,21.8 40,24 C40,26.2 38.2,28 36,28 C33.8,28 32,26.2 32,24 Z" />
    ),
    management: (
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6,13 C6,11.9 6.9,11 8,11 L14,11 L14,7 C14,5.9 14.9,5 16,5 L20,5 C21.1,5 22,5.9 22,7 L22,11 L40,11 C41.1,11 42,11.9 42,13 C42,14.1 41.1,15 40,15 L22,15 L22,19 C22,20.1 21.1,21 20,21 L16,21 C14.9,21 14,20.1 14,19 L14,15 L8,15 C6.9,15 6,14.1 6,13 Z M6,35 C6,33.9 6.9,33 8,33 L26,33 L26,29 C26,27.9 26.9,27 28,27 L32,27 C33.1,27 34,27.9 34,29 L34,33 L40,33 C41.1,33 42,33.9 42,35 C42,36.1 41.1,37 40,37 L34,37 L34,41 C34,42.1 33.1,43 32,43 L28,43 C26.9,43 26,42.1 26,41 L26,37 L8,37 C6.9,37 6,36.1 6,35 Z"
      />
    ),
  };

  return (
    <svg
      className={`nav-icon nav-icon-${name}`}
      aria-hidden="true"
      viewBox="0 0 48 48"
      fill="currentColor"
    >
      {paths[name]}
    </svg>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <span className={`sidebar-chevron ${isOpen ? 'open' : ''}`} aria-hidden="true">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </span>
  );
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

  const isAttendanceRosterPage = location.pathname.startsWith('/absensi/');

  const railRef = useRef<HTMLElement>(null);
  const unhoverTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;

    const handleMouseEnter = () => {
      if (window.matchMedia('(max-width: 768px)').matches) return;
      if (unhoverTimerRef.current) {
        window.clearTimeout(unhoverTimerRef.current);
        unhoverTimerRef.current = null;
      }
      el.classList.add('is-hovered');
    };

    const handleMouseLeave = () => {
      if (unhoverTimerRef.current) {
        window.clearTimeout(unhoverTimerRef.current);
      }
      unhoverTimerRef.current = window.setTimeout(() => {
        el.classList.remove('is-hovered');
      }, 380);
    };

    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (unhoverTimerRef.current) {
        window.clearTimeout(unhoverTimerRef.current);
      }
      el.removeEventListener('mouseenter', handleMouseEnter);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

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
  const [isPelanggaranMenuOpen, setIsPelanggaranMenuOpen] = useState(() => location.pathname.startsWith('/pelanggaran') && location.pathname !== '/pelanggaran/master');
  const isManagementRoute = location.pathname === '/data-master/jadwal-absensi'
    || location.pathname === '/absensi/jadwal'
    || location.pathname === '/pelanggaran/master'
    || location.pathname === '/ubudiyah/master'
    || location.pathname === '/raport/master'
    || location.pathname === '/data-master/penugasan'
    || location.pathname === '/data-master/akun'
    || location.pathname === '/data-master/wa-bot'
    || location.pathname === '/periode-akademik';
  const isMasterRoute = location.pathname.startsWith('/data-master') && !isManagementRoute;
  const [isMasterMenuOpen, setIsMasterMenuOpen] = useState(() => isMasterRoute);
  const [isRaportMenuOpen, setIsRaportMenuOpen] = useState(true);
  const [isVerificationMenuOpen, setIsVerificationMenuOpen] = useState(() => location.pathname.startsWith('/verifikasi-data'));
  const [isUbudiyahMenuOpen, setIsUbudiyahMenuOpen] = useState(() => location.pathname.startsWith('/ubudiyah') && location.pathname !== '/ubudiyah/master');
  const [isManagementMenuOpen, setIsManagementMenuOpen] = useState(() => isManagementRoute);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (location.pathname.startsWith('/pelanggaran') && location.pathname !== '/pelanggaran/master') {
      setIsPelanggaranMenuOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (isMasterRoute) {
      setIsMasterMenuOpen(true);
    }
  }, [isMasterRoute]);

  useEffect(() => {
    if (isManagementRoute) {
      setIsManagementMenuOpen(true);
    }
  }, [isManagementRoute]);

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
    requestAnimationFrame(() => mobileCloseButtonRef.current?.focus());
    const handleMenuKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = document.querySelectorAll<HTMLElement>('.premium-sidebar a, .premium-sidebar button');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
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
        setIsMasterMenuOpen(false);
        setIsVerificationMenuOpen(false);
        setIsUbudiyahMenuOpen(false);
        setIsManagementMenuOpen(false);
      }
      return next;
    });
  };
  const togglePelanggaranMenu = () => {
    setIsPelanggaranMenuOpen(open => {
      const next = !open;
      if (next) {
        setIsAbsensiMenuOpen(false);
        setIsMasterMenuOpen(false);
        setIsVerificationMenuOpen(false);
        setIsUbudiyahMenuOpen(false);
        setIsManagementMenuOpen(false);
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
        setIsRaportMenuOpen(false);
        setIsVerificationMenuOpen(false);
        setIsUbudiyahMenuOpen(false);
        setIsManagementMenuOpen(false);
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
        setIsMasterMenuOpen(false);
        setIsVerificationMenuOpen(false);
        setIsUbudiyahMenuOpen(false);
        setIsManagementMenuOpen(false);
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
        setIsMasterMenuOpen(false);
        setIsUbudiyahMenuOpen(false);
        setIsManagementMenuOpen(false);
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
        setIsMasterMenuOpen(false);
        setIsRaportMenuOpen(false);
        setIsVerificationMenuOpen(false);
        setIsManagementMenuOpen(false);
      }
      return next;
    });
  };
  const toggleManagementMenu = () => {
    setIsManagementMenuOpen(open => {
      const next = !open;
      if (next) {
        setIsAbsensiMenuOpen(false);
        setIsPelanggaranMenuOpen(false);
        setIsMasterMenuOpen(false);
        setIsRaportMenuOpen(false);
        setIsVerificationMenuOpen(false);
        setIsUbudiyahMenuOpen(false);
      }
      return next;
    });
  };

  const userAbsensiMenus = absensiOptions.map(opt => ({
    jenis: opt.jenis,
    nama: ABSENSI_CONFIG[opt.jenis]?.nama || opt.nama,
    icon: ABSENSI_CONFIG[opt.jenis]?.icon || 'home',
  }));

  if (isAttendanceRosterPage) {
    return (
      <div className="attendance-focus-layout">
        <main className="attendance-focus-main">
          <Suspense fallback={<PageSkeleton rows={8} />}>
            <Routes>
              <Route path="/absensi/:jenis/:id" element={<BulkInputPage />} />
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    );
  }

  return (
    <div className="premium-layout">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="mobile-brand"><span className="brand-mark"><img src="/simanteb-logo-transparent.png" alt="Logo SIMANTEB" /></span><div><h2 className="mobile-header-title">SIMANTEB</h2><small>Sistem Informasi Manajemen Tebu Ireng</small></div></div>
        <button ref={mobileMenuButtonRef} className="mobile-menu-btn" aria-label="Buka menu navigasi" aria-expanded={isMobileMenuOpen} aria-controls="primary-navigation" onClick={openMenu}>
          <NavIcon name="menu" />
        </button>
      </header>

      {/* Sidebar Overlay for Mobile */}
      <div className={`sidebar-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={closeMenu}></div>

      {/* Sidebar Rail / Layout Container for Desktop */}
      <aside ref={railRef} className={`sidebar-rail ${isMobileViewport ? '' : 'collapsed'}`}>
        <div
          className={`premium-sidebar ${isMobileMenuOpen ? 'open' : ''} ${isMobileViewport ? '' : 'collapsed'}`}
          aria-hidden={isMobileViewport && !isMobileMenuOpen ? true : undefined}
          inert={isMobileViewport && !isMobileMenuOpen ? true : undefined}
        >
          <div className="sidebar-header">
            <div className="sidebar-brand">
              <span className="brand-mark"><img src="/simanteb-logo-transparent.png" alt="Logo SIMANTEB" /></span>
              <div className="sidebar-brand-text">
                <h2 className="sidebar-title">SIMANTEB</h2>
                <p className="sidebar-subtitle">Sistem Informasi Manajemen Tebu Ireng</p>
              </div>
            </div>
            <div className="sidebar-header-actions">
              <button ref={mobileCloseButtonRef} className="mobile-close-btn" aria-label="Tutup menu navigasi" onClick={closeMenu}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
          <div className="sidebar-divider" aria-hidden="true" />

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
                className={`sidebar-nav-link sidebar-master-trigger ${(location.pathname.startsWith('/absensi-kegiatan') || location.pathname === '/absensi-histori' || location.pathname === '/rekap-kelas' || (location.pathname === '/dashboard' && !!currentJenis)) ? 'active' : ''}`}
                onClick={toggleAbsensiMenu}
              >
                <span className="nav-label"><NavIcon name="quran"/><span>Menu Absensi</span></span>
                <ChevronIcon isOpen={isAbsensiMenuOpen} />
              </button>
              <div id="absensi-subnav" className={`sidebar-subnav ${isAbsensiMenuOpen ? 'open' : 'closed'}`} aria-hidden={!isAbsensiMenuOpen}>
                <div className="sidebar-subnav-inner">
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
                  {['Admin', 'Pembina Kamar', 'Wali Kelas', 'Piket Pengajian'].includes(user.jabatan) && (
                    <Link
                      to="/absensi-histori"
                      className={`sidebar-subnav-link ${location.pathname === '/absensi-histori' || location.pathname === '/rekap-kelas' ? 'active' : ''}`}
                      aria-current={location.pathname === '/absensi-histori' || location.pathname === '/rekap-kelas' ? 'page' : undefined}
                      onClick={closeMenu}
                      style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', marginTop: 4, paddingTop: 6 }}
                    >
                      Rekap &amp; Histori
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* KELOMPOK MENU PELANGGARAN (COLLAPSIBLE) */}
          {['Admin', 'Keamanan', 'Pembina Kamar'].includes(user.jabatan) && (
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
                <ChevronIcon isOpen={isPelanggaranMenuOpen} />
              </button>
              <div id="pelanggaran-subnav" className={`sidebar-subnav ${isPelanggaranMenuOpen ? 'open' : 'closed'}`} aria-hidden={!isPelanggaranMenuOpen}>
                <div className="sidebar-subnav-inner">
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
                  {user.jabatan === 'Keamanan' && (
                    <Link
                      to="/pelanggaran/master"
                      className={`sidebar-subnav-link ${location.pathname === '/pelanggaran/master' ? 'active' : ''}`}
                      aria-current={location.pathname === '/pelanggaran/master' ? 'page' : undefined}
                      onClick={closeMenu}
                    >
                      Master Pelanggaran
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {['Admin', 'Keamanan', 'Pembina Kamar'].includes(user.jabatan) && (
            <Link
              to="/prestasi/semua"
              className={`sidebar-nav-link ${location.pathname.startsWith('/prestasi') ? 'active' : ''}`}
              aria-current={location.pathname.startsWith('/prestasi') ? 'page' : undefined}
              onClick={closeMenu}
            >
              <NavIcon name="report"/><span>Prestasi</span>
            </Link>
          )}

          {/* MENU PERIZINAN & GERBANG (DIRECT SINGLE LINK) */}
          {['Admin', 'Keamanan'].includes(user.jabatan) && (
            <Link
              to="/perizinan"
              className={`sidebar-nav-link ${location.pathname.startsWith('/perizinan') || location.pathname === '/catat-gerbang' ? 'active' : ''}`}
              aria-current={location.pathname.startsWith('/perizinan') || location.pathname === '/catat-gerbang' ? 'page' : undefined}
              onClick={closeMenu}
            >
              <NavIcon name="gate" />
              <span>Perizinan &amp; Gerbang</span>
            </Link>
          )}


          {/* KELOMPOK MENU RAPORT PENGAJIAN */}
          {user.jabatan === 'Piket Pengajian' && (
            <Link
              to="/raport"
              className={`sidebar-nav-link ${location.pathname.startsWith('/raport') ? 'active' : ''}`}
              aria-current={location.pathname.startsWith('/raport') ? 'page' : undefined}
              onClick={closeMenu}
            >
              <NavIcon name="raport"/><span>Raport Pengajian</span>
            </Link>
          )}

          {user.jabatan === 'Admin' && (
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
                <ChevronIcon isOpen={isRaportMenuOpen} />
              </button>
              <div id="raport-subnav" className={`sidebar-subnav ${isRaportMenuOpen ? 'open' : 'closed'}`} aria-hidden={!isRaportMenuOpen}>
                <div className="sidebar-subnav-inner">
                  <Link
                    to="/raport"
                    className={`sidebar-subnav-link ${location.pathname === '/raport' ? 'active' : ''}`}
                    aria-current={location.pathname === '/raport' ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    Raport Pengajian
                  </Link>
                  <Link
                    to="/raport/input"
                    className={`sidebar-subnav-link ${location.pathname === '/raport/input' ? 'active' : ''}`}
                    aria-current={location.pathname === '/raport/input' ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    Input Raport
                  </Link>
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
            </div>
          )}

          {/* KELOMPOK MENU RAPORT PEMBINAAN */}
          {user.jabatan === 'Pembina Kamar' && (
            <Link
              to="/ubudiyah"
              className={`sidebar-nav-link ${location.pathname.startsWith('/ubudiyah') ? 'active' : ''}`}
              aria-current={location.pathname.startsWith('/ubudiyah') ? 'page' : undefined}
              onClick={closeMenu}
            >
              <NavIcon name="ubudiyah"/><span>Raport Pembinaan</span>
            </Link>
          )}

          {user.jabatan === 'Admin' && (
            <div className="sidebar-master-menu">
              <button
                type="button"
                aria-label="Buka atau tutup menu Raport Pembinaan"
                aria-expanded={isUbudiyahMenuOpen}
                aria-controls="ubudiyah-subnav"
                className={`sidebar-nav-link sidebar-master-trigger ${location.pathname.startsWith('/ubudiyah') ? 'active' : ''}`}
                onClick={toggleUbudiyahMenu}
              >
                <span className="nav-label"><NavIcon name="ubudiyah"/><span>Raport Pembinaan</span></span>
                <ChevronIcon isOpen={isUbudiyahMenuOpen} />
              </button>
              <div id="ubudiyah-subnav" className={`sidebar-subnav ${isUbudiyahMenuOpen ? 'open' : 'closed'}`} aria-hidden={!isUbudiyahMenuOpen}>
                <div className="sidebar-subnav-inner">
                  {!ubudiyahReady && <p className="sidebar-subnav-notice" role="status">Modul belum siap</p>}
                  {ubudiyahReady && <>
                    <Link
                      to="/ubudiyah"
                      className={`sidebar-subnav-link ${location.pathname === '/ubudiyah' ? 'active' : ''}`}
                      aria-current={location.pathname === '/ubudiyah' ? 'page' : undefined}
                      onClick={closeMenu}
                    >
                      Raport Pembinaan
                    </Link>
                    <Link
                      to="/ubudiyah/input"
                      className={`sidebar-subnav-link ${location.pathname === '/ubudiyah/input' ? 'active' : ''}`}
                      aria-current={location.pathname === '/ubudiyah/input' ? 'page' : undefined}
                      onClick={closeMenu}
                    >
                      Input Raport Pembinaan
                    </Link>
                    <Link
                      to="/ubudiyah/lihat"
                      className={`sidebar-subnav-link ${location.pathname === '/ubudiyah/lihat' ? 'active' : ''}`}
                      aria-current={location.pathname === '/ubudiyah/lihat' ? 'page' : undefined}
                      onClick={closeMenu}
                    >
                      Lihat Raport Pembinaan
                    </Link>
                  </>}
                </div>
              </div>
            </div>
          )}

          {user.jabatan === 'Admin' && (
            <div className="sidebar-master-menu">
              <button type="button" aria-label="Buka atau tutup Verifikasi Data" aria-expanded={isVerificationMenuOpen} aria-controls="verification-subnav" className={`sidebar-nav-link sidebar-master-trigger ${location.pathname.startsWith('/verifikasi-data') ? 'active' : ''}`} onClick={toggleVerificationMenu}>
                <span className="nav-label"><NavIcon name="verify"/><span>Verifikasi Data</span>{hasVerificationAttention && <span className="nav-attention-dot" aria-label="Masih ada antrean verifikasi"/>}</span>
                <ChevronIcon isOpen={isVerificationMenuOpen} />
              </button>
              <div id="verification-subnav" className={`sidebar-subnav ${isVerificationMenuOpen ? 'open' : 'closed'}`} aria-hidden={!isVerificationMenuOpen}>
                <div className="sidebar-subnav-inner">
                  <Link to="/verifikasi-data/santri" className={`sidebar-subnav-link ${location.pathname === '/verifikasi-data/santri' ? 'active' : ''}`} onClick={closeMenu}>Verifikasi data santri{verificationAttention.santri > 0 && <span className="nav-attention-dot" aria-label={`${verificationAttention.santri} data perlu diverifikasi`}/>}</Link>
                  <Link to="/verifikasi-data/review" className={`sidebar-subnav-link ${location.pathname === '/verifikasi-data/review' ? 'active' : ''}`} onClick={closeMenu}>Review kemiripan data{verificationAttention.review > 0 && <span className="nav-attention-dot" aria-label={`${verificationAttention.review} kemiripan data perlu diverifikasi`}/>}</Link>
                </div>
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
                className={`sidebar-nav-link sidebar-master-trigger ${isMasterRoute ? 'active' : ''}`}
                onClick={toggleMasterMenu}
              >
                <span className="nav-label"><NavIcon name="database"/><span>Data Master</span></span>
                <ChevronIcon isOpen={isMasterMenuOpen} />
              </button>
              <div id="master-subnav" className={`sidebar-subnav ${isMasterMenuOpen ? 'open' : 'closed'}`} aria-hidden={!isMasterMenuOpen}>
                <div className="sidebar-subnav-inner">
                  <Link to="/data-master/santri" className={`sidebar-subnav-link ${location.pathname === '/data-master/santri' ? 'active' : ''}`} aria-current={location.pathname === '/data-master/santri' ? 'page' : undefined} onClick={closeMenu}>Data santri</Link>
                  <Link to="/data-master/alumni" className={`sidebar-subnav-link ${location.pathname === '/data-master/alumni' ? 'active' : ''}`} aria-current={location.pathname === '/data-master/alumni' ? 'page' : undefined} onClick={closeMenu}>Data alumni</Link>
                  <Link to="/data-master/organisasi-daerah" className={`sidebar-subnav-link ${location.pathname === '/data-master/organisasi-daerah' ? 'active' : ''}`} onClick={closeMenu}>Data ORDA</Link>
                  <Link to="/data-master/ekstrakurikuler" className={`sidebar-subnav-link ${location.pathname === '/data-master/ekstrakurikuler' ? 'active' : ''}`} onClick={closeMenu}>Data ekstrakurikuler</Link>
                  <Link to="/data-master/wisma" className={`sidebar-subnav-link ${location.pathname === '/data-master/wisma' ? 'active' : ''}`} onClick={closeMenu}>Data wisma</Link>
                </div>
              </div>
            </div>
          )}

          {/* KELOMPOK MENU MANAGEMENT (KHUSUS ADMIN) */}
          {user.jabatan === 'Admin' && (
            <div className="sidebar-master-menu">
              <button
                type="button"
                aria-label="Buka atau tutup menu Management"
                aria-expanded={isManagementMenuOpen}
                aria-controls="management-subnav"
                className={`sidebar-nav-link sidebar-master-trigger ${isManagementRoute ? 'active' : ''}`}
                onClick={toggleManagementMenu}
              >
                <span className="nav-label"><NavIcon name="management"/><span>Management</span></span>
                <ChevronIcon isOpen={isManagementMenuOpen} />
              </button>
              <div id="management-subnav" className={`sidebar-subnav ${isManagementMenuOpen ? 'open' : 'closed'}`} aria-hidden={!isManagementMenuOpen}>
                <div className="sidebar-subnav-inner">
                  <Link
                    to="/data-master/jadwal-absensi"
                    className={`sidebar-subnav-link ${location.pathname === '/data-master/jadwal-absensi' || location.pathname === '/absensi/jadwal' ? 'active' : ''}`}
                    aria-current={location.pathname === '/data-master/jadwal-absensi' || location.pathname === '/absensi/jadwal' ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    Jadwal Absensi
                  </Link>
                  <Link
                    to="/pelanggaran/master"
                    className={`sidebar-subnav-link ${location.pathname === '/pelanggaran/master' ? 'active' : ''}`}
                    aria-current={location.pathname === '/pelanggaran/master' ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    Master Pelanggaran
                  </Link>
                  <Link
                    to="/ubudiyah/master"
                    className={`sidebar-subnav-link ${location.pathname === '/ubudiyah/master' ? 'active' : ''}`}
                    aria-current={location.pathname === '/ubudiyah/master' ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    Master Kriteria Pembinaan
                  </Link>
                  <Link
                    to="/raport/master"
                    className={`sidebar-subnav-link ${location.pathname === '/raport/master' ? 'active' : ''}`}
                    aria-current={location.pathname === '/raport/master' ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    Master Kriteria Pengajian
                  </Link>
                  <Link
                    to="/data-master/penugasan"
                    className={`sidebar-subnav-link ${location.pathname === '/data-master/penugasan' ? 'active' : ''}`}
                    aria-current={location.pathname === '/data-master/penugasan' ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    Penugasan Absensi
                  </Link>
                  <Link
                    to="/data-master/akun"
                    className={`sidebar-subnav-link ${location.pathname === '/data-master/akun' ? 'active' : ''}`}
                    aria-current={location.pathname === '/data-master/akun' ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    Akun Petugas
                  </Link>
                  <Link
                    to="/data-master/wa-bot"
                    className={`sidebar-subnav-link ${location.pathname === '/data-master/wa-bot' ? 'active' : ''}`}
                    aria-current={location.pathname === '/data-master/wa-bot' ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    Pengaturan Bot WA
                  </Link>
                  <Link
                    to="/periode-akademik"
                    className={`sidebar-subnav-link ${location.pathname === '/periode-akademik' ? 'active' : ''}`}
                    aria-current={location.pathname === '/periode-akademik' ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    Periode Akademik
                  </Link>
                </div>
              </div>
            </div>
          )}

          {['Admin'].includes(user.jabatan) && (
            <Link to="/laporan/detail" className={`sidebar-nav-link ${location.pathname === '/laporan/detail' ? 'active' : ''}`} aria-current={location.pathname === '/laporan/detail' ? 'page' : undefined} onClick={closeMenu}><NavIcon name="report"/><span>Laporan Detail</span></Link>
          )}

          <Link to="/ganti-kata-sandi" className={`sidebar-nav-link ${location.pathname === '/ganti-kata-sandi' ? 'active' : ''}`} aria-current={location.pathname === '/ganti-kata-sandi' ? 'page' : undefined} onClick={closeMenu}><NavIcon name="lock"/><span>Ganti Password</span></Link>
          <button onClick={() => { closeMenu(); logout(); }} className="sidebar-logout-btn" title="Keluar dari akun" style={{ marginTop: '12px' }}>
            <NavIcon name="logout"/><span className="logout-text">Keluar</span>
          </button>

        </nav>
      </div>
      </aside>

      <main className="dashboard-content">
        <Suspense fallback={<PageSkeleton rows={6} />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/absensi-kegiatan/:jenis" element={<DashboardPage />} />

            <Route path="/pelanggaran" element={<Navigate to="/pelanggaran/semua" replace />} />
            <Route path="/pelanggaran/semua" element={<PelanggaranListPage />} />
            <Route path="/pelanggaran/baru" element={<PelanggaranFormPage />} />
            <Route path="/pelanggaran/master" element={['Admin', 'Keamanan'].includes(user.jabatan) ? <PelanggaranMasterPage /> : <Navigate to="/dashboard" />} />
            <Route path="/prestasi" element={<Navigate to="/prestasi/semua" replace />} />
            <Route path="/prestasi/semua" element={<PrestasiListPage />} />

            <Route path="/perizinan" element={['Admin', 'Keamanan'].includes(user.jabatan) ? <CatatGerbangPage /> : <Navigate to="/dashboard" />} />
            <Route path="/perizinan/semua" element={<Navigate to="/perizinan" replace />} />
            <Route path="/catat-gerbang" element={<Navigate to="/perizinan" replace />} />

            <Route path="/ganti-kata-sandi" element={<GantiPasswordPage />} />

            {/* Protected Routes based on Jabatan */}
            <Route path="/absensi/:jenis/:id" element={<BulkInputPage />} />
            <Route path="/absensi-histori" element={['Admin', 'Pembina Kamar', 'Wali Kelas', 'Piket Pengajian'].includes(user.jabatan) ? <AbsensiHistoryPage /> : <Navigate to="/dashboard" />} />
            <Route path="/rekap-kelas" element={<Navigate to="/absensi-histori" replace />} />

            <Route path="/raport" element={
              ['Admin', 'Piket Pengajian'].includes(user.jabatan)
                ? <RaportLandingPage />
                : <Navigate to="/dashboard" />
            } />
            <Route path="/raport/input" element={
              ['Admin', 'Piket Pengajian'].includes(user.jabatan)
                ? <RaportInputPage />
                : <Navigate to="/dashboard" />
            } />
            <Route path="/raport/lihat" element={['Admin', 'Piket Pengajian'].includes(user.jabatan) ? <RaportViewPage /> : <Navigate to="/dashboard" />} />
            <Route path="/raport/master" element={user.jabatan === 'Admin' ? <RaportMasterPage /> : <Navigate to="/dashboard" />} />

            <Route path="/ubudiyah" element={
              ['Admin', 'Pembina Kamar'].includes(user.jabatan)
                ? <UbudiyahLandingPage />
                : <Navigate to="/dashboard" />
            } />
            <Route path="/ubudiyah/input" element={
              ['Admin', 'Pembina Kamar'].includes(user.jabatan)
                ? <UbudiyahFormPage />
                : <Navigate to="/dashboard" />
            } />
            <Route path="/ubudiyah/lihat" element={
              ['Admin', 'Pembina Kamar'].includes(user.jabatan)
                ? <UbudiyahViewPage />
                : <Navigate to="/dashboard" />
            } />
            <Route path="/ubudiyah/master" element={
              user.jabatan === 'Admin'
                ? <UbudiyahMasterPage />
                : <Navigate to="/dashboard" />
            } />
            <Route path="/data-master/jadwal-absensi" element={
              ['Admin', 'admin'].includes(user.jabatan)
                ? <JadwalAbsensiMasterPage />
                : <Navigate to="/dashboard" />
            } />
            <Route path="/absensi/jadwal" element={
              ['Admin', 'admin'].includes(user.jabatan)
                ? <JadwalAbsensiMasterPage />
                : <Navigate to="/dashboard" />
            } />

            <Route path="/data-master" element={
              ['Admin', 'Pembina Kamar'].includes(user.jabatan)
                ? <Navigate to="/data-master/santri" replace />
                : <Navigate to="/dashboard" />
            } />
            <Route path="/verifikasi-data" element={user.jabatan === 'Admin' ? <Navigate to="/verifikasi-data/santri" replace /> : <Navigate to="/dashboard" />} />
            <Route path="/verifikasi-data/:tab" element={user.jabatan === 'Admin' ? <DataMasterPage /> : <Navigate to="/dashboard" />} />
            <Route path="/data-master/:tab" element={
              ['Admin', 'Pembina Kamar'].includes(user.jabatan)
                ? <DataMasterPage />
                : <Navigate to="/dashboard" />
            } />

            <Route path="/laporan/detail" element={
              ['Admin'].includes(user.jabatan)
                ? <LaporanPage />
                : <Navigate to="/dashboard" />
            } />
            <Route path="/periode-akademik" element={user.jabatan === 'Admin' ? <PeriodeAkademikPage /> : <Navigate to="/dashboard" />} />

            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Suspense>
      </main>

      <nav className={`mobile-bottom-nav ${isNavVisible ? 'is-visible' : 'is-hidden'}`} aria-label="Navigasi mobile">
        <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''} aria-current={location.pathname === '/dashboard' ? 'page' : undefined} onClick={closeMenu}>
          <NavIcon name="home"/><span>Beranda</span>
        </Link>

        {['Admin', 'Wali Kelas', 'Pembina Kamar', 'Piket Pengajian'].includes(user.jabatan) && (
          <Link to="/absensi-histori" className={location.pathname === '/absensi-histori' || location.pathname === '/rekap-kelas' ? 'active' : ''} aria-current={location.pathname === '/absensi-histori' || location.pathname === '/rekap-kelas' ? 'page' : undefined} onClick={closeMenu}>
            <NavIcon name="report"/><span>Rekap</span>
          </Link>
        )}

        {['Admin', 'Keamanan', 'Pembina Kamar'].includes(user.jabatan) && (
          <Link to="/pelanggaran/semua" className={location.pathname.startsWith('/pelanggaran') ? 'active' : ''} aria-current={location.pathname.startsWith('/pelanggaran') ? 'page' : undefined} onClick={closeMenu}>
            <NavIcon name="warning"/><span>Pelanggaran</span>
          </Link>
        )}

        {['Admin', 'Keamanan'].includes(user.jabatan) && (
          <Link to="/perizinan" className={location.pathname.startsWith('/perizinan') || location.pathname === '/catat-gerbang' ? 'active' : ''} aria-current={location.pathname.startsWith('/perizinan') || location.pathname === '/catat-gerbang' ? 'page' : undefined} onClick={closeMenu}>
            <NavIcon name="gate"/><span>Perizinan &amp; Gerbang</span>
          </Link>
        )}

        {['Admin'].includes(user.jabatan) && (
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
