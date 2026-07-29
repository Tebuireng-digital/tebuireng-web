import React from 'react';
import { useAuth } from '../AuthContext';
import { Link } from 'react-router-dom';

export function SantriDashboardPage() {
  const { user } = useAuth();

  return (
    <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
          Selamat Datang, Wali Santri
        </h1>
        <p style={{ color: '#64748B', fontSize: '15px' }}>
          Anda login sebagai wali dari ananda <strong style={{ color: '#0F6E56' }}>{user?.nama}</strong>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Card Kehadiran & Pelanggaran */}
        <Link to="/santri/riwayat" style={{ textDecoration: 'none' }}>
          <div className="stat-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', transition: 'all 0.3s', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
              <div style={{ backgroundColor: '#F0FDF4', padding: '12px', borderRadius: '12px', color: '#16A34A' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: 600 }}>Riwayat Kehadiran & Pelanggaran</h3>
            </div>
            <p style={{ color: '#64748B', fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
              Pantau absensi kelas, ngaji, shalat jamaah, dan poin catatan pelanggaran tata tertib pesantren ananda.
            </p>
            <div style={{ marginTop: 'auto', paddingTop: '16px', color: '#0F6E56', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Lihat Detail
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
