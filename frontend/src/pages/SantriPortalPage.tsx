import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { usePageMeta } from '../hooks/usePageMeta';
import { SantriPortalAuthProvider, useSantriPortalAuth, type SantriUser } from '../SantriPortalAuthContext';

type PortalSection = 'beranda' | 'profil' | 'kehadiran' | 'pelanggaran' | 'perizinan' | 'rapor' | 'prestasi' | 'password' | 'notifikasi' | 'pengaturan';
type PortalRecord = Record<string, any>;

function PortalIcon({ type }: { type: 'home' | 'profile' | 'id-card' | 'lock' | 'bell' | 'settings' | 'award' | 'calendar' | 'warning' | 'permit' | 'report' | 'logout' | 'menu' | 'more' | 'eye' | 'eye-off' }) {
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9h13v-9M9 19v-5h6v5"/></>,
    profile: <><circle cx="12" cy="8" r="3"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
    'id-card': <><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.7-1.3 1.7-2 3-2s2.3.7 3 2M14 10h4M14 14h4"/></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.2 13.8 1.2.9-1.7 2.9-1.4-.6a7.6 7.6 0 0 1-1.7 1l-.2 1.5h-3.4l-.2-1.5a7.6 7.6 0 0 1-1.7-1l-1.4.6-1.7-2.9 1.2-.9a7.4 7.4 0 0 1 0-2.1l-1.2-.9 1.7-2.9 1.4.6a7.6 7.6 0 0 1 1.7-1l.2-1.5h3.4l.2 1.5a7.6 7.6 0 0 1 1.7 1l1.4-.6 1.7 2.9-1.2.9a7.4 7.4 0 0 1 0 2.1Z"/></>,
    award: <><circle cx="12" cy="8" r="4.5"/><path d="m9.5 12-1 8 3.5-2 3.5 2-1-8M10 8l1.3 1.2L13.5 7"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></>,
    warning: <><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4M12 16.5h.01"/></>,
    permit: <><path d="M4 20V8l8-4 8 4v12M8 20V10h8v10M8 14h8"/></>,
    report: <><path d="M6 3h9l3 3v15H6zM14 3v4h4"/><path d="M9 16v-3M12 16V9M15 16v-5"/></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    more: <><circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/></>,
    eye: <><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.5"/></>,
    'eye-off': <><path d="m3 3 18 18M10.6 6.2A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3.2 3.5M6.2 6.8C3.8 8.3 2.5 12 2.5 12a16 16 0 0 0 5.2 4.5A10.7 10.7 0 0 0 12 18c1 0 2-.2 2.8-.5"/></>,
  };
  return <svg className="portal-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[type]}</svg>;
}

