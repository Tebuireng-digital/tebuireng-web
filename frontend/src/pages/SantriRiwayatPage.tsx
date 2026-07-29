import React, { useState, useEffect } from 'react';
import { api } from '../api';

export function SantriRiwayatPage() {
  const [activeTab, setActiveTab] = useState<'kehadiran' | 'pelanggaran' | 'perizinan'>('kehadiran');
  const [kehadiran, setKehadiran] = useState<any[]>([]);
  const [pelanggaran, setPelanggaran] = useState<any[]>([]);
  const [perizinan, setPerizinan] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [kehRes, pelRes, izinRes] = await Promise.all([
          api.get('/api/santri/me/kehadiran'),
          api.get('/api/santri/me/pelanggaran'),
          api.get('/api/santri/me/perizinan'),
        ]);
        setKehadiran(kehRes.data);
        setPelanggaran(pelRes.data);
        setPerizinan(izinRes.data);
      } catch (e) {
        console.error("Gagal mengambil data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>Riwayat Ananda</h1>
      <p style={{ color: '#64748B', fontSize: '15px', marginBottom: '32px' }}>
        Pantau detail absensi, pelanggaran, dan izin santri secara lengkap.
      </p>

      {/* Tabs Menu */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #F1F5F9', paddingBottom: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('kehadiran')}
          style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '15px', color: activeTab === 'kehadiran' ? '#0F6E56' : '#64748B', borderBottom: activeTab === 'kehadiran' ? '2px solid #0F6E56' : '2px solid transparent', marginBottom: '-18px' }}
        >
          Kehadiran ({kehadiran.length})
        </button>
        <button
          onClick={() => setActiveTab('pelanggaran')}
          style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '15px', color: activeTab === 'pelanggaran' ? '#991B1B' : '#64748B', borderBottom: activeTab === 'pelanggaran' ? '2px solid #991B1B' : '2px solid transparent', marginBottom: '-18px' }}
        >
          Pelanggaran ({pelanggaran.length})
        </button>
        <button
          onClick={() => setActiveTab('perizinan')}
          style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '15px', color: activeTab === 'perizinan' ? '#B45309' : '#64748B', borderBottom: activeTab === 'perizinan' ? '2px solid #B45309' : '2px solid transparent', marginBottom: '-18px' }}
        >
          Perizinan ({perizinan.length})
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#64748B', textAlign: 'center', padding: '32px' }}>Memuat data...</p>
      ) : (
        <div className="stat-card" style={{ padding: '24px' }}>
          
          {/* TAB KEHADIRAN */}
          {activeTab === 'kehadiran' && (
            <div>
              {kehadiran.length === 0 ? <p style={{ color: '#64748B' }}>Belum ada data kehadiran/absensi tercatat.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {kehadiran.map(k => (
                    <div key={k.absensi_id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #F1F5F9' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>{k.nama_kegiatan}</div>
                        <div style={{ fontSize: '13px', color: '#64748B' }}>Tanggal: {k.tanggal}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: k.status === 'Hadir' ? '#16A34A' : k.status === 'Alpha' ? '#DC2626' : '#D97706' }}>
                        {k.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB PELANGGARAN */}
          {activeTab === 'pelanggaran' && (
            <div>
              {pelanggaran.length === 0 ? <p style={{ color: '#16A34A', fontWeight: 600 }}>Alhamdulillah, tidak ada catatan pelanggaran.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {pelanggaran.map(p => (
                    <div key={p.pelanggaran_id} style={{ padding: '16px', backgroundColor: '#FEF2F2', borderRadius: '12px', border: '1px solid #FECACA' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#991B1B' }}>[{p.poin_maks} Poin] {p.kategori}</span>
                        <span style={{ fontSize: '13px', color: '#7F1D1D' }}>{p.tanggal}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '14px', color: '#7F1D1D', marginBottom: '8px' }}>{p.uraian_pelanggaran}</p>
                      {p.keterangan && <div style={{ fontSize: '13px', color: '#B91C1C', fontStyle: 'italic' }}>Catatan: "{p.keterangan}"</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB PERIZINAN */}
          {activeTab === 'perizinan' && (
            <div>
              {perizinan.length === 0 ? <p style={{ color: '#64748B' }}>Belum ada data izin/keluar pondok.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {perizinan.map(i => (
                    <div key={i.perizinan_id} style={{ padding: '16px', backgroundColor: '#FFFBEB', borderRadius: '12px', border: '1px solid #FDE68A' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#92400E' }}>{i.jenis_izin_nama}</span>
                        <span style={{ fontSize: '13px', color: '#B45309', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', backgroundColor: i.status === 'Berlaku' ? '#D97706' : '#64748B', color: 'white' }}>{i.status}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '14px', color: '#92400E', marginBottom: '8px' }}>Alasan: {i.alasan}</p>
                      <div style={{ fontSize: '13px', color: '#B45309' }}>
                        Berangkat: {i.tanggal_mulai} {i.waktu_mulai}<br/>
                        Kembali: {i.tanggal_selesai || '-'} {i.waktu_selesai || '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
