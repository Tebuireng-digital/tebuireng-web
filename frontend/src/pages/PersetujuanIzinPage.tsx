import { useEffect, useState } from 'react';
import { api } from '../api';

export function PersetujuanIzinPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulasi peran. Di aslinya diambil dari context login.
  const jabatan = 'Pembina Kamar'; 

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get(`/api/perizinan?menunggu_tahap_jabatan=${jabatan}`);
      setList(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number, tahap: number, isSetuju: boolean) => {
    try {
      await api.patch(`/api/perizinan/${id}/approval/${tahap}`, {
        keputusan: isSetuju ? 'Disetujui' : 'Ditolak',
        catatan: isSetuju ? '' : 'Ditolak oleh ' + jabatan
      });
      alert('Berhasil ' + (isSetuju ? 'disetujui' : 'ditolak'));
      fetchData(); // refresh list
    } catch (e) {
      alert('Gagal memproses persetujuan');
    }
  };

  if (loading) return <div style={{ padding: '24px' }}>Memuat data...</div>;

  return (
    <div className="app-container" style={{ padding: '24px' }}>
      <h1 className="ui-text-title" style={{ marginBottom: '24px' }}>Persetujuan Izin (Login: {jabatan})</h1>
      {list.length === 0 ? (
        <div className="ui-text-body">Tidak ada izin yang menunggu persetujuan Anda saat ini.</div>
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
                  <strong>Keperluan:</strong> {item.keperluan}
                </div>
                <div className="ui-text-tabular" style={{ marginTop: '4px', fontSize: '12px' }}>
                  {item.tanggal_mulai} s/d {item.rencana_kembali}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => handleApprove(item.perizinan_id, item.tahap_menunggu, false)}
                  style={{
                    backgroundColor: 'var(--status-alpha)', 
                    color: 'white', 
                    border: 'none', 
                    padding: '8px 16px', 
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Tolak
                </button>
                <button 
                  onClick={() => handleApprove(item.perizinan_id, item.tahap_menunggu, true)}
                  style={{
                    backgroundColor: 'var(--status-hadir)', 
                    color: 'white', 
                    border: 'none', 
                    padding: '8px 16px', 
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Setujui
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
