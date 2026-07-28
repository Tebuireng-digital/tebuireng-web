import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { BulkInputPage } from './pages/BulkInputPage';
import { DashboardPage } from './pages/DashboardPage';
import { PelanggaranFormPage } from './pages/PelanggaranFormPage';
import { PerizinanPage } from './pages/PerizinanPage';
import { PersetujuanIzinPage } from './pages/PersetujuanIzinPage';
import { CatatGerbangPage } from './pages/CatatGerbangPage';
import { DataMasterPage } from './pages/DataMasterPage';
import { LaporanPage } from './pages/LaporanPage';
import { GantiPasswordPage } from './pages/GantiPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './AuthContext';

function Layout() {
  const { user, logout, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--kertas)' }}>Loading...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--kertas)' }}>
      {/* Sidebar / Navigation */}
      <div style={{ width: '220px', backgroundColor: 'var(--kertas-kartu)', borderRight: '1px solid var(--garis)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
        <h2 className="ui-text-title" style={{ marginBottom: '16px' }}>Sistem Absensi</h2>
        
        <div style={{ marginBottom: '24px', padding: '12px', backgroundColor: 'var(--latar)', borderRadius: '8px' }}>
          <p className="ui-text-label" style={{ marginBottom: '4px' }}>Login sebagai:</p>
          <p className="ui-text-body" style={{ fontWeight: 'bold' }}>{user.nama}</p>
          <p className="ui-text-label" style={{ color: 'var(--status-alpha)' }}>{user.jabatan}</p>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
          <Link to="/dashboard" className="ui-text-body">Dashboard</Link>
          <Link to="/pelanggaran/baru" className="ui-text-body">Input Pelanggaran</Link>
          <Link to="/perizinan/1" className="ui-text-body">Cek Izin (Santri 1)</Link>
          <hr style={{ border: 'none', borderTop: '1px solid var(--garis)', margin: '8px 0' }} />
          <Link to="/persetujuan-izin" className="ui-text-body">Persetujuan Izin</Link>
          <Link to="/catat-gerbang" className="ui-text-body">Catat Gerbang</Link>
          <Link to="/data-master" className="ui-text-body">Data Master</Link>
          <Link to="/laporan/detail" className="ui-text-body">Laporan Detail</Link>
          <Link to="/ganti-kata-sandi" className="ui-text-body">Ganti Password</Link>
          <hr style={{ border: 'none', borderTop: '1px solid var(--garis)', margin: '8px 0' }} />
          <Link to="/absensi/kamar/1" className="ui-text-body">Absensi Kamar 1</Link>
          <Link to="/absensi/sekolah/1" className="ui-text-body">Absensi Sekolah 1</Link>
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--garis)' }}>
          <button 
            onClick={logout} 
            className="ui-btn" 
            style={{ width: '100%', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #f87171' }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ flex: 1, height: '100vh', overflowY: 'auto' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/absensi/:jenis/:id" element={<BulkInputPage />} />
          <Route path="/pelanggaran/baru" element={<PelanggaranFormPage />} />
          <Route path="/perizinan/:santriId" element={<PerizinanPage />} />
          <Route path="/persetujuan-izin" element={<PersetujuanIzinPage />} />
          <Route path="/catat-gerbang" element={<CatatGerbangPage />} />
          <Route path="/data-master" element={<DataMasterPage />} />
          <Route path="/laporan/detail" element={<LaporanPage />} />
          <Route path="/ganti-kata-sandi" element={<GantiPasswordPage />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </div>
  );
}

export default Layout;