function PortalLogin({ onLogin }: { onLogin: (user: SantriUser) => void }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [noId, setNoId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showSessionNotice, setShowSessionNotice] = useState(searchParams.get('reason') === 'session-expired');
  const [loading, setLoading] = useState(false);
  usePageMeta({ title: 'Portal Wali Santri', description: 'Portal wali santri Pondok Pesantren Tebuireng untuk melihat data anak, kehadiran, perizinan, pelanggaran, dan Rapor Pengajian.' });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setShowSessionNotice(false); setError(''); setLoading(true);
    try {
      await api.get('/sanctum/csrf-cookie');
      const response = await api.post('/api/santri-portal/login', { no_id_induk: noId, password });
      onLogin(response.data.user);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login gagal. Periksa Nomor Induk Pondok dan password.');
    } finally { setLoading(false); }
  };

  return <div className="portal-login-page">
    <button type="button" className="login-back-button" onClick={() => navigate('/pilih-login')} aria-label="Kembali ke pilihan login"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
    {showSessionNotice && <div className="session-expired-toast" role="status"><span>Sesi login telah berakhir. Silakan masuk kembali.</span><button type="button" onClick={() => setShowSessionNotice(false)} aria-label="Tutup notifikasi sesi login">×</button></div>}
    <section className="portal-login-card">
    <div className="portal-login-brand"><img src="/simanteb-logo-transparent.png" alt="Logo SIMANTEB"/><strong>Portal Wali Santri</strong><span>SIMANTEB</span></div>
    {error && <div className="portal-alert" role="alert">{error}</div>}
    <form onSubmit={submit} className="portal-login-form">
      <label htmlFor="portal-no-id">Nomor Induk Pondok</label><input id="portal-no-id" value={noId} onChange={e => setNoId(e.target.value)} inputMode="numeric" autoComplete="username" required placeholder="Masukkan nomor induk"/>
      <label htmlFor="portal-password">Password</label><div className="portal-password-input"><input id="portal-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required placeholder="Masukkan password"/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}><PortalIcon type={showPassword ? 'eye-off' : 'eye'}/></button></div>
      <button className="portal-primary-button" disabled={loading}>{loading ? 'Memproses...' : 'Masuk Portal'}</button>
    </form>
  </section><div className="portal-mosque-silhouette" aria-hidden="true"><svg viewBox="0 0 1440 190" preserveAspectRatio="xMidYMax meet"><path d="M0 190V135h90v-22h34v22h42v-55l20-20 20 20v55h46v-28h34v28h42v-42l20-20 20 20v42h54v-68h8v-18h8v18h8v68h53v-35h28v35h50v-57l18-18 18 18v57h48v-27h30v27h45v-80h7v-18h7v18h7v80h54v-35h29v35h46v-55l20-20 20 20v55h51v-88l8-16 8 16v88h55v-45h30v45h47v-69l20-21 20 21v69h58v-28h34v28h43v55h-1440Z"/><path d="M617 190v-74h32V94h12v22h8v-38h12v38h8V94h12v22h32v74h-116Zm13-55h18v-16h12v16h20v-16h12v16h18v37h-80v-37Z"/><path d="M686 82c-18 0-32-14-32-31s14-31 32-31 32 14 32 31-14 31-32 31Zm0-8c12 0 22-10 22-23s-10-23-22-23-22 10-22 23 10 23 22 23Z"/></svg></div></div>;
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const [oldPassword, setOldPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(''); if (newPassword.length < 12 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) { setError('Password baru minimal 12 karakter dan mengandung huruf serta angka.'); return; } if (newPassword !== confirmation) { setError('Konfirmasi password tidak sama.'); return; } setSaving(true); try { await api.post('/api/santri-portal/ganti-password', { old_password: oldPassword, new_password: newPassword, new_password_confirmation: confirmation }); onDone(); } catch (err: any) { setError(err.response?.data?.message || 'Password gagal diubah.'); } finally { setSaving(false); } };
  return <section className="portal-panel portal-password-panel"><p className="eyebrow">Keamanan akun</p><h1>Ganti password</h1><p className="portal-muted">Buat password baru untuk melindungi akses data anak.</p>{error && <div className="portal-alert" role="alert">{error}</div>}<form onSubmit={submit} className="portal-form-grid"><label>Password saat ini<input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} autoComplete="current-password" required/></label><label>Password baru<input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" minLength={12} required/></label><label>Konfirmasi password baru<input type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" minLength={12} required/></label><button className="portal-primary-button" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan password baru'}</button></form></section>;
}

function Summary({ label, value, tone = '' }: { label: string; value: string | number; tone?: string }) { return <article className={`portal-summary ${tone}`}><span>{label}</span><strong>{value}</strong></article>; }

function PortalMobileNav({ activeSection, navigate, onMenu }: { activeSection: PortalSection; navigate: (next: PortalSection) => void; onMenu?: () => void }) {
  const links: Array<[PortalSection, string, Parameters<typeof PortalIcon>[0]['type']]> = [['beranda', 'Beranda', 'home'], ['notifikasi', 'Notifikasi', 'bell'], ['pengaturan', 'Pengaturan', 'settings']];
  return <nav className="portal-mobile-nav" aria-label="Navigasi utama">{links.map(([key, label, icon]) => <button key={key} className={activeSection === key ? 'is-active' : ''} aria-label={label} aria-current={activeSection === key ? 'page' : undefined} onClick={() => navigate(key)}><PortalIcon type={icon}/><span>{label}</span></button>)}<button type="button" aria-label="Buka menu" onClick={() => onMenu?.()}><PortalIcon type="more"/><span>Menu</span></button></nav>;
}

function PortalNotifications() {
  return <section className="portal-notifications-page" aria-labelledby="portal-notifications-title"><p className="eyebrow">Pembaruan</p><h1 id="portal-notifications-title">Notifikasi</h1><div className="portal-notification-empty"><PortalIcon type="bell"/><strong>Belum ada notifikasi</strong><p>Notifikasi penting untuk wali santri akan tampil di sini.</p></div></section>;
}

