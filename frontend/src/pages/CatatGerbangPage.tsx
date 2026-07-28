import { useEffect, useState } from 'react';
import { api } from '../api';

export function CatatGerbangPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get('/api/perizinan?status=Disetujui,Sedang Berjalan');
      setList(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGerbang = async (id: number, type: 'keluar' | 'masuk') => {
    try {
      const now = new Date().toISOString(); // atau format backend
      await api.patch(`/api/perizinan/${id}/gerbang`, {
        ...(type === 'keluar' ? { waktu_keluar_aktual: now } : { waktu_masuk_aktual: now })
      });
      alert('Berhasil mencatat gerbang');
      fetchData();
    } catch (e) {
      alert('Gagal mencatat gerbang');
    }
  };

  if (loading) return <div style={{ padding: '24px' }}>Memuat data...</div>;

  return (
    <div className="app-container" style={{ padding: '24px' }}>
      <h1 className="ui-text-title" style={{ marginBottom: '24px' }}>Catat Gerbang (Keamanan)</h1>
      {list.length === 0 ? (
        <div className="ui-text-body">Tidak ada izin berjalan saat ini.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {list.map(item => (
            <div key={item.perizinan_id} style={{
              backgroundColor: 'var(--kertas-kartu)',
              border: '1px solid var(--garis)',
              padding: '16px',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div className="ui-text-name">{item.nama_santri} (NIS: {item.nis})</div>
                <div className="ui-text-body" style={{ marginTop: '4px' }}>
                  <strong>Status:</strong> {item.status}
                </div>
              </div>
              <div>
                {item.status === 'Disetujui' && (
                  <button 
                    onClick={() => handleGerbang(item.perizinan_id, 'keluar')}
                    style={{ backgroundColor: 'var(--status-izin)', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Catat Keluar
                  </button>
                )}
                {item.status === 'Sedang Berjalan' && (
                  <button 
                    onClick={() => handleGerbang(item.perizinan_id, 'masuk')}
                    style={{ backgroundColor: 'var(--status-hadir)', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Catat Masuk
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
