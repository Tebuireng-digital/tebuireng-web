import { useState } from 'react';
import { api } from '../api';

export function PelanggaranFormPage() {
  const [santriId, setSantriId] = useState('');
  const [kategoriId, setKategoriId] = useState('');
  const [catatan, setCatatan] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [poinAccumulated, setPoinAccumulated] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!santriId || !kategoriId) return;

    setIsSubmitting(true);
    try {
      // 1. Submit Pelanggaran
      const res = await api.post('/api/pelanggaran', {
        santri_id: parseInt(santriId),
        kategori_pelanggaran_id: parseInt(kategoriId),
        catatan,
      });

      const id = res.data.pelanggaran_id;

      // 2. Upload Lampiran if exists
      if (foto && id) {
        const formData = new FormData();
        formData.append('file', foto);
        await api.post(`/api/pelanggaran/${id}/lampiran`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      }

      // 3. Fetch Accumulation
      const resPoin = await api.get(`/api/santri/${santriId}/poin`);
      setPoinAccumulated(resPoin.data.total_poin);
      
      alert('Berhasil menyimpan pelanggaran!');
      // Reset form (optional)
      // setSantriId('');
      // setKategoriId('');
      // setCatatan('');
      // setFoto(null);
    } catch (err: any) {
      alert('Gagal menyimpan pelanggaran: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-container" style={{ padding: '24px' }}>
      <h1 className="ui-text-title" style={{ marginBottom: '24px' }}>Input Pelanggaran Baru</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Static Labels (Not placeholders) */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="ui-text-label" style={{ marginBottom: '8px' }}>Pilih Santri (Santri ID)</label>
          <input 
            type="number"
            className="ui-text-body"
            style={{ padding: '12px', border: '1px solid var(--garis)', borderRadius: '4px', backgroundColor: 'var(--kertas-kartu)' }}
            value={santriId}
            onChange={(e) => setSantriId(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="ui-text-label" style={{ marginBottom: '8px' }}>Kategori Pelanggaran (ID)</label>
          <input 
            type="number"
            className="ui-text-body"
            style={{ padding: '12px', border: '1px solid var(--garis)', borderRadius: '4px', backgroundColor: 'var(--kertas-kartu)' }}
            value={kategoriId}
            onChange={(e) => setKategoriId(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="ui-text-label" style={{ marginBottom: '8px' }}>Bukti Foto (Kamera)</label>
          <input 
            type="file"
            accept="image/*"
            capture="environment" /* Forces camera on mobile */
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setFoto(e.target.files[0]);
              }
            }}
            style={{ padding: '12px 0' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="ui-text-label" style={{ marginBottom: '8px' }}>Catatan</label>
          <textarea
            className="ui-text-body"
            style={{ padding: '12px', border: '1px solid var(--garis)', borderRadius: '4px', backgroundColor: 'var(--kertas-kartu)', minHeight: '100px' }}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="ui-text-title"
          style={{ 
            padding: '16px', 
            backgroundColor: 'var(--status-alpha)', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            marginTop: '16px',
            cursor: 'pointer'
          }}
        >
          {isSubmitting ? 'Menyimpan...' : 'Simpan Pelanggaran'}
        </button>

      </form>

      {poinAccumulated !== null && (
        <div style={{ marginTop: '32px', padding: '16px', backgroundColor: 'rgba(162, 59, 46, 0.1)', border: '1px solid var(--status-alpha)', borderRadius: '8px' }}>
          <p className="ui-text-body" style={{ color: 'var(--tinta)' }}>Akumulasi Poin Pelanggaran Santri:</p>
          <p className="ui-text-tabular" style={{ fontSize: '32px', color: 'var(--status-alpha)', fontWeight: 'bold' }}>
            {poinAccumulated} Poin
          </p>
        </div>
      )}
    </div>
  );
}
