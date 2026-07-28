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
    <div className="app-container" style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
      <div style={{ backgroundColor: 'var(--kertas-kartu)', padding: '32px', borderRadius: '8px', width: '100%', maxWidth: '400px' }}>
        <h1 className="ui-text-title" style={{ marginBottom: '16px', color: 'var(--status-alpha)' }}>Perhatian</h1>
        <p className="ui-text-body" style={{ marginBottom: '24px' }}>Kata sandi Anda telah di-reset oleh Admin. Anda <strong>wajib</strong> mengganti kata sandi sekarang sebelum dapat menggunakan aplikasi.</p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="ui-text-label" style={{ display: 'block', marginBottom: '8px' }}>Kata Sandi Saat Ini</label>
            <input 
              type="password" 
              className="ui-text-body"
              style={{ width: '100%', padding: '12px', boxSizing: 'border-box', border: '1px solid var(--garis)', borderRadius: '4px' }}
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="ui-text-label" style={{ display: 'block', marginBottom: '8px' }}>Kata Sandi Baru</label>
            <input 
              type="password" 
              className="ui-text-body"
              style={{ width: '100%', padding: '12px', boxSizing: 'border-box', border: '1px solid var(--garis)', borderRadius: '4px' }}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '16px', backgroundColor: 'var(--aksen)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '16px' }}
            className="ui-text-title"
          >
            {loading ? 'Memproses...' : 'Simpan Kata Sandi Baru'}
          </button>
        </form>
      </div>
    </div>
  );
}
