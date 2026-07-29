import { useEffect, useState } from 'react';
import { api } from '../api';

export function DataMasterPage() {
  const [petugas, setPetugas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetResult, setResetResult] = useState<{ id: number, newPassword: string, note: string } | null>(null);
  const [confirmResetId, setConfirmResetId] = useState<number | null>(null);

  useEffect(() => {
    fetchPetugas();
  }, []);

  const fetchPetugas = async () => {
    try {
      const res = await api.get('/api/master/petugas');
      setPetugas(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!confirmResetId) return;
    const id = confirmResetId;
    setConfirmResetId(null);

    try {
      const res = await api.post(`/api/petugas/${id}/reset-password`);
      setResetResult({
        id,
        newPassword: res.data.new_password,
        note: res.data.note
      });
    } catch (e: any) {
      console.error('Gagal reset: ', e.response?.data?.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setResetResult(null); // langsung tutup
  };

  if (loading) return <div style={{ padding: '24px' }}>Memuat data master...</div>;

  return (
    <div className="app-container" style={{ padding: '24px', position: 'relative' }}>
      
      {/* Modal Konfirmasi */}
      {confirmResetId !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#0F172A', fontSize: '18px' }}>Konfirmasi Reset Password</h3>
            <p style={{ margin: '0 0 24px 0', color: '#64748B', fontSize: '14px', lineHeight: '1.5' }}>
              Apakah Anda yakin ingin mereset password petugas ini? Password lama tidak akan bisa digunakan lagi.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setConfirmResetId(null)}
                style={{ padding: '10px 16px', backgroundColor: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Batal
              </button>
              <button 
                onClick={handleConfirmReset}
                style={{ padding: '10px 16px', backgroundColor: '#DC2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Ya, Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hasil Reset */}
      {resetResult && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#F0FDF4', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '450px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #BBF7D0' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#16A34A', fontSize: '20px' }}>Password Berhasil Direset!</h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '15px' }}>
              Password baru: <strong style={{ letterSpacing: '1px', fontSize: '24px', color: '#0F172A', backgroundColor: '#FFF', padding: '4px 12px', borderRadius: '6px', border: '1px dashed #CBD5E1', display: 'inline-block', marginTop: '8px' }}>{resetResult.newPassword}</strong>
            </p>
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#64748B' }}>{resetResult.note}</p>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setResetResult(null)}
                style={{ padding: '10px 16px', backgroundColor: 'transparent', color: '#64748B', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Tutup
              </button>
              <button 
                onClick={() => copyToClipboard(resetResult.newPassword)}
                style={{ padding: '10px 16px', backgroundColor: '#0F6E56', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Salin & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="ui-text-title" style={{ marginBottom: '24px' }}>Data Master (Admin)</h1>
      
      <h2 className="ui-text-name" style={{ marginBottom: '16px' }}>Master Petugas</h2>
      <div style={{ backgroundColor: 'var(--kertas-kartu)', border: '1px solid var(--garis)', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--garis)' }}>
              <th style={{ padding: '12px' }} className="ui-text-label">ID</th>
              <th style={{ padding: '12px' }} className="ui-text-label">Nama</th>
              <th style={{ padding: '12px' }} className="ui-text-label">Username</th>
              <th style={{ padding: '12px' }} className="ui-text-label">Jabatan</th>
              <th style={{ padding: '12px' }} className="ui-text-label">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {petugas.map((p, idx) => (
              <tr key={p.petugas_id} style={{ borderTop: '1px solid var(--garis)', backgroundColor: idx % 2 === 0 ? 'var(--kertas-kartu)' : 'var(--kertas)' }}>
                <td style={{ padding: '12px' }} className="ui-text-tabular">{p.petugas_id}</td>
                <td style={{ padding: '12px' }} className="ui-text-body">{p.nama}</td>
                <td style={{ padding: '12px' }} className="ui-text-body">{p.username}</td>
                <td style={{ padding: '12px' }} className="ui-text-body">{p.jabatan}</td>
                <td style={{ padding: '12px' }}>
                  <button 
                    onClick={() => setConfirmResetId(p.petugas_id)}
                    style={{ backgroundColor: 'var(--status-alpha)', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Reset Password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