function PortalSettings({ navigate, logout }: { navigate: (next: PortalSection) => void; logout: () => Promise<void> }) {
  return <section className="portal-settings-page" aria-labelledby="portal-settings-title"><p className="eyebrow">Akun</p><h1 id="portal-settings-title">Pengaturan</h1><p className="portal-muted">Kelola akses dan informasi akun wali santri.</p><ul className="portal-settings-list"><li><button type="button" disabled><PortalIcon type="profile"/><span><strong>Ganti foto</strong><small>Belum tersedia</small></span></button></li><li><button type="button" disabled><PortalIcon type="id-card"/><span><strong>Ganti nama</strong><small>Belum tersedia</small></span></button></li><li><button type="button" onClick={() => navigate('password')}><PortalIcon type="lock"/><span><strong>Ganti password</strong><small>Perbarui keamanan akun</small></span></button></li><li><button type="button" className="portal-settings-logout" onClick={() => void logout()}><PortalIcon type="logout"/><span><strong>Keluar</strong><small>Akhiri sesi portal</small></span></button></li></ul></section>;
}

function portalDateValue(value: unknown) {
  if (!value) return null;
  const dateText = String(value).slice(0, 10);
  const date = new Date(`${dateText}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function portalDateLabel(value: unknown, useTodayLabel = false) {
  const date = portalDateValue(value);
  const today = new Date();
  if (useTodayLabel && date && date.toDateString() === today.toDateString()) return 'Hari ini';
  return date ? date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-';
}

function portalSortByDate(records: PortalRecord[], field: string) {
  return [...records].sort((first, second) => String(second[field] || '').localeCompare(String(first[field] || '')));
}

function portalAssignmentLabel(user: SantriUser, code: string, value?: string | null) {
  if (value?.trim()) return value;
  const status = user.partisipasi_kegiatan?.[code];
  if (status === 'terdaftar') return 'Terdaftar';
  if (status === 'tidak_ikut') return 'Tidak mengikuti';
  if (status === 'perlu_verifikasi') return 'Menunggu penetapan';
  return 'Belum ditetapkan';
}

function PortalDashboardDetails({ attendance, violations, permits }: { attendance: PortalRecord[]; violations: PortalRecord[]; permits: PortalRecord[] }) {
  const currentDate = new Date();
  const attendanceThisMonth = portalSortByDate(attendance.filter(record => {
    const date = portalDateValue(record.tanggal);
    return date && date.getFullYear() === currentDate.getFullYear() && date.getMonth() === currentDate.getMonth();
  }), 'tanggal').slice(0, 5);
  const latestViolations = portalSortByDate(violations, 'tanggal').slice(0, 3);
  const latestPermits = portalSortByDate(permits, 'tanggal_mulai').slice(0, 3);
  const renderEmpty = (label: string) => <p className="portal-detail-empty">Belum ada {label}.</p>;
  return <section className="portal-dashboard-details" aria-labelledby="portal-details-title"><div className="portal-dashboard-section-heading"><h2 id="portal-details-title">Ringkasan terbaru</h2></div><div className="portal-detail-grid"><article className="portal-detail-group"><div className="portal-detail-heading"><h3>Absensi bulan ini</h3><span>{attendanceThisMonth.length} kegiatan</span></div>{attendanceThisMonth.length ? <ul>{attendanceThisMonth.map((record, index) => <li key={record.absensi_id || index}><span>{record.nama_kegiatan || 'Kegiatan'}</span><small>{portalDateLabel(record.tanggal, true)} · {record.status || 'Belum ada status'}</small></li>)}</ul> : renderEmpty('absensi bulan ini')}</article><article className="portal-detail-group"><div className="portal-detail-heading"><h3>Pelanggaran</h3><span>{violations.length} catatan</span></div>{latestViolations.length ? <ul>{latestViolations.map((record, index) => <li key={record.pelanggaran_id || index}><span>{record.kategori || 'Catatan pelanggaran'}</span><small>{portalDateLabel(record.tanggal)}{record.poin ? ` · ${record.poin} poin` : ''}</small></li>)}</ul> : renderEmpty('pelanggaran')}</article><article className="portal-detail-group"><div className="portal-detail-heading"><h3>Perizinan</h3><span>{permits.length} catatan</span></div>{latestPermits.length ? <ul>{latestPermits.map((record, index) => <li key={record.perizinan_id || index}><span>{record.jenis_izin_nama || 'Pengajuan izin'}</span><small>{portalDateLabel(record.tanggal_mulai)} · {record.status || 'Menunggu status'}</small></li>)}</ul> : renderEmpty('perizinan')}</article></div></section>;
}

function PortalDashboardPage({ user, logout, mobileOpen, setMobileOpen, navigate, attendance, violations, permits }: { user: SantriUser; logout: () => Promise<void>; mobileOpen: boolean; setMobileOpen: (open: boolean) => void; navigate: (next: PortalSection) => void; attendance: PortalRecord[]; violations: PortalRecord[]; permits: PortalRecord[] }) {
  const assignments: Array<[string, string]> = [
    ['Kamar', portalAssignmentLabel(user, 'KAMAR', user.nama_kamar)],
    ['Madin', portalAssignmentLabel(user, 'DINIYAH', user.nama_madin)],
    ["Al-Qur'an Subuh", portalAssignmentLabel(user, 'PBS', user.nama_al_quran_subuh)],
    ['Takhasus', portalAssignmentLabel(user, 'PBM', user.nama_takhasus)],
  ];

  return (
    <div className="portal-layout portal-dashboard-layout">
      <header className="portal-topbar">
        <button className="portal-menu-button" aria-label="Buka menu" onClick={() => setMobileOpen(true)}>
          <PortalIcon type="more"/>
        </button>
        <div className="portal-top-brand">
          <img src="/simanteb-logo-transparent.png" alt="Logo SIMANTEB"/>
          <span>Portal Wali Santri</span>
        </div>
        <div className="portal-top-user">
          <span>{user.nama_wali || 'Wali Santri'}</span>
          <button onClick={() => void logout()} aria-label="Keluar">
            <PortalIcon type="logout"/>
          </button>
        </div>
      </header>

      <aside className={`portal-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="portal-sidebar-heading">
          <div>
            <p className="eyebrow">SIMANTEB</p>
            <strong>Portal Wali Santri</strong>
          </div>
          <button className="portal-close-button" onClick={() => setMobileOpen(false)} aria-label="Tutup menu">×</button>
        </div>
        <nav aria-label="Navigasi portal wali santri">
          <button className="is-active" onClick={() => navigate('beranda')}><PortalIcon type="home"/><span>Beranda</span></button>
          <button onClick={() => navigate('profil')}><PortalIcon type="id-card"/><span>Data Anak</span></button>
          <button onClick={() => navigate('kehadiran')}><PortalIcon type="calendar"/><span>Kehadiran</span></button>
          <button onClick={() => navigate('pelanggaran')}><PortalIcon type="warning"/><span>Pelanggaran</span></button>
          <button onClick={() => navigate('perizinan')}><PortalIcon type="permit"/><span>Perizinan</span></button>
          <button onClick={() => navigate('rapor')}><PortalIcon type="report"/><span>Rapor Pengajian</span></button>
          <button onClick={() => navigate('prestasi')}><PortalIcon type="award"/><span>Prestasi</span></button>
          <button onClick={() => navigate('password')}><PortalIcon type="lock"/><span>Ganti Password</span></button>
        </nav>
        <button className="portal-sidebar-logout" onClick={() => void logout()}><PortalIcon type="logout"/><span>Keluar</span></button>
      </aside>

      {mobileOpen && <button className="portal-overlay" aria-label="Tutup menu" onClick={() => setMobileOpen(false)}/>}

      <main className="portal-main">
        <div className="portal-content">
          <section className="portal-dashboard-home" aria-labelledby="portal-dashboard-title">
            <header className="portal-dashboard-welcome">
              <h1 id="portal-dashboard-title">Selamat datang, <strong>Bapak/Ibu</strong></h1>
            </header>
            <section className="portal-child-banner" aria-labelledby="portal-child-name">
              <div>
                <p className="eyebrow">Data anak</p>
                <h2 id="portal-child-name">{user.nama}</h2>
                <span className="portal-class-pill">{user.nama_kelas || user.tingkat ? `Kelas ${user.nama_kelas || user.tingkat}` : 'Kelas'}</span>
                <div className="portal-assignment-list">
                  {assignments.map(([label, value]) => <span key={label}><small>{label}</small><strong>{value}</strong></span>)}
                </div>
              </div>
              {user.foto_url ? (
                <img
                  src={user.foto_url}
                  alt={user.nama}
                  className="portal-child-photo"
                  style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.8)', flexShrink: 0 }}
                />
              ) : (
                <PortalIcon type="profile"/>
              )}
            </section>
            <section className="portal-dashboard-section" aria-labelledby="portal-features-title">
              <div className="portal-dashboard-section-heading">
                <h2 id="portal-features-title">Fitur</h2>
              </div>
              <div className="portal-feature-grid">
                <button onClick={() => navigate('profil')}><PortalIcon type="id-card"/><strong>Data Anak</strong></button>
                <button onClick={() => navigate('kehadiran')}><PortalIcon type="calendar"/><strong>Kehadiran</strong></button>
                <button onClick={() => navigate('pelanggaran')}><PortalIcon type="warning"/><strong>Pelanggaran</strong></button>
                <button onClick={() => navigate('perizinan')}><PortalIcon type="permit"/><strong>Perizinan</strong></button>
                <button onClick={() => navigate('rapor')}><PortalIcon type="report"/><strong>Rapor</strong></button>
                <button onClick={() => navigate('prestasi')}><PortalIcon type="award"/><strong>Prestasi</strong></button>
              </div>
            </section>
            <PortalDashboardDetails attendance={attendance} violations={violations} permits={permits}/>
          </section>
        </div>
        <PortalMobileNav activeSection="beranda" navigate={navigate} onMenu={() => setMobileOpen(true)}/>
      </main>
    </div>
  );
}

