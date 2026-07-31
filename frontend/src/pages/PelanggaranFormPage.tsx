import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export function PelanggaranFormPage() {
  const { user } = useAuth();
  
  // Santri Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedSantri, setSelectedSantri] = useState<any | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Kategori State
  const [kategoriList, setKategoriList] = useState<any[]>([]);
  const [kategoriId, setKategoriId] = useState('');

  // Form State
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [catatan, setCatatan] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [poinAccumulated, setPoinAccumulated] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalState, setModalState] = useState<{ isOpen: boolean, type: 'success' | 'error', message: string }>({ isOpen: false, type: 'success', message: '' });

  useEffect(() => {
    // Fetch Kategori Pelanggaran
    api.get('/api/pelanggaran/kategori').then(res => {
      let filtered = res.data;
      if (user && (user as any).jabatan === 'Pembina Kamar') {
        filtered = res.data.filter((k: any) => k.kategori?.toLowerCase().trim() === 'ringan');
      } else if (user && (user as any).jabatan === 'Keamanan') {
        filtered = res.data.filter((k: any) => ['sedang', 'berat'].includes(k.kategori?.toLowerCase().trim()));
      }
      setKategoriList(filtered);
    }).catch(console.error);

    // Click outside handler for dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search Santri Effect (Debounced)
  useEffect(() => {
    if (searchTerm.length >= 2 && (!selectedSantri || searchTerm !== selectedSantri.nama)) {
      const delayDebounceFn = setTimeout(() => {
        api.get(`/api/santri?q=${encodeURIComponent(searchTerm)}`).then(res => {
          setSearchResults(res.data);
          setShowDropdown(true);
        }).catch(console.error);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setShowDropdown(false);
    }
  }, [searchTerm, selectedSantri]);

  const handleSelectSantri = (santri: any) => {
    setSelectedSantri(santri);
    setSearchTerm(santri.nama); // Set input to the selected name
    setShowDropdown(false);
    setPoinAccumulated(null); // Reset points display when selecting a new santri
  };

  const handleClearSantri = () => {
    setSelectedSantri(null);
    setSearchTerm('');
    setSearchResults([]);
    setPoinAccumulated(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSantri || !kategoriId || !tanggal) return;

    setIsSubmitting(true);
    try {
      // 1. Submit Pelanggaran
      const res = await api.post('/api/pelanggaran', {
        santri_id: selectedSantri.santri_id,
        kategori_pelanggaran_id: parseInt(kategoriId),
        tanggal: tanggal,
        keterangan: catatan,
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
      const resPoin = await api.get(`/api/santri/${selectedSantri.santri_id}/poin`);
      setPoinAccumulated(resPoin.data.total_poin);
      
      setModalState({ isOpen: true, type: 'success', message: 'Berhasil menyimpan pelanggaran!' });
      
      // Reset form optional
      setKategoriId('');
      setCatatan('');
      setFoto(null);
    } catch (err: any) {
      setModalState({ isOpen: true, type: 'error', message: err.response?.data?.message || err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="violation-page">
      
      {/* Modal Pesan Sukses / Error */}
      {modalState.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: modalState.type === 'success' ? '1px solid #BBF7D0' : '1px solid #FECACA' }}>
            <h3 style={{ margin: '0 0 16px 0', color: modalState.type === 'success' ? '#16A34A' : '#DC2626', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {modalState.type === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              )}
              {modalState.type === 'success' ? 'Berhasil' : 'Peringatan'}
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: '#334155', lineHeight: '1.5' }}>
              {modalState.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setModalState({ ...modalState, isOpen: false })}
                style={{ padding: '10px 24px', backgroundColor: modalState.type === 'success' ? '#0F6E56' : '#DC2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-heading">
        <span className="page-eyebrow">Kedisiplinan santri</span>
        <h1>Input Pelanggaran</h1>
        <p>Catat pelanggaran tata tertib secara rinci dan sertakan bukti pendukung.</p>
      </div>

      <div className="stat-card violation-card">
        <div className="form-section-heading"><span>1</span><div><h2>Data pelanggaran</h2><p>Lengkapi informasi kejadian di bawah ini.</p></div></div>
        <form onSubmit={handleSubmit} className="violation-form">
          
          {/* Autocomplete Pencarian Santri */}
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }} ref={dropdownRef}>
            <label style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>Cari Santri (Nama / NIS)</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text"
                placeholder="Ketik nama atau NIS santri..."
                style={{ width: '100%', padding: '14px 16px', paddingRight: selectedSantri ? '40px' : '16px', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '15px', outline: 'none', transition: 'all 0.2s', backgroundColor: selectedSantri ? '#F8FAFC' : 'white' }}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (selectedSantri) setSelectedSantri(null);
                }}
                onFocus={(e) => e.target.style.borderColor = '#0F6E56'}
                onBlur={(e) => { if(!selectedSantri) e.target.style.borderColor = '#E2E8F0' }}
                required
              />
              {selectedSantri && (
                <button type="button" onClick={handleClearSantri} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
            </div>

            {/* Dropdown Hasil Pencarian */}
            {showDropdown && searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '250px', overflowY: 'auto' }}>
                {searchResults.map((s, idx) => (
                  <div key={idx} onClick={() => handleSelectSantri(s)} style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '15px' }}>{s.nama}</span>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>NIS: {s.nis} &bull; {s.nama_kamar || 'Kamar -'} &bull; {s.nama_unit || 'Unit -'}</span>
                  </div>
                ))}
              </div>
            )}
            
            {showDropdown && searchResults.length === 0 && searchTerm.length >= 2 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', textAlign: 'center', color: '#64748B', zIndex: 50 }}>
                Tidak ada santri yang cocok.
              </div>
            )}
          </div>

          {/* Info Detail Santri (Muncul setelah dipilih) */}
          {selectedSantri && (
            <div className="selected-student" style={{ padding: '16px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '14px' }}>
                <span style={{ color: '#166534', fontWeight: 600 }}>Unit</span>
                <span style={{ color: '#14532D' }}>: {selectedSantri.nama_unit || '-'}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '14px' }}>
                <span style={{ color: '#166534', fontWeight: 600 }}>Kamar</span>
                <span style={{ color: '#14532D' }}>: {selectedSantri.nama_kamar || '-'}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '14px' }}>
                <span style={{ color: '#166534', fontWeight: 600 }}>Wali Santri</span>
                <span style={{ color: '#14532D' }}>: {selectedSantri.nama_wali || '-'}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '14px' }}>
                <span style={{ color: '#166534', fontWeight: 600 }}>No. HP Wali</span>
                <span style={{ color: '#14532D' }}>: {selectedSantri.no_hp_wali || '-'}</span>
              </div>
            </div>
          )}

          {/* Tanggal Pelanggaran */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>Tanggal Kejadian</label>
            <input 
              type="date"
              style={{ width: '100%', padding: '14px 16px', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '15px', outline: 'none', backgroundColor: 'white' }}
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              required
            />
          </div>

          {/* Dropdown Kategori Pelanggaran */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>Kategori Pelanggaran</label>
            <select 
              style={{ width: '100%', padding: '14px 16px', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '15px', outline: 'none', backgroundColor: 'white', cursor: 'pointer' }}
              value={kategoriId}
              onChange={(e) => setKategoriId(e.target.value)}
              required
            >
              <option value="" disabled>Pilih Kategori Pelanggaran...</option>
              {kategoriList.map((kat, idx) => (
                <option key={idx} value={kat.kategori_pelanggaran_id}>
                  [{kat.poin_maks} Poin] {kat.kategori} - {kat.uraian_pelanggaran}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>Bukti Foto (Kamera / File)</label>
            <div className="file-dropzone" style={{ border: '1px dashed #CBD5E1', borderRadius: '12px', padding: '16px', backgroundColor: '#F8FAFC' }}>
              <input 
                type="file"
                accept="image/*"
                capture="environment" /* Forces camera on mobile */
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setFoto(e.target.files[0]);
                  }
                }}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>Catatan Tambahan (Opsional)</label>
            <textarea
              placeholder="Tuliskan keterangan tambahan mengenai pelanggaran..."
              style={{ padding: '16px', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '15px', outline: 'none', minHeight: '120px', resize: 'vertical' }}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              onFocus={(e) => e.target.style.borderColor = '#0F6E56'}
              onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting || !selectedSantri}
            className="violation-submit"
            style={{ 
              width: '100%', 
              padding: '16px', 
              background: (!isSubmitting && selectedSantri) ? 'linear-gradient(90deg, #A23B2E, #7A281E)' : '#CBD5E1', 
              color: 'white', 
              border: 'none', 
              borderRadius: '12px', 
              cursor: (!isSubmitting && selectedSantri) ? 'pointer' : 'not-allowed', 
              marginTop: '8px',
              fontWeight: 700,
              fontSize: '16px',
              boxShadow: (!isSubmitting && selectedSantri) ? '0 4px 12px rgba(162, 59, 46, 0.2)' : 'none',
              transition: 'all 0.3s ease'
            }}
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Pelanggaran'}
          </button>

        </form>

        {poinAccumulated !== null && (
          <div style={{ marginTop: '32px', padding: '24px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', textAlign: 'center' }}>
            <p style={{ color: '#991B1B', fontWeight: 600, fontSize: '15px', marginBottom: '8px' }}>Total Akumulasi Poin Pelanggaran Saat Ini:</p>
            <p style={{ fontSize: '48px', color: '#7F1D1D', fontWeight: 800, margin: 0, lineHeight: 1 }}>
              {poinAccumulated} <span style={{ fontSize: '20px', fontWeight: 600 }}>Poin</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
