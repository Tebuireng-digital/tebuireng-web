import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Sanctum CSRF protection
      await api.get('/sanctum/csrf-cookie');
      
      // Attempt login
      const response = await api.post('/api/login', { username, password });
      
      if (response.data && response.data.user) {
        login(response.data.user);
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--kertas)' }}>
      <div style={{ backgroundColor: 'var(--kertas-kartu)', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <h1 className="ui-text-title" style={{ textAlign: 'center', marginBottom: '8px' }}>Sistem Absensi</h1>
        <p className="ui-text-body" style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--teks-sekunder)' }}>Silakan masuk ke akun Anda</p>
        
        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="ui-text-label" style={{ display: 'block', marginBottom: '4px' }}>Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              className="ui-input" 
              placeholder="Contoh: admin, pengasuh, keamanan"
              required 
            />
          </div>
          <div>
            <label className="ui-text-label" style={{ display: 'block', marginBottom: '4px' }}>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="ui-input" 
              required 
            />
          </div>
          <button type="submit" className="ui-btn ui-btn-primary" disabled={loading} style={{ marginTop: '8px', width: '100%' }}>
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--garis)', fontSize: '14px', color: 'var(--teks-sekunder)' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Akun Uji Coba Tersedia (Password: password):</p>
          <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li><code>admin</code> (Admin)</li>
            <li><code>pengasuh</code> (Pengasuh)</li>
            <li><code>keamanan</code> (Keamanan)</li>
            <li><code>walikelas</code> (Wali Kelas)</li>
            <li><code>pembinakamar</code> (Pembina Kamar)</li>
            <li><code>ustadz</code> (Ustadz)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
