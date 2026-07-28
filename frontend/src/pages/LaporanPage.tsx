import { useState } from 'react';

export function LaporanPage() {
  const [laporanType, setLaporanType] = useState('kehadiran');
  
  const handleUnduh = (format: 'pdf' | 'xlsx') => {
    // Arahkan browser ke endpoint download
    window.location.href = `http://localhost:8000/api/laporan/${laporanType}?format=${format}`;
  };

  return (
    <div className="app-container" style={{ padding: '24px' }}>
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
          </select>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <button 
            onClick={() => handleUnduh('pdf')}
            style={{ backgroundColor: 'var(--aksen)', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: 1 }}
            className="ui-text-title"
          >
            Unduh PDF
          </button>
          <button 
            onClick={() => handleUnduh('xlsx')}
            style={{ backgroundColor: 'var(--status-hadir)', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: 1 }}
            className="ui-text-title"
          >
            Unduh Excel
          </button>
        </div>
      </div>
    </div>
  );
}
