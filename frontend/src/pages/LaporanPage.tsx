import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { AppDropdown } from '../components/AppDropdown';
import { usePageMeta } from '../hooks/usePageMeta';

const BULAN_NAMA = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function LaporanPage() {
  const { user } = useAuth();

  usePageMeta({
    title: 'Laporan Detail & Ekspor Terpadu (Khusus Admin)',
    description: 'Unduh laporan rekapitulasi gabungan, izin, pelanggaran, kehadiran, dan prestasi santri Pondok Pesantren Tebuireng.',
  });

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [laporanType, setLaporanType] = useState('bulanan');
  const [dari, setDari] = useState(formatDate(firstDay));
  const [sampai, setSampai] = useState(formatDate(now));
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());

  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = user && user.jabatan === 'Admin';
  
  const handleUnduh = async (format: 'pdf' | 'xlsx') => {
    setDownloading(true);
    setError('');

    let endpoint = '/api/laporan/bulanan';
    const params: Record<string, any> = { format };

    if (laporanType === 'bulanan') {
      endpoint = '/api/laporan/bulanan';
      params.bulan = bulan;
      params.tahun = tahun;
      if (dari) params.dari = dari;
      if (sampai) params.sampai = sampai;
    } else if (laporanType === 'perizinan') {
      endpoint = '/api/laporan/perizinan';
      params.dari = dari;
      params.sampai = sampai;
    } else if (laporanType === 'pelanggaran') {
      endpoint = '/api/laporan/pelanggaran';
      params.dari = dari;
      params.sampai = sampai;
    } else if (laporanType === 'kehadiran') {
      endpoint = '/api/laporan/kehadiran';
      params.dari = dari;
      params.sampai = sampai;
    } else if (laporanType === 'prestasi') {
      endpoint = '/api/laporan/prestasi';
      params.dari = dari;
      params.sampai = sampai;
    }

    try {
      const response = await api.get(endpoint, {
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
      setError('Laporan gagal diunduh. Silakan periksa kembali server.');
    } finally {
      setDownloading(false);
    }
  };

  if (!isAdmin) {
    return (
      <section className="app-container" style={{ padding: '24px' }}>
        <h1 className="ui-text-title" style={{ marginBottom: '16px' }}>Laporan Detail & Ekspor</h1>
        <div className="error-box" style={{ padding: '20px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: '8px' }}>
          <strong>Akses Terbatas:</strong> Fitur ekspor laporan terpadu hanya dapat diakses oleh akun **Admin**.
        </div>
      </section>
    );
  }

  return (
    <section className="app-container" style={{ padding: '24px' }}>
      <header style={{ marginBottom: '24px' }}>
        <span className="page-eyebrow" style={{ color: 'var(--aksen)', fontWeight: 600 }}>Pusat Ekspor Admin</span>
        <h1 className="ui-text-title" style={{ fontSize: '24px', margin: '4px 0 8px' }}>Laporan Detail & Ekspor Terpadu</h1>
        <p style={{ color: 'var(--tinta-muda)' }}>
          Pusat ekspor data resmi Pondok Pesantren Tebuireng: Gabungan (Rangkuman), Izin, Pelanggaran, Kehadiran, & Prestasi Santri.
        </p>
      </header>
      
      <div style={{ backgroundColor: 'var(--kertas-kartu)', border: '1px solid var(--garis)', borderRadius: '8px', padding: '24px' }}>
        
        {/* Dropdown 5 Opsi Laporan */}
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
          <AppDropdown
            id="laporan-type"
            label="Pilih Jenis Laporan yang Ingin Diekspor"
            value={laporanType}
            onChange={setLaporanType}
            options={[
              { value: 'bulanan', label: '1. Gabungan (Rangkuman Laporan)' },
              { value: 'perizinan', label: '2. Rekap Izin' },
              { value: 'pelanggaran', label: '3. Rekap Pelanggaran' },
              { value: 'kehadiran', label: '4. Rekap Kehadiran' },
              { value: 'prestasi', label: '5. Rekap Prestasi' },
            ]}
          />
        </div>

        {/* Filter Rentang Waktu (Date Range) */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="ui-text-label" htmlFor="laporan-dari" style={{ display: 'block', marginBottom: '6px' }}>Rentang Tanggal Mulai</label>
            <input
              id="laporan-dari"
              type="date"
              className="raport-select"
              value={dari}
              onChange={e => setDari(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--garis)', backgroundColor: '#fff' }}
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label className="ui-text-label" htmlFor="laporan-sampai" style={{ display: 'block', marginBottom: '6px' }}>Rentang Tanggal Selesai</label>
            <input
              id="laporan-sampai"
              type="date"
              className="raport-select"
              value={sampai}
              onChange={e => setSampai(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--garis)', backgroundColor: '#fff' }}
            />
          </div>

          {laporanType === 'bulanan' && (
            <div style={{ flex: '1 1 200px', display: 'flex', gap: '8px' }}>
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
          )}
        </div>

        {/* Tombol Ekspor */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <button 
            onClick={() => handleUnduh('pdf')}
            disabled={downloading}
            style={{ backgroundColor: 'var(--aksen)', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '6px', cursor: 'pointer', flex: 1, fontWeight: 600 }}
            className="ui-text-title"
          >
            {downloading ? 'Mengunduh...' : 'Unduh Laporan PDF'}
          </button>
          <button 
            onClick={() => handleUnduh('xlsx')}
            disabled={downloading}
            style={{ backgroundColor: '#10B981', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '6px', cursor: 'pointer', flex: 1, fontWeight: 600 }}
            className="ui-text-title"
          >
            {downloading ? 'Mengunduh...' : 'Unduh Laporan Excel (.xlsx)'}
          </button>
        </div>
        {error && <p className="form-error" style={{ marginTop: '16px', color: '#DC2626' }}>{error}</p>}
      </div>
    </section>
  );
}

export default LaporanPage;
