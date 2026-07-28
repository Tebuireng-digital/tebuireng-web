import { useEffect, useState } from 'react';
import { api } from '../api';

export function DataMasterPage() {
  const [petugas, setPetugas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const resetPassword = async (id: number) => {
    if (!window.confirm('Yakin reset password petugas ini?')) return;
    try {
      const res = await api.post(`/api/petugas/${id}/reset-password`);
      alert(`Password baru: ${res.data.new_password}\n\n${res.data.note}`);
    } catch (e: any) {
      alert('Gagal reset: ' + e.response?.data?.message);
    }
  };

  if (loading) return <div style={{ padding: '24px' }}>Memuat data master...</div>;

  return (
    <div className="app-container" style={{ padding: '24px' }}>
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
                    onClick={() => resetPassword(p.petugas_id)}
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
