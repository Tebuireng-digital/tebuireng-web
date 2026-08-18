import { useState } from 'react';
import { api } from '../api';
import { AppDropdown } from '../components/AppDropdown';
import { usePageMeta } from '../hooks/usePageMeta';

const BULAN_NAMA = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function LaporanPage() {
  usePageMeta({
    title: 'Laporan Detail & Ekspor',
    description: 'Unduh laporan rekapitulasi kehadiran, pelanggaran, dan perizinan santri Pondok Pesantren Tebuireng dalam format PDF & Excel.',
  });

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [laporanType, setLaporanType] = useState('kehadiran');
  const [dari, setDari] = useState(formatDate(firstDay));
  const [sampai, setSampai] = useState(formatDate(now));
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());

  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  
  const handleUnduh = async (format: 'pdf' | 'xlsx') => {
    setDownloading(true);
    setError('');

    const params: Record<string, any> = { format };
    if (laporanType === 'bulanan') {
      params.bulan = bulan;
      params.tahun = tahun;
    } else {
      params.dari = dari;
      params.sampai = sampai;
    }

    try {
      const response = await api.get(`/api/laporan/${laporanType}`, {
        params,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `laporan-${laporanType}_${formatDate(now)}.${format}`;
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
        
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
          <AppDropdown
            id="laporan-type"
            label="Jenis Laporan"
            value={laporanType}
            onChange={setLaporanType}
            options={[
              { value: 'kehadiran', label: 'Rekap Kehadiran Harian' },
              { value: 'pelanggaran', label: 'Rekap Pelanggaran' },
              { value: 'perizinan', label: 'Rekap Perizinan' },
              { value: 'bulanan', label: 'Rekap Gabungan Bulanan' },
            ]}
          />
        </div>

        {/* Dynamic Parameter Selector based on Report Type */}
        {laporanType === 'bulanan' ? (
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div style={{ flex: 1 }}>
              <label className="ui-text-label" htmlFor="laporan-bulan" style={{ display: 'block', marginBottom: '6px' }}>Bulan</label>
              <select
                id="laporan-bulan"
                className="raport-select"
                value={bulan}
                onChange={e => setBulan(Number(e.target.value))}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--garis)', backgroundColor: '#fff' }}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{BULAN_NAMA[i + 1]}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="ui-text-label" htmlFor="laporan-tahun" style={{ display: 'block', marginBottom: '6px' }}>Tahun</label>
              <select
                id="laporan-tahun"
                className="raport-select"
                value={tahun}
                onChange={e => setTahun(Number(e.target.value))}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--garis)', backgroundColor: '#fff' }}
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const y = now.getFullYear() - 2 + i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label className="ui-text-label" htmlFor="laporan-dari" style={{ display: 'block', marginBottom: '6px' }}>Tanggal Mulai</label>
              <input
                id="laporan-dari"
                type="date"
                className="raport-select"
                value={dari}
                onChange={e => setDari(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--garis)', backgroundColor: '#fff' }}
              />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label className="ui-text-label" htmlFor="laporan-sampai" style={{ display: 'block', marginBottom: '6px' }}>Tanggal Selesai</label>
              <input
                id="laporan-sampai"
                type="date"
                className="raport-select"
                value={sampai}
                onChange={e => setSampai(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--garis)', backgroundColor: '#fff' }}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '16px' }}>
          <button 
            onClick={() => handleUnduh('pdf')}
            disabled={downloading}
            style={{ backgroundColor: 'var(--aksen)', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: 1 }}
            className="ui-text-title"
          >
            {downloading ? 'Mengunduh...' : 'Unduh PDF'}
          </button>
          <button 
            onClick={() => handleUnduh('xlsx')}
            disabled={downloading}
            style={{ backgroundColor: 'var(--status-hadir)', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: 1 }}
            className="ui-text-title"
          >
            {downloading ? 'Mengunduh...' : 'Unduh Excel'}
          </button>
        </div>
        {error && <p className="form-error" style={{ marginTop: '16px' }}>{error}</p>}
      </div>
    </section>
  );
}

export default LaporanPage;
