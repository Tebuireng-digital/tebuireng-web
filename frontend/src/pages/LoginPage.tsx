import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { usePageMeta } from '../hooks/usePageMeta';

export function LoginPage() {
  usePageMeta({
    title: 'Masuk Petugas',
    description: 'Masuk ke akun petugas SIMANTEB untuk mengelola kegiatan dan pendataan santri Pondok Pesantren Tebuireng.',
  });

  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showSessionNotice, setShowSessionNotice] = useState(searchParams.get('reason') === 'session-expired');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSessionNotice(false);
    setError('');
    setLoading(true);

    try {
      // Sanctum CSRF protection
      await api.get('/sanctum/csrf-cookie');

      const response = await api.post('/api/login', { username, password });
      if (response.data && response.data.user) {
        login({ ...response.data.user, role: 'petugas' });
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.message) {
        const serverMessage = String(err.response.data.message);
        setError(serverMessage.toLowerCase().includes('csrf')
          ? 'Sesi login tidak valid. Muat ulang halaman lalu coba lagi.'
          : serverMessage);
      } else {
        setError('Login gagal. Periksa koneksi lalu coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return <div className="portal-login-page petugas-login-page">
    <button type="button" className="login-back-button" onClick={() => navigate('/pilih-login')} aria-label="Kembali ke pilihan login"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
    {showSessionNotice && <div className="session-expired-toast" role="status"><span>Sesi login telah berakhir. Silakan masuk kembali.</span><button type="button" onClick={() => setShowSessionNotice(false)} aria-label="Tutup notifikasi sesi login">×</button></div>}
    <section className="portal-login-card">
    <div className="portal-login-brand"><img src="/simanteb-logo-transparent.png" alt="Logo SIMANTEB"/><strong>Login Petugas</strong><span>SIMANTEB</span></div>
    {error && <div className="portal-alert" role="alert" aria-live="assertive">{error}</div>}
    <form onSubmit={handleSubmit} className="portal-login-form">
      <label htmlFor="login-username">Username Petugas</label>
      <input id="login-username" type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required placeholder="Masukkan username"/>
      <label htmlFor="login-password">Password</label>
      <div className="portal-password-input"><input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required placeholder="Masukkan password"/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}><svg className="portal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{showPassword ? <><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-3.1 4.3M6.2 6.2C3.1 8.3 1 12 1 12s4 8 11 8a10.8 10.8 0 0 0 4.1-.8"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}</svg></button></div>
      <button className="portal-primary-button" disabled={loading}>{loading ? 'Memproses...' : 'Masuk Petugas'}</button>
    </form>
  </section><div className="portal-mosque-silhouette" aria-hidden="true"><svg viewBox="0 0 1440 190" preserveAspectRatio="xMidYMax meet"><path d="M0 190V135h90v-22h34v22h42v-55l20-20 20 20v55h46v-28h34v28h42v-42l20-20 20 20v42h54v-68h8v-18h8v18h8v68h53v-35h28v35h50v-57l18-18 18 18v57h48v-27h30v27h45v-80h7v-18h7v18h7v80h54v-35h29v35h46v-55l20-20 20 20v55h51v-88l8-16 8 16v88h55v-45h30v45h47v-69l20-21 20 21v69h58v-28h34v28h43v55h-1440Z"/><path d="M617 190v-74h32V94h12v22h8v-38h12v38h8V94h12v22h32v74h-116Zm13-55h18v-16h12v16h20v-16h12v16h18v37h-80v-37Z"/><path d="M686 82c-18 0-32-14-32-31s14-31 32-31 32 14 32 31-14 31-32 31Zm0-8c12 0 22-10 22-23s-10-23-22-23-22 10-22 23 10 23 22 23Z"/></svg></div></div>;
}
