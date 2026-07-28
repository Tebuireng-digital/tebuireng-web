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
    <div className="app-container" style={{ padding: '24px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 className="ui-text-title">Dashboard Pengasuh</h1>
        <p className="ui-text-body" style={{ color: 'var(--tinta-pudar)' }}>Ringkasan kehadiran hari ini</p>
      </header>

      <div className="dashboard-grid">
        {metrics.map((m) => (
          <Link key={m.label} to={m.path} style={{ textDecoration: 'none' }}>
            <div 
              style={{
                backgroundColor: 'var(--kertas-kartu)',
                border: '1px solid var(--garis)',
                borderRadius: '8px',
                padding: '24px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'none' /* No drop shadow */
              }}
            >
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '28px',
                fontWeight: 600,
                color: 'var(--tinta)',
                marginBottom: '8px'
              }}>
                {m.value}
              </div>
              <div className="ui-text-label" style={{ color: 'var(--tinta-pudar)' }}>
                {m.label}
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      <div style={{ marginTop: '32px' }}>
        <Link to="/laporan/detail" className="ui-text-body" style={{ color: 'var(--aksen)' }}>
          Lihat Laporan Detail &rarr;
        </Link>
      </div>
    </div>
  );
}
