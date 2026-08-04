import { useState, type ReactNode } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { BulkInputPage } from './pages/BulkInputPage';
import { DashboardPage } from './pages/DashboardPage';
import { PelanggaranFormPage } from './pages/PelanggaranFormPage';
import { PelanggaranListPage } from './pages/PelanggaranListPage';
import { CatatGerbangPage } from './pages/CatatGerbangPage';
import { PerizinanListPage } from './pages/PerizinanListPage';
import { DataMasterPage } from './pages/DataMasterPage';
import { LaporanPage } from './pages/LaporanPage';
import { GantiPasswordPage } from './pages/GantiPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { RekapKelasPage } from './pages/RekapKelasPage';
import { useAuth } from './AuthContext';

type IconName = 'home' | 'school' | 'room' | 'quran' | 'madin' | 'takhasus' | 'warning' | 'gate' | 'database' | 'report' | 'lock' | 'menu' | 'logout' | 'more';

interface OpsiAbsensiItem {
  jenis: string;
  nama: string;
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
    gate: <><path d="M4 20V8l8-4 8 4v12M8 20V10h8v10M8 14h8"/></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
    report: <><path d="M6 3h9l3 3v15H6zM14 3v4h4"/><path d="M9 16v-3M12 16V9M15 16v-5"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  };
  return <svg className="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Layout() {
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentJenis = searchParams.get('jenis');

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAbsensiMenuOpen, setIsAbsensiMenuOpen] = useState(() => location.pathname.startsWith('/absensi-kegiatan') || (location.pathname === '/dashboard' && !!currentJenis));
  const [isPelanggaranMenuOpen, setIsPelanggaranMenuOpen] = useState(() => location.pathname.startsWith('/pelanggaran'));
  const [isPerizinanMenuOpen, setIsPerizinanMenuOpen] = useState(() => location.pathname.startsWith('/perizinan') || location.pathname === '/catat-gerbang');
  const [isMasterMenuOpen, setIsMasterMenuOpen] = useState(() => location.pathname.startsWith('/data-master'));

  const { data: absensiOptions = [] } = useQuery<OpsiAbsensiItem[]>({
    queryKey: ['absensi-options', user?.petugas_id],
    queryFn: async () => (await api.get('/api/absensi-options')).data,
    enabled: !!user,
  });

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--kertas)' }}>Loading...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  if (user.wajib_ganti_password && location.pathname !== '/ganti-kata-sandi') {
    return <Navigate to="/ganti-kata-sandi" replace />;
  }

  const closeMenu = () => setIsMobileMenuOpen(false);

  const userAbsensiMenus = absensiOptions.map(opt => ({
    jenis: opt.jenis,
    nama: ABSENSI_CONFIG[opt.jenis]?.nama || opt.nama,
    icon: ABSENSI_CONFIG[opt.jenis]?.icon || 'home',
  }));

  return (
    <div className="premium-layout">
      {/* Mobile Header */}
      <div className="mobile-header">
        <div className="mobile-brand"><span className="brand-mark"><img src="/LOGO_TEBUIRENG_.jpg" alt="Logo Tebuireng" /></span><div><h2 className="mobile-header-title">Tebuireng</h2><small>Sistem Kepesantrenan</small></div></div>
        <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
          <NavIcon name="menu" />
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      <div className={`sidebar-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={closeMenu}></div>

      {/* Sidebar / Navigation */}
      <div className={`premium-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div className="sidebar-brand"><span className="brand-mark"><img src="/LOGO_TEBUIRENG_.jpg" alt="Logo Tebuireng" /></span><div><h2 className="sidebar-title">Tebuireng</h2><p>Sistem Kepesantrenan</p></div></div>
          <button className="mobile-close-btn" onClick={closeMenu}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="sidebar-user-box">
          <span className="user-avatar">{user.nama.slice(0, 1).toUpperCase()}</span>
          <div><p>{user.nama}</p><span>{user.jabatan}</span></div>
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/dashboard"
            className={`sidebar-nav-link ${location.pathname === '/dashboard' && !currentJenis ? 'active' : ''}`}
            onClick={closeMenu}
          >
            <NavIcon name="home"/><span>Beranda</span>
          </Link>

          {/* KELOMPOK MENU ABSENSI (COLLAPSIBLE) */}
          {userAbsensiMenus.length > 0 && (
            <div className="sidebar-master-menu">
              <button
                type="button"
                className={`sidebar-nav-link sidebar-master-trigger ${(location.pathname.startsWith('/absensi-kegiatan') || (location.pathname === '/dashboard' && !!currentJenis)) ? 'active' : ''}`}
                onClick={() => setIsAbsensiMenuOpen(open => !open)}
              >
                <span className="nav-label"><NavIcon name="quran"/><span>Menu Absensi</span></span>
                <span aria-hidden="true">{isAbsensiMenuOpen ? '⌃' : '⌄'}</span>
              </button>
              {isAbsensiMenuOpen && (
                <div className="sidebar-subnav">
                  {userAbsensiMenus.map(item => {
                    const isActive = (location.pathname === '/dashboard' && currentJenis === item.jenis) ||
                                     (location.pathname === `/absensi-kegiatan/${item.jenis}`);
                    return (
                      <Link
                        key={item.jenis}
                        to={`/absensi-kegiatan/${item.jenis}`}
                        className={`sidebar-subnav-link ${isActive ? 'active' : ''}`}
                        onClick={closeMenu}
                      >
                        {item.nama}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* KELOMPOK MENU PELANGGARAN (COLLAPSIBLE) */}
          {['Admin', 'Keamanan', 'Pembina Kamar', 'Pengasuh'].includes(user.jabatan) && (
            <div className="sidebar-master-menu">
              <button
                type="button"
                className={`sidebar-nav-link sidebar-master-trigger ${location.pathname.startsWith('/pelanggaran') ? 'active' : ''}`}
                onClick={() => setIsPelanggaranMenuOpen(open => !open)}
              >
                <span className="nav-label"><NavIcon name="warning"/><span>Pelanggaran</span></span>
                <span aria-hidden="true">{isPelanggaranMenuOpen ? '⌃' : '⌄'}</span>
              </button>
              {isPelanggaranMenuOpen && (
                <div className="sidebar-subnav">
                  {['Admin', 'Keamanan', 'Pembina Kamar'].includes(user.jabatan) && (
                    <Link
                      to="/pelanggaran/baru"
                      className={`sidebar-subnav-link ${location.pathname === '/pelanggaran/baru' ? 'active' : ''}`}
                      onClick={closeMenu}
                    >
                      Input Pelanggaran
                    </Link>
                  )}
                  <Link
                    to="/pelanggaran/semua"
                    className={`sidebar-subnav-link ${location.pathname === '/pelanggaran/semua' || location.pathname === '/pelanggaran' ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    Daftar Pelanggaran
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* KELOMPOK MENU PERIZINAN & GERBANG (COLLAPSIBLE) */}
          {['Admin', 'Keamanan', 'Pengasuh'].includes(user.jabatan) && (
            <div className="sidebar-master-menu">
              <button
                type="button"
                className={`sidebar-nav-link sidebar-master-trigger ${location.pathname.startsWith('/perizinan') || location.pathname === '/catat-gerbang' ? 'active' : ''}`}
                onClick={() => setIsPerizinanMenuOpen(open => !open)}
              >
                <span className="nav-label"><NavIcon name="gate"/><span>Perizinan & Gerbang</span></span>
                <span aria-hidden="true">{isPerizinanMenuOpen ? '⌃' : '⌄'}</span>
              </button>
              {isPerizinanMenuOpen && (
                <div className="sidebar-subnav">
                  {['Admin', 'Keamanan'].includes(user.jabatan) && (
                    <Link
                      to="/catat-gerbang"
                      className={`sidebar-subnav-link ${location.pathname === '/catat-gerbang' ? 'active' : ''}`}
                      onClick={closeMenu}
                    >
                      Catat Izin & Gerbang
                    </Link>
                  )}
                  <Link
                    to="/perizinan/semua"
                    className={`sidebar-subnav-link ${location.pathname === '/perizinan/semua' || location.pathname === '/perizinan' ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    Daftar Perizinan
                  </Link>
                </div>
              )}
            </div>
          )}

          {user.jabatan === 'Wali Kelas' && (
            <Link to="/rekap-kelas" className={`sidebar-nav-link ${location.pathname === '/rekap-kelas' ? 'active' : ''}`} onClick={closeMenu}><NavIcon name="report"/><span>Rekap Kelas</span></Link>
          )}

          <hr className="sidebar-nav-divider" />

          {user.jabatan === 'Admin' && (
            <div className="sidebar-master-menu">
              <button
                type="button"
                className={`sidebar-nav-link sidebar-master-trigger ${location.pathname.startsWith('/data-master') ? 'active' : ''}`}
                onClick={() => setIsMasterMenuOpen(open => !open)}
              >
                <span className="nav-label"><NavIcon name="database"/><span>Data Master</span></span>
                <span aria-hidden="true">{isMasterMenuOpen ? '⌃' : '⌄'}</span>
              </button>
              {isMasterMenuOpen && <div className="sidebar-subnav">
                <Link to="/data-master/santri" className={`sidebar-subnav-link ${location.pathname === '/data-master/santri' ? 'active' : ''}`} onClick={closeMenu}>Data santri</Link>
                <Link to="/data-master/alumni" className={`sidebar-subnav-link ${location.pathname === '/data-master/alumni' ? 'active' : ''}`} onClick={closeMenu}>Data alumni</Link>
                <Link to="/data-master/penugasan" className={`sidebar-subnav-link ${location.pathname === '/data-master/penugasan' ? 'active' : ''}`} onClick={closeMenu}>Penugasan absensi</Link>
                <Link to="/data-master/review" className={`sidebar-subnav-link ${location.pathname === '/data-master/review' ? 'active' : ''}`} onClick={closeMenu}>Review impor</Link>
                <Link to="/data-master/kamar" className={`sidebar-subnav-link ${location.pathname === '/data-master/kamar' ? 'active' : ''}`} onClick={closeMenu}>Kamar & mapping</Link>
                <Link to="/data-master/akun" className={`sidebar-subnav-link ${location.pathname === '/data-master/akun' ? 'active' : ''}`} onClick={closeMenu}>Akun petugas</Link>
              </div>}
            </div>
          )}

          {['Admin', 'Pengasuh'].includes(user.jabatan) && (
            <Link to="/laporan/detail" className={`sidebar-nav-link ${location.pathname === '/laporan/detail' ? 'active' : ''}`} onClick={closeMenu}><NavIcon name="report"/><span>Laporan Detail</span></Link>
          )}

          <Link to="/ganti-kata-sandi" className={`sidebar-nav-link ${location.pathname === '/ganti-kata-sandi' ? 'active' : ''}`} onClick={closeMenu}><NavIcon name="lock"/><span>Ganti Password</span></Link>

          <hr className="sidebar-nav-divider" />
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
          <button onClick={logout} className="sidebar-logout-btn">
            <NavIcon name="logout"/> Keluar
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/absensi-kegiatan/:jenis" element={<DashboardPage />} />

          <Route path="/pelanggaran" element={<Navigate to="/pelanggaran/semua" replace />} />
          <Route path="/pelanggaran/semua" element={<PelanggaranListPage />} />
          <Route path="/pelanggaran/baru" element={<PelanggaranFormPage />} />

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
          <Route path="/rekap-kelas" element={user.jabatan === 'Wali Kelas' ? <RekapKelasPage /> : <Navigate to="/dashboard" />} />

          <Route path="/data-master" element={
            user.jabatan === 'Admin'
              ? <Navigate to="/data-master/santri" replace />
              : <Navigate to="/dashboard" />
          } />
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
      </div>

      <nav className="mobile-bottom-nav" aria-label="Navigasi utama">
        <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''} onClick={closeMenu}>
          <NavIcon name="home"/><span>Beranda</span>
        </Link>

        {user.jabatan === 'Wali Kelas' && (
          <Link to="/rekap-kelas" className={location.pathname === '/rekap-kelas' ? 'active' : ''} onClick={closeMenu}>
            <NavIcon name="report"/><span>Rekap</span>
          </Link>
        )}

        {['Admin', 'Keamanan', 'Pembina Kamar', 'Pengasuh'].includes(user.jabatan) && (
          <Link to="/pelanggaran/semua" className={location.pathname.startsWith('/pelanggaran') ? 'active' : ''} onClick={closeMenu}>
            <NavIcon name="warning"/><span>Pelanggaran</span>
          </Link>
        )}

        {['Admin', 'Keamanan', 'Pengasuh'].includes(user.jabatan) && (
          <Link to="/perizinan/semua" className={location.pathname.startsWith('/perizinan') || location.pathname === '/catat-gerbang' ? 'active' : ''} onClick={closeMenu}>
            <NavIcon name="gate"/><span>Perizinan</span>
          </Link>
        )}

        {['Admin', 'Pengasuh'].includes(user.jabatan) && (
          <Link to="/laporan/detail" className={location.pathname === '/laporan/detail' ? 'active' : ''} onClick={closeMenu}>
            <NavIcon name="report"/><span>Laporan</span>
          </Link>
        )}

        <button type="button" className={isMobileMenuOpen ? 'active' : ''} onClick={() => setIsMobileMenuOpen(true)}>
          <NavIcon name="more"/><span>Menu</span>
        </button>
      </nav>
    </div>
  );
}

export default Layout;


