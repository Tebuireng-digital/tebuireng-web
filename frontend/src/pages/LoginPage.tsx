import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
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

      const response = await api.post('/api/login', { username, password });
      if (response.data && response.data.user) {
        login({ ...response.data.user, role: 'petugas' });
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
        <div className="login-hero">
          <div className="login-brand"><span className="brand-mark">TI</span><span>Pondok Pesantren Tebuireng</span></div>
          <div className="login-illustration" aria-hidden="true">
            <span className="mosque-dome"></span><span className="mosque-tower left"></span><span className="mosque-tower right"></span>
          </div>
          <p>Selamat datang</p>
          <h1 className="login-title">Sistem Kepesantrenan</h1>
          <p className="login-hero-copy">Kelola kegiatan dan pendataan santri dalam satu aplikasi.</p>
        </div>

        <div className="login-form-panel">
        <p className="login-subtitle">Masuk ke akun petugas</p>

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', border: '1px solid #fecaca' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="login-input-group">
            <label className="ui-text-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--tinta-pudar)' }}>
              Username petugas
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              placeholder="Masukkan username"
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
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
        <p className="login-footer">Pondok Pesantren Tebuireng · Jombang</p>
        </div>
      </div>
    </div>
  );
}
