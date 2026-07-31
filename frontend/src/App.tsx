import { useState, type ReactNode } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { BulkInputPage } from './pages/BulkInputPage';
import { DashboardPage } from './pages/DashboardPage';
import { PelanggaranFormPage } from './pages/PelanggaranFormPage';
import { CatatGerbangPage } from './pages/CatatGerbangPage';
import { DataMasterPage } from './pages/DataMasterPage';
import { LaporanPage } from './pages/LaporanPage';
import { GantiPasswordPage } from './pages/GantiPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { RekapKelasPage } from './pages/RekapKelasPage';
import { useAuth } from './AuthContext';

type IconName = 'home' | 'warning' | 'gate' | 'database' | 'report' | 'lock' | 'menu' | 'logout' | 'more';

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9h13v-9M9 19v-5h6v5"/></>,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMasterMenuOpen, setIsMasterMenuOpen] = useState(() => location.pathname.startsWith('/data-master'));

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

  return (
    <div className="premium-layout">
      {/* Mobile Header */}
      <div className="mobile-header">
        <div className="mobile-brand"><span className="brand-mark">TI</span><div><h2 className="mobile-header-title">Tebuireng</h2><small>Sistem Kepesantrenan</small></div></div>
        <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
          <NavIcon name="menu" />
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      <div className={`sidebar-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={closeMenu}></div>

      {/* Sidebar / Navigation */}
      <div className={`premium-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div className="sidebar-brand"><span className="brand-mark">TI</span><div><h2 className="sidebar-title">Tebuireng</h2><p>Sistem Kepesantrenan</p></div></div>
          <button className="mobile-close-btn" onClick={closeMenu}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="sidebar-user-box">
          <span className="user-avatar">{user.nama.slice(0, 1).toUpperCase()}</span>
          <div><p>{user.nama}</p><span>{user.jabatan}</span></div>
        </div>

        <nav className="sidebar-nav">
          <Link to="/dashboard" className={`sidebar-nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`} onClick={closeMenu}><NavIcon name="home"/><span>Beranda</span></Link>
          {user.jabatan === 'Wali Kelas' && (
            <Link to="/rekap-kelas" className={`sidebar-nav-link ${location.pathname === '/rekap-kelas' ? 'active' : ''}`} onClick={closeMenu}><NavIcon name="report"/><span>Rekap Kelas</span></Link>
          )}
          {['Admin', 'Keamanan', 'Pembina Kamar'].includes(user.jabatan) && (
            <Link to="/pelanggaran/baru" className={`sidebar-nav-link ${location.pathname === '/pelanggaran/baru' ? 'active' : ''}`} onClick={closeMenu}><NavIcon name="warning"/><span>Input Pelanggaran</span></Link>
          )}

          <hr className="sidebar-nav-divider" />

          {['Admin', 'Keamanan'].includes(user.jabatan) && (
            <Link to="/catat-gerbang" className={`sidebar-nav-link ${location.pathname === '/catat-gerbang' ? 'active' : ''}`} onClick={closeMenu}><NavIcon name="gate"/><span>Perizinan & Gerbang</span></Link>
          )}

          {user.jabatan === 'Admin' && (
            <div className="sidebar-master-menu">
              <Link to="/data-master" className={`sidebar-nav-link sidebar-master-trigger ${location.pathname.startsWith('/data-master') ? 'active' : ''}`} onClick={() => { setIsMasterMenuOpen(true); closeMenu(); }}>
                <span className="nav-label"><NavIcon name="database"/><span>Data Master</span></span><span aria-hidden="true">{isMasterMenuOpen ? '⌃' : '⌄'}</span>
              </Link>
              {isMasterMenuOpen && <div className="sidebar-subnav">
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
          <Route path="/pelanggaran/baru" element={<PelanggaranFormPage />} />
          <Route path="/ganti-kata-sandi" element={<GantiPasswordPage />} />

          {/* Protected Routes based on Jabatan */}
          <Route path="/absensi/:jenis/:id" element={<BulkInputPage />} />
          <Route path="/rekap-kelas" element={user.jabatan === 'Wali Kelas' ? <RekapKelasPage /> : <Navigate to="/dashboard" />} />

          <Route path="/catat-gerbang" element={
            ['Admin', 'Keamanan'].includes(user.jabatan)
              ? <CatatGerbangPage />
              : <Navigate to="/dashboard" />
          } />

          <Route path="/data-master" element={
            user.jabatan === 'Admin'
              ? <Navigate to="/data-master/penugasan" replace />
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

        {['Admin', 'Keamanan', 'Pembina Kamar'].includes(user.jabatan) && (
          <Link to="/pelanggaran/baru" className={location.pathname === '/pelanggaran/baru' ? 'active' : ''} onClick={closeMenu}>
            <NavIcon name="warning"/><span>Pelanggaran</span>
          </Link>
        )}

        {['Admin', 'Keamanan'].includes(user.jabatan) && (
          <Link to="/catat-gerbang" className={location.pathname === '/catat-gerbang' ? 'active' : ''} onClick={closeMenu}>
            <NavIcon name="gate"/><span>Gerbang</span>
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