function PortalSectionShell({ user, logout, mobileOpen, setMobileOpen, navigate, menu, children }: { user: SantriUser; logout: () => Promise<void>; mobileOpen: boolean; setMobileOpen: (open: boolean) => void; navigate: (next: PortalSection) => void; menu: Array<[PortalSection, string, Parameters<typeof PortalIcon>[0]['type']]>; children: React.ReactNode }) {
  return <div className="portal-layout"><header className="portal-topbar"><button className="portal-menu-button" aria-label="Buka menu" onClick={() => setMobileOpen(true)}><PortalIcon type="more"/></button><div className="portal-top-brand"><img src="/simanteb-logo-transparent.png" alt="Logo SIMANTEB"/><span>Portal Wali Santri</span></div><div className="portal-top-user"><span>{user.nama_wali || 'Wali Santri'}</span><button onClick={() => void logout()} aria-label="Keluar"><PortalIcon type="logout"/></button></div></header><aside className={`portal-sidebar ${mobileOpen ? 'is-open' : ''}`}><div className="portal-sidebar-heading"><div><p className="eyebrow">SIMANTEB</p><strong>Portal Wali Santri</strong></div><button className="portal-close-button" onClick={() => setMobileOpen(false)} aria-label="Tutup menu">×</button></div><nav aria-label="Navigasi portal wali santri">{menu.map(([key, label, icon]) => <button key={key} className={key === 'prestasi' ? 'is-active' : ''} onClick={() => navigate(key)}><PortalIcon type={icon}/><span>{label}</span></button>)}<button onClick={() => navigate('password')}><PortalIcon type="lock"/><span>Ganti Password</span></button></nav><button className="portal-sidebar-logout" onClick={() => void logout()}><PortalIcon type="logout"/><span>Keluar</span></button></aside>{mobileOpen && <button className="portal-overlay" aria-label="Tutup menu" onClick={() => setMobileOpen(false)}/>}<main className="portal-main"><div className="portal-content">{children}</div><PortalMobileNav activeSection="prestasi" navigate={navigate} onMenu={() => setMobileOpen(true)}/></main></div>;
}

