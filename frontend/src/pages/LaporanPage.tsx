import { useState } from 'react';
import { api } from '../api';
import { usePageMeta } from '../hooks/usePageMeta';

export function LaporanPage() {
  usePageMeta({
    title: 'Laporan Detail & Ekspor',
    description: 'Unduh laporan rekapitulasi kehadiran, pelanggaran, dan perizinan santri Pondok Pesantren Tebuireng dalam format PDF & Excel.',
  });

  const [laporanType, setLaporanType] = useState('kehadiran');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  
  const handleUnduh = async (format: 'pdf' | 'xlsx') => {
    setDownloading(true);
    setError('');
    try {
      const response = await api.get(`/api/laporan/${laporanType}`, {
        params: { format },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `laporan-${laporanType}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Laporan gagal diunduh. Silakan coba kembali.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="app-container" style={{ padding: '24px' }}>
      <h1 className="ui-text-title" style={{ marginBottom: '24px' }}>Laporan Detail & Ekspor</h1>
      
      <div style={{ backgroundColor: 'var(--kertas-kartu)', border: '1px solid var(--garis)', borderRadius: '8px', padding: '24px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '24px' }}>
          <label className="ui-text-label" style={{ marginBottom: '8px' }}>Jenis Laporan</label>
          <select 
            className="ui-text-body"
            style={{ padding: '12px', border: '1px solid var(--garis)', borderRadius: '4px', backgroundColor: 'var(--kertas)' }}
            value={laporanType}
            onChange={(e) => setLaporanType(e.target.value)}
          >
            <option value="kehadiran">Rekap Kehadiran Harian</option>
            <option value="pelanggaran">Rekap Pelanggaran</option>
            <option value="perizinan">Rekap Perizinan</option>
            <option value="bulanan">Rekap Gabungan Bulanan</option>
            <option value="organisasi-daerah">Rekap Santri per Organisasi Daerah</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <button 
            onClick={() => handleUnduh('pdf')}
            disabled={downloading}
            style={{ backgroundColor: 'var(--aksen)', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: 1 }}
            className="ui-text-title"
          >
            Unduh PDF
          </button>
          <button 
            onClick={() => handleUnduh('xlsx')}
            disabled={downloading}
            style={{ backgroundColor: 'var(--status-hadir)', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: 1 }}
            className="ui-text-title"
          >
            Unduh Excel
          </button>
        </div>
        {error && <p className="form-error" style={{ marginTop: '16px' }}>{error}</p>}
      </div>
    </section>
  );
}
