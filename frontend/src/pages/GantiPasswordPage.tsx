import { useState } from 'react';
import { api } from '../api';

export function GantiPasswordPage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) return;

    setLoading(true);
    try {
      await api.post('/api/ganti-password', {
        old_password: oldPassword,
        new_password: newPassword
      });
      alert('Kata sandi berhasil diubah! Anda kini dapat mengakses menu lain.');
      window.location.href = '/dashboard';
    } catch (e: any) {
      alert('Gagal: ' + (e.response?.data?.message || 'Terjadi kesalahan'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 80px)' }}>
      <div className="stat-card" style={{ width: '100%', maxWidth: '480px', padding: '40px', alignItems: 'stretch' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>Ganti Kata Sandi</h1>
        <p style={{ color: '#64748B', marginBottom: '32px', fontSize: '15px' }}>
          Untuk keamanan akun Anda, silakan perbarui kata sandi Anda secara berkala.
        </p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>Kata Sandi Saat Ini</label>
            <input 
              type="password" 
              style={{ width: '100%', padding: '14px 16px', boxSizing: 'border-box', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '15px', transition: 'all 0.3s ease', outline: 'none' }}
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              onFocus={e => e.target.style.borderColor = '#0F6E56'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>Kata Sandi Baru</label>
            <input 
              type="password" 
              style={{ width: '100%', padding: '14px 16px', boxSizing: 'border-box', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '15px', transition: 'all 0.3s ease', outline: 'none' }}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              onFocus={e => e.target.style.borderColor = '#0F6E56'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              placeholder="••••••••"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '16px', 
              background: 'linear-gradient(90deg, #0F6E56, #1A4D41)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '12px', 
              cursor: 'pointer', 
              marginTop: '8px',
              fontWeight: 700,
              fontSize: '16px',
              boxShadow: '0 4px 12px rgba(15, 110, 86, 0.2)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {loading ? 'Memproses...' : 'Simpan Kata Sandi Baru'}
          </button>
        </form>
      </div>
    </div>
  );
}