function PortalWorkspace() {
  const { user, logout } = useSantriPortalAuth(); const [section, setSection] = useState<PortalSection>('beranda'); const [mobileOpen, setMobileOpen] = useState(false);
  const [attendance, setAttendance] = useState<PortalRecord[]>([]); const [violations, setViolations] = useState<PortalRecord[]>([]); const [permits, setPermits] = useState<PortalRecord[]>([]); const [achievements, setAchievements] = useState<PortalRecord[]>([]); const [loading, setLoading] = useState(true); const [raporYear, setRaporYear] = useState('2026/2027'); const [raporSemester, setRaporSemester] = useState<'Gasal' | 'Genap'>('Gasal'); const [reports, setReports] = useState<PortalRecord[]>([]); const [raporLoading, setRaporLoading] = useState(false);
  const [portalError, setPortalError] = useState('');
  usePageMeta({ title: section === 'beranda' ? 'Beranda Portal Wali Santri' : section === 'rapor' ? 'Rapor Pengajian Anak' : section[0].toUpperCase() + section.slice(1), description: 'Portal wali santri Pondok Pesantren Tebuireng untuk memantau data anak.' });
  useEffect(() => { Promise.all([api.get('/api/santri-portal/kehadiran'), api.get('/api/santri-portal/pelanggaran'), api.get('/api/santri-portal/perizinan'), api.get('/api/santri-portal/prestasi')]).then(([a, v, p, pr]) => { setAttendance(a.data); setViolations(v.data); setPermits(p.data); setAchievements(pr.data); }).catch(() => setPortalError('Data anak belum dapat dimuat. Periksa koneksi lalu coba muat ulang halaman.')).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (section !== 'rapor') return; setRaporLoading(true); api.get('/api/santri-portal/rapor-pengajian', { params: { tahun_pelajaran: raporYear, semester: raporSemester } }).then(response => setReports(response.data.reports)).catch(() => setReports([])).finally(() => setRaporLoading(false)); }, [section, raporYear, raporSemester]);
  const attendanceCount = useMemo(() => attendance.reduce<Record<string, number>>((result, row) => { result[row.status] = (result[row.status] || 0) + 1; return result; }, {}), [attendance]);
  const navigate = (next: PortalSection) => { setSection(next); setMobileOpen(false); };
  const downloadRapor = async () => { const response = await api.get('/api/santri-portal/rapor-pengajian/pdf', { params: { tahun_pelajaran: raporYear, semester: raporSemester }, responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = `Rapor_Pengajian_${raporYear}_${raporSemester}.pdf`; link.click(); URL.revokeObjectURL(url); };
  const menu: Array<[PortalSection, string, Parameters<typeof PortalIcon>[0]['type']]> = [['beranda', 'Beranda', 'home'], ['profil', 'Data Anak', 'profile'], ['kehadiran', 'Kehadiran', 'calendar'], ['pelanggaran', 'Pelanggaran', 'warning'], ['perizinan', 'Perizinan', 'permit'], ['rapor', 'Rapor Pengajian', 'report'], ['prestasi', 'Prestasi', 'award']];
  if (!user) return null;
  const activeSection = section;
  if (activeSection === 'beranda') return <PortalDashboardPage user={user} logout={logout} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} navigate={navigate} attendance={attendance} violations={violations} permits={permits}/>;
  if (activeSection === 'prestasi') return <PortalSectionShell user={user} logout={logout} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} navigate={navigate} menu={menu}><RecordTable title="Prestasi Anak" records={achievements} loading={loading} columns={['tanggal', 'nama_prestasi', 'peringkat', 'tingkat', 'keterangan']}/></PortalSectionShell>;
  return <div className="portal-layout"><header className="portal-topbar"><button className="portal-menu-button" aria-label="Buka menu" onClick={() => setMobileOpen(true)}><PortalIcon type="more"/></button><div className="portal-top-brand"><img src="/simanteb-logo-transparent.png" alt="Logo SIMANTEB"/><span>Portal Wali Santri</span></div><div className="portal-top-user"><span>{user.nama_wali || 'Wali Santri'}</span><button onClick={() => void logout()} aria-label="Keluar"><PortalIcon type="logout"/></button></div></header><aside className={`portal-sidebar ${mobileOpen ? 'is-open' : ''}`}><div className="portal-sidebar-heading"><div><p className="eyebrow">SIMANTEB</p><strong>Portal Wali Santri</strong></div><button className="portal-close-button" onClick={() => setMobileOpen(false)} aria-label="Tutup menu">×</button></div><nav aria-label="Navigasi portal wali santri">{menu.map(([key, label, icon]) => <button key={key} className={section === key ? 'is-active' : ''} onClick={() => navigate(key)}><PortalIcon type={icon}/><span>{label}</span></button>)}<button onClick={() => navigate('password')}><PortalIcon type="lock"/><span>Ganti Password</span></button></nav><button className="portal-sidebar-logout" onClick={() => void logout()}><PortalIcon type="logout"/><span>Keluar</span></button></aside>{mobileOpen && <button className="portal-overlay" aria-label="Tutup menu" onClick={() => setMobileOpen(false)}/>}<main className="portal-main"><div className="portal-content">{portalError && <div className="portal-alert" role="alert">{portalError}</div>}{section === 'password' && <ChangePassword onDone={() => { navigate('beranda'); window.location.reload(); }}/>} {section === 'beranda' && <><div className="portal-page-heading"><p className="eyebrow">Data anak</p><h1>Assalamu’alaikum, {user.nama_wali || 'Wali Santri'}</h1><p>Berikut ringkasan data anak Anda di SIMANTEB.</p></div><div className="portal-summary-grid"><Summary label="Hadir" value={attendanceCount.Hadir || 0} tone="is-positive"/><Summary label="Izin" value={attendanceCount.Izin || 0} tone="is-warning"/><Summary label="Bolos/Alpha" value={attendanceCount.Alpha || 0} tone="is-danger"/><Summary label="Pelanggaran" value={violations.length} tone="is-neutral"/></div><section className="portal-panel"><div className="portal-panel-heading"><div><p className="eyebrow">Pantauan anak</p><h2>{user.nama}</h2></div></div><div className="portal-quick-links">{menu.slice(2).map(([key, label, icon]) => <button key={key} onClick={() => navigate(key)}><PortalIcon type={icon}/><span>{label}</span></button>)}</div></section></>}{section === 'profil' && <Profile user={user}/>} {section === 'kehadiran' && <RecordTable title="Kehadiran Anak" records={attendance} loading={loading} columns={['tanggal', 'nama_kegiatan', 'status', 'keterangan']}/>} {section === 'pelanggaran' && <RecordTable title="Pelanggaran Anak" records={violations} loading={loading} columns={['tanggal', 'kategori', 'poin', 'keterangan']}/>} {section === 'perizinan' && <RecordTable title="Perizinan Anak" records={permits} loading={loading} columns={['tanggal_mulai', 'jenis_izin_nama', 'status', 'keperluan']}/>} {section === 'rapor' && <RaporSection year={raporYear} semester={raporSemester} onYear={setRaporYear} onSemester={setRaporSemester} reports={reports} loading={raporLoading} onDownload={() => void downloadRapor()}/>}{section === 'notifikasi' && <PortalNotifications/>} {section === 'pengaturan' && <PortalSettings navigate={navigate} logout={logout}/>} </div><PortalMobileNav activeSection={section} navigate={navigate}/></main></div>;
}

