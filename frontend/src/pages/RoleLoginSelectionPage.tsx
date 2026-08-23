import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';

type LoginRole = 'petugas' | 'wali-santri';

function RoleIcon({ role }: { role: LoginRole }) {
  if (role === 'petugas') {
    return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 24h32v28H16z"/><path d="M22 24v-6a10 10 0 0 1 20 0v6M26 34h12M32 30v14"/><path d="M10 52h44"/></svg>;
  }
  return <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="21" r="9"/><path d="M16 52c1-11 7-17 16-17s15 6 16 17"/><path d="M19 23c2-8 8-13 15-13 8 0 13 5 15 13M12 52h40"/></svg>;
}

export function RoleLoginSelectionPage() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<LoginRole | null>(null);
  usePageMeta({
    title: 'Pilih Akses Login · SIMANTEB',
    description: 'Pilih akses login petugas atau wali santri SIMANTEB.',
  });

  const chooseRole = (role: LoginRole) => {
    setSelectedRole(role);
  };

  const continueToLogin = () => {
    if (!selectedRole) return;
    navigate(selectedRole === 'petugas' ? '/login' : '/portal-santri/login');
  };

  return <main className={`role-login-page ${selectedRole ? 'has-selection' : ''}`}>
    <section className="role-login-shell" aria-labelledby="role-login-title">
      <div className="role-login-heading">
        <p className="eyebrow">SIMANTEB</p>
        <h1 id="role-login-title">Masuk ke SIMANTEB</h1>
        <p>Pilih akses untuk melanjutkan.</p>
      </div>
      <div className="role-login-options">
        {(['petugas', 'wali-santri'] as LoginRole[]).map(role => {
          const isSelected = selectedRole === role;
          return <button key={role} type="button" className={`role-login-option ${isSelected ? 'is-selected' : ''}`} onClick={() => chooseRole(role)} aria-label={`Masuk sebagai ${role === 'petugas' ? 'petugas' : 'wali santri'}`}>
            <span className="role-login-option-icon"><RoleIcon role={role} /></span>
            <span className="role-login-option-copy"><strong>{role === 'petugas' ? 'Petugas' : 'Wali Santri'}</strong><small>{role === 'petugas' ? 'Kelola data pesantren' : 'Pantau data anak'}</small></span>
            <span className="role-login-option-arrow" aria-hidden="true">→</span>
          </button>;
        })}
      </div>
      <div className={`role-login-continue ${selectedRole ? 'is-visible' : ''}`}>
        <button type="button" onClick={continueToLogin} disabled={!selectedRole}>Lanjutkan</button>
      </div>
    </section>
    <footer className="role-login-footer" aria-hidden="true">
      <div className="role-login-mosque-silhouette" />
      <img src="/simanteb-logo-transparent.png" alt="" />
    </footer>
  </main>;
}
