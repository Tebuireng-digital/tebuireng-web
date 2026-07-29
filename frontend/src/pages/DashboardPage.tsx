import { Link } from 'react-router-dom';

export function DashboardPage() {
  const metrics = [
    { label: 'Kamar', value: '98%', path: '/absensi/kamar/1' },
    { label: 'Sekolah', value: '95%', path: '/absensi/sekolah/1' },
    { label: 'PBS', value: '100%', path: '/absensi/pbs/1' },
    { label: 'PBM', value: '92%', path: '/absensi/pbm/1' },
    { label: 'Diniyah', value: '90%', path: '/absensi/diniyah/1' },
  ];

  return (
    <div>
      <header className="dashboard-header">
        <h1>Dashboard Pengasuh</h1>
        <p>Ringkasan persentase kehadiran hari ini</p>
      </header>

      <div className="dashboard-grid-premium">
        {metrics.map((m) => (
          <Link key={m.label} to={m.path} className="stat-card">
            <div className="stat-card-value">{m.value}</div>
            <div className="stat-card-label">{m.label}</div>
          </Link>
        ))}
      </div>
      
      <div style={{ marginTop: '48px', display: 'flex', justifyContent: 'flex-start' }}>
        <Link 
          to="/laporan/detail" 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            backgroundColor: '#0F6E56',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '15px',
            boxShadow: '0 4px 14px rgba(15, 110, 86, 0.25)',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(15, 110, 86, 0.35)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(15, 110, 86, 0.25)'; }}
        >
          Lihat Laporan Detail
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </Link>
      </div>
    </div>
  );
}
