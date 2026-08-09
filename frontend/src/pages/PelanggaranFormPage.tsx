import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { usePageMeta } from '../hooks/usePageMeta';

export function PelanggaranFormPage() {
  usePageMeta({
    title: 'Input Pelanggaran Baru',
    description: 'Formulir pencatatan pelanggaran santri baru oleh petugas Pondok Pesantren Tebuireng.',
  });

  const { user } = useAuth();
  
  // Santri Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedSantri, setSelectedSantri] = useState<any | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const categorySearchRef = useRef<HTMLInputElement>(null);

  // Kategori State
  const [kategoriList, setKategoriList] = useState<any[]>([]);
  const [kategoriId, setKategoriId] = useState('');
  const [poin, setPoin] = useState('');
  const [isKategoriOpen, setIsKategoriOpen] = useState(false);
  const [kategoriSearch, setKategoriSearch] = useState('');
  const [activeKategoriIndex, setActiveKategoriIndex] = useState(0);

  // Form State
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [catatan, setCatatan] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [poinAccumulated, setPoinAccumulated] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalState, setModalState] = useState<{ isOpen: boolean, type: 'success' | 'error', message: string }>({ isOpen: false, type: 'success', message: '' });
  const modalRef = useRef<HTMLDivElement>(null);
  const modalCloseRef = useRef<HTMLButtonElement>(null);

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFoto(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveFoto = () => {
    setFoto(null);
    if (fotoPreview) {
      URL.revokeObjectURL(fotoPreview);
      setFotoPreview(null);
    }
  };

  const getSeverityClass = (kategori: string) => {
    const k = (kategori || '').toLowerCase().trim();
    if (k === 'kewajiban') return 'severity-badge severity-kewajiban';
    if (k === 'berat') return 'severity-badge severity-berat';
    if (k === 'sedang') return 'severity-badge severity-sedang';
    return 'severity-badge severity-ringan';
  };

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
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsKategoriOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!modalState.isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = modalRef.current;
    const closeButton = modalCloseRef.current;
    closeButton?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalState(current => ({ ...current, isOpen: false }));
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      previouslyFocused?.focus();
    };
  }, [modalState.isOpen]);

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

  const selectedKategori = kategoriList.find(kat => String(kat.kategori_pelanggaran_id) === kategoriId);
  const poinMaks = selectedKategori ? Number(selectedKategori.poin_maks) : null;

  const handleKategoriChange = (value: string) => {
    setKategoriId(value);
    const kategori = kategoriList.find(kat => String(kat.kategori_pelanggaran_id) === value);
    setPoin(kategori ? String(kategori.poin_maks) : '');
  };

  const filteredKategoriList = kategoriList.filter(kat => {
    const search = kategoriSearch.trim().toLowerCase();
    if (!search) return true;
    return `${kat.kategori} ${kat.uraian_pelanggaran}`.toLowerCase().includes(search);
  });

  const selectKategori = (kat: any) => {
    handleKategoriChange(String(kat.kategori_pelanggaran_id));
    setKategoriSearch('');
    setIsKategoriOpen(false);
    setActiveKategoriIndex(0);
  };

  const handleKategoriKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsKategoriOpen(true);
      setActiveKategoriIndex(index => Math.min(index + 1, Math.max(filteredKategoriList.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsKategoriOpen(true);
      setActiveKategoriIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isKategoriOpen) {
        setIsKategoriOpen(true);
        setTimeout(() => categorySearchRef.current?.focus(), 0);
      } else if (filteredKategoriList[activeKategoriIndex]) {
        selectKategori(filteredKategoriList[activeKategoriIndex]);
      }
    } else if (event.key === 'Escape') {
      setIsKategoriOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSantri) {
      setModalState({ isOpen: true, type: 'error', message: 'Pilih santri terlebih dahulu sebelum menyimpan pelanggaran.' });
      return;
    }
    if (!kategoriId) {
      setModalState({ isOpen: true, type: 'error', message: 'Pilih kategori pelanggaran terlebih dahulu.' });
      return;
    }
    if (!tanggal) {
      setModalState({ isOpen: true, type: 'error', message: 'Isi tanggal kejadian terlebih dahulu.' });
      return;
    }
    if (!poin || Number(poin) < 1 || (poinMaks !== null && Number(poin) > poinMaks)) {
      setModalState({ isOpen: true, type: 'error', message: `Jumlah poin harus antara 1 dan ${poinMaks ?? 0} poin.` });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Submit Pelanggaran
      const res = await api.post('/api/pelanggaran', {
        santri_id: selectedSantri.santri_id,
        kategori_pelanggaran_id: parseInt(kategoriId),
        poin: parseInt(poin),
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
      setPoin('');
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
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="violation-modal-title" aria-describedby="violation-modal-message" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: modalState.type === 'success' ? '1px solid #BBF7D0' : '1px solid #FECACA' }}>
            <h2 id="violation-modal-title" style={{ margin: '0 0 16px 0', color: modalState.type === 'success' ? '#16A34A' : '#DC2626', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {modalState.type === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              )}
              {modalState.type === 'success' ? 'Berhasil' : 'Peringatan'}
            </h2>
            <p id="violation-modal-message" style={{ margin: '0 0 24px 0', fontSize: '15px', color: '#334155', lineHeight: '1.5' }}>
              {modalState.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                ref={modalCloseRef}
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
        <span className="page-eyebrow">Kedisiplinan Santri</span>
        <h1>Input Pelanggaran</h1>
        <p>Catat data pelanggaran tata tertib secara rinci dan lampirkan bukti pendukung.</p>
      </div>

      <div className="stat-card violation-card">
        <div className="form-section-heading">
          <div>
            <h2>Data Pelanggaran & Bukti</h2>
            <p>Lengkapi identitas santri, kategori pelanggaran, dan lampirkan bukti foto.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="violation-form">
          
          {/* Autocomplete Pencarian Santri */}
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }} ref={dropdownRef}>
            <label htmlFor="student-search">Cari Santri (Nama / NIS)</label>
            <div style={{ position: 'relative' }}>
              <input 
                id="student-search"
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="student-search-results"
                aria-expanded={showDropdown && searchResults.length > 0}
                placeholder="Ketik nama atau NIS santri..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (selectedSantri) setSelectedSantri(null);
                }}
                required
              />
              {selectedSantri && (
                <button type="button" onClick={handleClearSantri} className="btn-clear-input" aria-label="Hapus santri terpilih">
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown Hasil Pencarian */}
            {showDropdown && searchResults.length > 0 && (
              <div id="student-search-results" role="listbox" className="student-search-dropdown">
                {searchResults.map((s, idx) => (
                  <button className="student-search-result" type="button" role="option" aria-selected={selectedSantri?.santri_id === s.santri_id} key={s.santri_id ?? idx} onClick={() => handleSelectSantri(s)}>
                    <span className="search-result-name">{s.nama}</span>
                    <span className="search-result-meta">NIS: {s.nis} &bull; {s.nama_kamar || 'Kamar -'} &bull; {s.nama_unit || 'Unit -'}</span>
                  </button>
                ))}
              </div>
            )}
            
            {showDropdown && searchResults.length === 0 && searchTerm.length >= 2 && (
              <div className="student-search-empty">
                Tidak ada santri yang cocok.
              </div>
            )}
          </div>

          {/* Info Detail Santri (Muncul setelah dipilih) */}
          {selectedSantri && (
            <div className="selected-santri-card">
              <div className="selected-santri-header">
                <div className="selected-santri-avatar">
                  {selectedSantri.nama ? selectedSantri.nama.slice(0, 2).toUpperCase() : 'ST'}
                </div>
                <div className="selected-santri-info">
                  <h3 className="selected-santri-name">{selectedSantri.nama}</h3>
                  <div className="santri-chips">
                    <span className="santri-chip">NIS: {selectedSantri.nis || '-'}</span>
                    <span className="santri-chip">Unit: {selectedSantri.nama_unit || '-'}</span>
                    <span className="santri-chip">Kamar: {selectedSantri.nama_kamar || '-'}</span>
                  </div>
                </div>
                <button type="button" onClick={handleClearSantri} className="btn-change-santri">
                  Ganti Santri
                </button>
              </div>
              {selectedSantri.nama_wali && (
                <div className="selected-santri-wali">
                  <span className="wali-label">Wali Santri:</span>
                  <span className="wali-name">{selectedSantri.nama_wali}</span>
                  {selectedSantri.no_hp_wali && (
                    <span className="wali-phone">({selectedSantri.no_hp_wali})</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tanggal Pelanggaran */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="violation-date">Tanggal Kejadian</label>
            <input 
              id="violation-date"
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              required
            />
          </div>

          {/* Combobox Kategori Pelanggaran */}
          <div ref={categoryDropdownRef} className="category-picker-field">
            <label htmlFor="violation-category">Kategori Pelanggaran</label>
            <button
              type="button"
              id="violation-category"
              className={`category-picker-trigger ${isKategoriOpen ? 'is-open' : ''}`}
              role="combobox"
              aria-expanded={isKategoriOpen}
              aria-controls="violation-category-menu"
              aria-haspopup="listbox"
              onClick={() => {
                setIsKategoriOpen(open => !open);
                setTimeout(() => categorySearchRef.current?.focus(), 0);
              }}
              onKeyDown={handleKategoriKeyDown}
            >
              <span className={selectedKategori ? 'category-picker-value' : 'category-picker-placeholder'}>
                {selectedKategori ? selectedKategori.uraian_pelanggaran : 'Pilih jenis pelanggaran'}
              </span>
              {selectedKategori && (
                <span className="category-picker-meta">
                  <span className={getSeverityClass(selectedKategori.kategori)}>{selectedKategori.kategori}</span>
                  <span className="points-pill-tag">{selectedKategori.poin_maks} poin maks</span>
                </span>
              )}
              <span className="category-picker-chevron" aria-hidden="true">⌄</span>
            </button>

            {isKategoriOpen && (
              <div id="violation-category-menu" className="category-picker-menu" role="listbox" aria-label="Pilihan jenis pelanggaran">
                <div className="category-picker-search-wrap">
                  <span aria-hidden="true">⌕</span>
                  <input
                    ref={categorySearchRef}
                    type="search"
                    value={kategoriSearch}
                    onChange={(event) => {
                      setKategoriSearch(event.target.value);
                      setActiveKategoriIndex(0);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setActiveKategoriIndex(index => Math.min(index + 1, Math.max(filteredKategoriList.length - 1, 0)));
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActiveKategoriIndex(index => Math.max(index - 1, 0));
                      } else if (event.key === 'Enter' && filteredKategoriList[activeKategoriIndex]) {
                        event.preventDefault();
                        selectKategori(filteredKategoriList[activeKategoriIndex]);
                      } else if (event.key === 'Escape') {
                        setIsKategoriOpen(false);
                      }
                    }}
                    placeholder="Cari jenis pelanggaran..."
                    aria-label="Cari jenis pelanggaran"
                  />
                </div>
                <div className="category-picker-list">
                  {filteredKategoriList.length > 0 ? filteredKategoriList.map((kat, index) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={String(kat.kategori_pelanggaran_id) === kategoriId}
                      className={`category-picker-option ${String(kat.kategori_pelanggaran_id) === kategoriId ? 'is-selected' : ''} ${index === activeKategoriIndex ? 'is-active' : ''}`}
                      key={kat.kategori_pelanggaran_id}
                      onMouseEnter={() => setActiveKategoriIndex(index)}
                      onClick={() => selectKategori(kat)}
                    >
                      <span className="category-option-copy">
                        <span className="category-option-title">{kat.uraian_pelanggaran}</span>
                        <span className={getSeverityClass(kat.kategori)}>{kat.kategori}</span>
                      </span>
                      <span className="category-option-points">{kat.poin_maks} Poin</span>
                    </button>
                  )) : (
                    <div className="category-picker-empty">Jenis pelanggaran tidak ditemukan.</div>
                  )}
                </div>
                <div className="category-picker-hint">↑↓ pilih · Enter konfirmasi · Esc tutup</div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="violation-points">
              Jumlah Poin {poinMaks !== null ? `(Maksimal ${poinMaks} poin)` : ''}
            </label>
            <input
              id="violation-points"
              type="number"
              min="1"
              max={poinMaks ?? undefined}
              step="1"
              value={poin}
              onChange={(e) => setPoin(e.target.value)}
              placeholder={poinMaks !== null ? `Masukkan 1 - ${poinMaks}` : 'Pilih kategori terlebih dahulu'}
              disabled={poinMaks === null}
              required
            />
            {poinMaks !== null && <small className="field-hint">Masukkan poin aktual, maksimal sesuai poin kategori yang dipilih.</small>}
          </div>

          {/* Custom File Dropzone & Camera Input with Real-time Preview */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="violation-photo">Bukti Foto (Kamera HP / File)</label>
            <div className="file-dropzone-custom">
              {fotoPreview ? (
                <div className="photo-preview-container">
                  <img src={fotoPreview} alt="Bukti Foto Pelanggaran" className="photo-preview-img" />
                  <div className="photo-preview-actions">
                    <span className="photo-filename">📎 {foto?.name}</span>
                    <button type="button" onClick={handleRemoveFoto} className="btn-remove-photo">
                      ✕ Hapus / Ganti Foto
                    </button>
                  </div>
                </div>
              ) : (
                <label htmlFor="violation-photo" className="photo-dropzone-label">
                  <div className="photo-dropzone-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <div className="photo-dropzone-text">
                    <strong>Ambil Foto Kejadian atau Pilih File</strong>
                    <span>Format JPG, PNG, atau WEBP. Kamera otomatis aktif di HP.</span>
                  </div>
                  <input
                    id="violation-photo"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFotoChange}
                    className="photo-input-hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="violation-notes">Catatan Tambahan (Opsional)</label>
            <textarea
              id="violation-notes"
              placeholder="Tuliskan keterangan tambahan mengenai kejadian pelanggaran..."
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="violation-submit"
          >
            {isSubmitting ? 'Menyimpan Data...' : 'Simpan Pelanggaran'}
          </button>

        </form>

        {poinAccumulated !== null && (
          <Link
            to={`/pelanggaran/semua?santri_id=${selectedSantri?.santri_id}`}
            className="violation-points-summary"
            aria-label={`Lihat detail pelanggaran ${selectedSantri?.nama || 'santri ini'}`}
          >
            <p style={{ color: '#991B1B', fontWeight: 600, fontSize: '15px', marginBottom: '8px' }}>Total Akumulasi Poin Pelanggaran Santri Saat Ini:</p>
            <p style={{ fontSize: '48px', color: '#7F1D1D', fontWeight: 800, margin: 0, lineHeight: 1 }}>
              {poinAccumulated} <span style={{ fontSize: '20px', fontWeight: 600 }}>Poin</span>
            </p>
            <span className="violation-points-summary-link">Lihat detail riwayat pelanggaran santri →</span>
          </Link>
        )}
      </div>
    </div>
  );
}