function Profile({ user }: { user: SantriUser }) {
  const formatDate = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const assignmentStatus = (code: string) => { const status = user.partisipasi_kegiatan?.[code]; if (status === 'terdaftar') return 'Terdaftar'; if (status === 'tidak_ikut') return 'Tidak mengikuti'; if (status === 'perlu_verifikasi') return 'Menunggu penetapan'; return null; };
  const assignmentDetails: Array<[string, string | null | undefined]> = [['Unit pendidikan', user.unit_kode], ['Kelas formal', user.tingkat && user.nama_kelas ? `${user.tingkat} ${user.nama_kelas}` : user.nama_kelas], ['Kamar', user.nama_kamar || assignmentStatus('KAMAR')], ['Madin', user.nama_madin || assignmentStatus('DINIYAH')], ["Al-Qur'an Subuh", user.nama_al_quran_subuh || assignmentStatus('PBS')], ['Takhasus', user.nama_takhasus || assignmentStatus('PBM')]];
  const identityDetails: Array<[string, string | null | undefined]> = [['Nama lengkap', user.nama], ['Nomor Induk Pondok', user.no_id_induk], ['NIK', user.nik_siswa], ['Jenis kelamin', user.jenis_kelamin === 'L' ? 'Laki-laki' : user.jenis_kelamin === 'P' ? 'Perempuan' : user.jenis_kelamin], ['Tempat lahir', user.tempat_lahir], ['Tanggal lahir', formatDate(user.tanggal_lahir)], ['Nomor HP santri', user.no_hp_santri]];
  const educationDetails: Array<[string, string | null | undefined]> = [['Tahun ajaran', user.tahun_ajaran], ['Pendidikan', user.pend_sumber], ['Kelas sumber', user.kelas_sumber], ['Jurusan', user.jurusan], ['Kelas paralel', user.kelas_paralel], ['Asal sekolah', user.asal_sekolah], ['Jenis sekolah', user.jenis_sekolah], ['Status sekolah', user.status_sekolah], ['Ranking', user.ranking]];
  const familyDetails: Array<[string, string | null | undefined]> = [['Nama wali', user.nama_wali], ['Nomor HP wali', user.no_hp_wali], ['Nama ayah', user.nama_ayah], ['Pendidikan ayah', user.pendidikan_ayah], ['Pekerjaan ayah', user.pekerjaan_ayah], ['Nama ibu', user.nama_ibu], ['Pendidikan ibu', user.pendidikan_ibu], ['Pekerjaan ibu', user.pekerjaan_ibu]];
  const addressDetails: Array<[string, string | null | undefined]> = [['Alamat jalan', user.alamat_jalan], ['Desa/Kelurahan', user.desa_kelurahan], ['Kecamatan', user.kecamatan], ['Kabupaten/Kota', user.kabupaten_kota], ['Provinsi', user.provinsi], ['Kode pos', user.kode_pos]];
  return <section className="portal-profile-page" aria-labelledby="portal-profile-title"><header className="portal-page-heading" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>{user.foto_url ? <img src={user.foto_url} alt={user.nama} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #0f6e56', flexShrink: 0 }} /> : null}<div><p className="eyebrow">Profil santri</p><h1 id="portal-profile-title">Data Anak</h1><p>Informasi anak, pendidikan, penempatan, dan keluarga.</p></div></header><div className="portal-profile-sections"><ProfileSection title="Identitas" details={identityDetails}/><ProfileSection title="Penempatan" details={assignmentDetails}/><ProfileSection title="Pendidikan" details={educationDetails}/><ProfileSection title="Keluarga" details={familyDetails}/><ProfileSection title="Domisili" details={addressDetails}/></div></section>;
}

function ProfileSection({ title, details }: { title: string; details: Array<[string, string | null | undefined]> }) {
  const availableDetails = details.filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '');
  return <article className="portal-profile-card"><header><p className="eyebrow">Data anak</p><h2>{title}</h2></header>{availableDetails.length ? <dl>{availableDetails.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p className="portal-profile-empty">Belum ada data yang tercatat.</p>}</article>;
}
function portalColumnLabel(column: string) { return column.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()); }
function recordContext(title: string) { if (title.includes('Kehadiran')) return 'Aktivitas harian'; if (title.includes('Pelanggaran')) return 'Catatan pembinaan'; if (title.includes('Perizinan')) return 'Pengajuan izin'; return 'Pencapaian anak'; }
function RecordTable({ title, records, loading, columns }: { title: string; records: PortalRecord[]; loading: boolean; columns: string[] }) { return <section className="portal-feature-page"><header className="portal-page-heading"><p className="eyebrow">{recordContext(title)}</p><h1>{title}</h1><p>Riwayat yang tercatat untuk anak Anda di SIMANTEB.</p></header><section className="portal-panel portal-data-panel"><div className="portal-panel-heading"><div><p className="eyebrow">Riwayat</p><h2>Daftar catatan</h2></div><span className="portal-count">{records.length} catatan</span></div>{loading ? <p className="portal-muted">Memuat data...</p> : records.length === 0 ? <p className="portal-empty">Belum ada data untuk ditampilkan.</p> : <div className="portal-table-wrap"><table className="portal-table"><thead><tr>{columns.map(column => <th key={column}>{portalColumnLabel(column)}</th>)}</tr></thead><tbody>{records.map((record, index) => <tr key={record.absensi_id || record.pelanggaran_id || record.perizinan_id || record.prestasi_id || index}>{columns.map(column => <td key={column}>{record[column] ?? '-'}</td>)}</tr>)}</tbody></table></div>}</section></section>; }
function RaporSection({ year, semester, onYear, onSemester, reports, loading, onDownload }: { year: string; semester: 'Gasal' | 'Genap'; onYear: (value: string) => void; onSemester: (value: 'Gasal' | 'Genap') => void; reports: PortalRecord[]; loading: boolean; onDownload: () => void }) { return <section className="portal-feature-page"><header className="portal-page-heading"><p className="eyebrow">Nilai pengajian</p><h1>Rapor Pengajian</h1><p>Pilih tahun ajaran dan semester untuk melihat rapor anak.</p></header><section className="portal-panel portal-data-panel"><div className="portal-filter-grid"><label>Tahun Ajaran<input value={year} onChange={e => onYear(e.target.value)} placeholder="2026/2027"/></label><label>Semester<select value={semester} onChange={e => onSemester(e.target.value as 'Gasal' | 'Genap')}><option value="Gasal">GASAL</option><option value="Genap">GENAP</option></select></label></div>{loading ? <p className="portal-muted">Memuat rapor...</p> : reports.length === 0 ? <div className="portal-empty"><strong>Rapor Pengajian belum tersedia.</strong><span>Periksa tahun ajaran atau semester lain. Jika tetap belum tampil, hubungi pengelola pesantren.</span></div> : <><div className="portal-report-list">{reports.map(report => <article key={report.raport_id}><strong>{report.bulan}/{report.tahun}</strong><span>{report.predikat_umum || 'Nilai tersedia'}</span></article>)}</div><button className="portal-primary-button portal-download-button" onClick={onDownload}>Cetak Rapor Pengajian</button></>}</section></section>; }

function PortalRouter() { const { user, loading, login } = useSantriPortalAuth(); if (loading) return <div className="portal-loading">Memuat portal...</div>; if (!user) return <PortalLogin onLogin={login}/>; return <PortalWorkspace/>; }
export function SantriPortalPage() { return <SantriPortalAuthProvider><PortalRouter/></SantriPortalAuthProvider>; }
