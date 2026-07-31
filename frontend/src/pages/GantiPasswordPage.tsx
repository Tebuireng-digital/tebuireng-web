import { useState } from 'react';
import { api } from '../api';

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function GantiPasswordPage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 12 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Kata sandi baru minimal 12 karakter serta mengandung huruf dan angka.');
      return;
    }

    if (newPassword !== newPasswordConfirmation) {
      setError('Konfirmasi kata sandi baru tidak sama.');
      return;
    }

    if (oldPassword === newPassword) {
      setError('Kata sandi baru harus berbeda dari kata sandi saat ini.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/ganti-password', {
        old_password: oldPassword,
        new_password: newPassword,
        new_password_confirmation: newPasswordConfirmation
      });
      alert('Kata sandi berhasil diubah! Anda kini dapat mengakses menu lain.');
      window.location.href = '/dashboard';
    } catch (e: any) {
      const validationErrors = e.response?.data?.errors;
      const firstValidationError = validationErrors
        ? Object.values(validationErrors).flat().find((message) => typeof message === 'string')
        : null;
      setError(
        (firstValidationError as string | undefined)
        || e.response?.data?.message
        || 'Gagal mengubah kata sandi. Periksa koneksi lalu coba lagi.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 80px)' }}>
      <div className="stat-card" style={{ width: '100%', maxWidth: '480px', padding: '40px', alignItems: 'stretch' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>Ganti Kata Sandi</h1>
        <p style={{ color: '#64748B', marginBottom: '32px', fontSize: '15px' }}>
          Untuk membuka menu lainnya, buat kata sandi baru yang berbeda dari kata sandi saat ini.
        </p>

        {error && <div className="error-box" role="alert" style={{ marginBottom: '20px' }}>{error}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>Kata Sandi Saat Ini</label>
            <div className="password-field">
              <input
                type={showOldPassword ? 'text' : 'password'}
                className="password-input"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowOldPassword(value => !value)}
                aria-label={showOldPassword ? 'Sembunyikan kata sandi saat ini' : 'Tampilkan kata sandi saat ini'}
                title={showOldPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                <EyeIcon hidden={showOldPassword} />
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>Kata Sandi Baru</label>
            <div className="password-field">
              <input
                type={showNewPassword ? 'text' : 'password'}
                className="password-input"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimal 12 karakter"
                autoComplete="new-password"
                minLength={12}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowNewPassword(value => !value)}
                aria-label={showNewPassword ? 'Sembunyikan kata sandi baru' : 'Tampilkan kata sandi baru'}
                title={showNewPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                <EyeIcon hidden={showNewPassword} />
              </button>
            </div>
            <p className="password-help">Minimal 12 karakter, mengandung huruf dan angka, serta berbeda dari kata sandi saat ini.</p>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>Konfirmasi Kata Sandi Baru</label>
            <div className="password-field">
              <input
                type={showNewPassword ? 'text' : 'password'}
                className="password-input"
                value={newPasswordConfirmation}
                onChange={e => setNewPasswordConfirmation(e.target.value)}
                placeholder="Ulangi kata sandi baru"
                autoComplete="new-password"
                minLength={12}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowNewPassword(value => !value)}
                aria-label={showNewPassword ? 'Sembunyikan konfirmasi kata sandi' : 'Tampilkan konfirmasi kata sandi'}
                title={showNewPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                <EyeIcon hidden={showNewPassword} />
              </button>
            </div>
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
