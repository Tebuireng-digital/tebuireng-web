import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';

export function LoginPage() {
  const { login } = useAuth();
  const [loginType, setLoginType] = useState<'petugas' | 'santri'>('petugas');
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('password');
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Sanctum CSRF protection
      await api.get('/sanctum/csrf-cookie');

      if (loginType === 'petugas') {
        const response = await api.post('/api/login', { username, password });
        if (response.data && response.data.user) {
          login({ ...response.data.user, role: 'petugas' });
        }
      } else {
        const response = await api.post('/api/santri/login', { nis: username, password });
        if (response.data && response.data.user) {
          login({ ...response.data.user, role: 'santri' });
        }
      }
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Terjadi kesalahan saat login.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        <h1 className="login-title">Sistem Absensi</h1>
        <p className="login-subtitle">Silakan masuk ke akun Anda</p>

        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: '24px', backgroundColor: '#F1F5F9', borderRadius: '12px', padding: '4px' }}>
          <button
            type="button"
            onClick={() => setLoginType('petugas')}
            style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', backgroundColor: loginType === 'petugas' ? 'white' : 'transparent', color: loginType === 'petugas' ? '#0F6E56' : '#64748B', boxShadow: loginType === 'petugas' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
          >
            Petugas
          </button>
          <button
            type="button"
            onClick={() => setLoginType('santri')}
            style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', backgroundColor: loginType === 'santri' ? 'white' : 'transparent', color: loginType === 'santri' ? '#0F6E56' : '#64748B', boxShadow: loginType === 'santri' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
          >
            Wali Santri
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', border: '1px solid #fecaca' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="login-input-group">
            <label className="ui-text-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--tinta-pudar)' }}>
              {loginType === 'petugas' ? 'Username' : 'NIS (Nomor Induk Santri)'}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              placeholder={loginType === 'petugas' ? 'Contoh: admin, keamanan...' : 'Masukkan NIS...'}
              required
            />
          </div>
          <div className="login-input-group">
            <label className="ui-text-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--tinta-pudar)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                placeholder="••••••••"
                style={{ paddingRight: '48px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--tinta-pudar)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px'
                }}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Memproses...' : (loginType === 'petugas' ? 'Masuk sebagai Petugas' : 'Masuk sebagai Wali Santri')}
          </button>
        </form>

      </div>
    </div>
  );
}
