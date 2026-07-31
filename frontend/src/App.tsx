import { useState } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { BulkInputPage } from './pages/BulkInputPage';
import { DashboardPage } from './pages/DashboardPage';
import { PelanggaranFormPage } from './pages/PelanggaranFormPage';
import { CatatGerbangPage } from './pages/CatatGerbangPage';
import { DataMasterPage } from './pages/DataMasterPage';
import { LaporanPage } from './pages/LaporanPage';
import { GantiPasswordPage } from './pages/GantiPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './AuthContext';

function Layout() {
  const { user, logout, loading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--kertas)' }}>Loading...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="premium-layout">
      {/* Mobile Header */}
      <div className="mobile-header">
        <h2 className="mobile-header-title">Sistem Absensi</h2>
        <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      <div className={`sidebar-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={closeMenu}></div>

      {/* Sidebar / Navigation */}
      <div className={`premium-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h2 className="sidebar-title" style={{ marginBottom: 0 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            Sistem Absensi
          </h2>
          <button className="mobile-close-btn" onClick={closeMenu}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="sidebar-user-box">
          <p className="ui-text-label" style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Login sebagai:</p>
          <p style={{ fontWeight: 'bold', fontSize: '15px', color: '#FFF' }}>{user.nama}</p>
          <p style={{ fontSize: '12px', color: '#A7F3D0', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {user.jabatan}
          </p>
        </div>

        <nav className="sidebar-nav">
          {user.wajib_ganti_password ? (
            <Link to="/ganti-kata-sandi" className="sidebar-nav-link" onClick={closeMenu}>Ganti Password</Link>
          ) : <>
          <Link to="/dashboard" className="sidebar-nav-link" onClick={closeMenu}>Dashboard</Link>
              {['Admin', 'Keamanan', 'Pembina Kamar'].includes(user.jabatan) && (
              <Link to="/pelanggaran/baru" className="sidebar-nav-link" onClick={closeMenu}>Input Pelanggaran</Link>
              )}

              <hr className="sidebar-nav-divider" />

              {['Admin', 'Keamanan'].includes(user.jabatan) && (
                <Link to="/catat-gerbang" className="sidebar-nav-link" onClick={closeMenu}>Perizinan & Gerbang</Link>
              )}

              {user.jabatan === 'Admin' && (
                <Link to="/data-master" className="sidebar-nav-link" onClick={closeMenu}>Data Master</Link>
              )}

              {['Admin', 'Pengasuh'].includes(user.jabatan) && (
                <Link to="/laporan/detail" className="sidebar-nav-link" onClick={closeMenu}>Laporan Detail</Link>
              )}

              <Link to="/ganti-kata-sandi" className="sidebar-nav-link" onClick={closeMenu}>Ganti Password</Link>

              <hr className="sidebar-nav-divider" />
          </>}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
          <button onClick={logout} className="sidebar-logout-btn">
            Logout
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        {user.wajib_ganti_password ? (
          <Routes>
            <Route path="/ganti-kata-sandi" element={<GantiPasswordPage />} />
            <Route path="*" element={<Navigate to="/ganti-kata-sandi" />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/pelanggaran/baru" element={<PelanggaranFormPage />} />
            <Route path="/ganti-kata-sandi" element={<GantiPasswordPage />} />
            
            {/* Protected Routes based on Jabatan */}
            <Route path="/absensi/:jenis/:id" element={<BulkInputPage />} />
            
            <Route path="/catat-gerbang" element={
              ['Admin', 'Keamanan'].includes(user.jabatan)
                ? <CatatGerbangPage />
                : <Navigate to="/dashboard" />
            } />
            
            <Route path="/data-master" element={
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
        )}
      </div>
    </div>
  );
}

export default Layout;
