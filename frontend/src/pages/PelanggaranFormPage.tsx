import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { usePageMeta } from '../hooks/usePageMeta';

const validationFieldMessages: Record<string, string> = {
  santri_id: 'Silakan pilih santri terlebih dahulu.',
  kategori_pelanggaran_id: 'Silakan pilih kategori pelanggaran terlebih dahulu.',
  tanggal: 'Tanggal kejadian wajib diisi dengan benar.',
  poin: 'Jumlah poin harus diisi sesuai batas poin kategori yang dipilih.',
  keterangan: 'Catatan tambahan tidak dapat diproses. Periksa kembali isinya.',
};

const getReadableValidationMessage = (error: any): string => {
  const responseData = error.response?.data;
  const validationErrors = responseData?.errors as Record<string, string[]> | undefined;
  const firstValidationField = validationErrors ? Object.keys(validationErrors)[0] : undefined;
  const rawMessage = firstValidationField && validationErrors?.[firstValidationField]?.[0]
    ? validationErrors[firstValidationField][0]
    : responseData?.message || error.message;
  const normalizedMessage = String(rawMessage || '').toLowerCase();

  if (firstValidationField === 'file' || normalizedMessage.includes('file field must be a file')) {
    return 'Bukti foto tidak terbaca. Silakan pilih ulang foto JPG, PNG, atau WEBP dengan ukuran maksimal 5 MB.';
  }
  if (normalizedMessage.includes('mimes') || normalizedMessage.includes('must be a file of type')) {
    return 'Format bukti foto belum sesuai. Gunakan file JPG, PNG, atau WEBP.';
  }
  if (normalizedMessage.includes('may not be greater than') || normalizedMessage.includes('maximum')) {
    return 'Ukuran bukti foto terlalu besar. Gunakan foto dengan ukuran maksimal 5 MB.';
  }
  if (firstValidationField && validationFieldMessages[firstValidationField]) {
    return validationFieldMessages[firstValidationField];
  }
  if (responseData?.message === 'Role kamu tidak memiliki akses ini.') {
    return 'Akun Anda tidak memiliki izin untuk mencatat pelanggaran ini.';
  }

  return responseData?.message || 'Data pelanggaran belum dapat disimpan. Periksa kembali isian formulir lalu coba lagi.';
};

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
  const [isSearchingSantri, setIsSearchingSantri] = useState(false);
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
  const [isLoadingKategori, setIsLoadingKategori] = useState(true);

  // Custom violation state
  const [uraianPelanggaranCustom, setUraianPelanggaranCustom] = useState('');
  const [kategoriCustom, setKategoriCustom] = useState<'Ringan' | 'Sedang' | 'Berat' | 'Kewajiban'>('Ringan');
  const isCustomKategori = kategoriId === '0';

  // Form State
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [catatan, setCatatan] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [poinAccumulated, setPoinAccumulated] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalState, setModalState] = useState<{ isOpen: boolean, type: 'success' | 'error', message: string }>({ isOpen: false, type: 'success', message: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const modalRef = useRef<HTMLDivElement>(null);
  const modalCloseRef = useRef<HTMLButtonElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setModalState({ isOpen: true, type: 'error', message: 'Foto harus berformat JPG, PNG, atau WEBP.' });
        e.target.value = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setModalState({ isOpen: true, type: 'error', message: 'Ukuran foto maksimal 5 MB.' });
        e.target.value = '';
        return;
      }

      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
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
    if (photoInputRef.current) photoInputRef.current.value = '';
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
    setIsLoadingKategori(true);
    api.get('/api/pelanggaran/kategori').then(res => {
      let filtered = res.data;
      if (user && (user as any).jabatan === 'Pembina Kamar') {
        filtered = res.data.filter((k: any) => k.kategori?.toLowerCase().trim() === 'ringan');
      } else if (user && (user as any).jabatan === 'Keamanan') {
        filtered = res.data.filter((k: any) => ['sedang', 'berat'].includes(k.kategori?.toLowerCase().trim()));
      }
      setKategoriList(filtered);
    }).catch(console.error).finally(() => setIsLoadingKategori(false));

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
    const closeButton = modalCloseRef.current;
    closeButton?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalState({ ...modalState, isOpen: false });
      }
    };
    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDialogKeyDown);
      previouslyFocused?.focus();
    };
  }, [modalState.isOpen]);

  // Search Santri Effect (Debounced)
  useEffect(() => {
    if (searchTerm.trim().length >= 2 && (!selectedSantri || searchTerm !== selectedSantri.nama)) {
      const delayDebounceFn = setTimeout(() => {
        setIsSearchingSantri(true);
        api.get(`/api/santri?q=${encodeURIComponent(searchTerm.trim())}`).then(res => {
          setSearchResults(res.data);
          setShowDropdown(true);
        }).catch(console.error).finally(() => setIsSearchingSantri(false));
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setShowDropdown(false);
    }
  }, [searchTerm, selectedSantri]);

  const handleSelectSantri = (santri: any) => {
    setSelectedSantri(santri);
    setSearchTerm(santri.nama);
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleClearSantri = () => {
    setSelectedSantri(null);
    setSearchTerm('');
    setSearchResults([]);
    setPoinAccumulated(null);
  };

  const selectedKategori = kategoriList.find(kat => String(kat.kategori_pelanggaran_id) === kategoriId);
  const poinMaks = isCustomKategori ? 100 : (selectedKategori ? Number(selectedKategori.poin_maks) : null);

  const handleKategoriChange = (value: string) => {
    setKategoriId(value);
    if (value === '0') {
      setPoin('5');
    } else {
      const kategori = kategoriList.find(kat => String(kat.kategori_pelanggaran_id) === value);
      setPoin(kategori ? String(kategori.poin_maks) : '');
    }
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
    setFieldErrors({});
    const showFormError = (field: string, message: string) => {
      setFieldErrors({ [field]: message });
      setModalState({ isOpen: true, type: 'error', message });
    };

    if (!selectedSantri) {
      showFormError('santri', 'Pilih santri terlebih dahulu sebelum menyimpan pelanggaran.');
      return;
    }
    if (!kategoriId) {
      showFormError('kategori', 'Pilih kategori pelanggaran terlebih dahulu.');
      return;
    }
    if (!tanggal) {
      showFormError('tanggal', 'Isi tanggal kejadian terlebih dahulu.');
      return;
    }

    if (isCustomKategori) {
      if (!uraianPelanggaranCustom.trim()) {
        showFormError('uraian', 'Ketik nama atau uraian pelanggaran baru terlebih dahulu.');
        return;
      }
      if (!poin || Number(poin) < 1 || Number(poin) > 100) {
        showFormError('poin', 'Jumlah poin pelanggaran manual harus antara 1 dan 100.');
        return;
      }
    } else {
      if (!poin || Number(poin) < 1 || (poinMaks !== null && Number(poin) > poinMaks)) {
        showFormError('poin', `Jumlah poin harus antara 1 dan ${poinMaks ?? 0} poin.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('santri_id', String(selectedSantri.santri_id));
      formData.append('kategori_pelanggaran_id', kategoriId);
      formData.append('poin', poin);
      formData.append('tanggal', tanggal);
      formData.append('keterangan', catatan);

      if (isCustomKategori) {
        formData.append('uraian_pelanggaran_custom', uraianPelanggaranCustom.trim());
        formData.append('kategori_custom', kategoriCustom);
      }
      if (foto) formData.append('file', foto);

      await api.post('/api/pelanggaran', formData);

      // Fetching the refreshed total is secondary to the successful save.
      try {
        const resPoin = await api.get(`/api/santri/${selectedSantri.santri_id}/poin`);
        setPoinAccumulated(resPoin.data.total_poin);
      } catch (poinError) {
        console.warn('Pelanggaran tersimpan, tetapi total poin belum dapat dimuat.', poinError);
        setPoinAccumulated(null);
      }
      
      setModalState({ isOpen: true, type: 'success', message: 'Berhasil menyimpan pelanggaran!' });
      
      // Reset form optional
      setKategoriId('');
      setUraianPelanggaranCustom('');
      setPoin('');
      setCatatan('');
      setFoto(null);
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
      setFotoPreview(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
    } catch (err: any) {
      setModalState({ isOpen: true, type: 'error', message: getReadableValidationMessage(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="violation-page">
      
      {/* Modal Pesan Sukses / Error */}
      {modalState.isOpen && (
        <div className="violation-modal-backdrop">
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="violation-modal-title" aria-describedby="violation-modal-message" className={`violation-modal ${modalState.type}`}>
            <div className="violation-modal-icon" aria-hidden="true">
              {modalState.type === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              )}
            </div>
            <span className="violation-modal-eyebrow">{modalState.type === 'success' ? 'Tersimpan' : 'Perlu diperiksa'}</span>
            <h2 id="violation-modal-title">
              {modalState.type === 'success' ? 'Pelanggaran berhasil dicatat' : 'Data belum lengkap'}
            </h2>
            <p id="violation-modal-message" className="violation-modal-message">
              {modalState.message}
            </p>
            <div className="violation-modal-actions">
              <button 
                ref={modalCloseRef}
                onClick={() => setModalState({ ...modalState, isOpen: false })}
                className="violation-modal-close"
              >
                Lanjutkan
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

        <form onSubmit={handleSubmit} noValidate className="violation-form">
          
          {/* Autocomplete Pencarian Santri */}
          <div className="student-search-field" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }} ref={dropdownRef}>
            <label htmlFor="student-search">Cari Santri (Nama / NIS)</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
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
                style={{
                  paddingRight: '44px',
                  borderColor: selectedSantri ? '#10B981' : undefined,
                  backgroundColor: selectedSantri ? '#F0FDF4' : undefined,
                  fontWeight: selectedSantri ? 600 : undefined,
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
                aria-invalid={Boolean(fieldErrors.santri)}
                aria-describedby={fieldErrors.santri ? 'student-search-error' : undefined}
              />
              {selectedSantri && (
                <button type="button" onClick={handleClearSantri} className="btn-clear-input" aria-label="Hapus santri terpilih" style={{ position: 'absolute', right: '8px' }}>
                  X
                </button>
              )}
            </div>
            {selectedSantri && (
              <small className="selected-student-school">
                Asal sekolah: {selectedSantri.nama_unit || 'Belum tercatat'}
              </small>
            )}
            {isSearchingSantri && <small className="field-hint">Sedang mencari santri...</small>}
            {fieldErrors.santri && <small id="student-search-error" className="field-error" role="alert">{fieldErrors.santri}</small>}

            {/* Dropdown Hasil Pencarian */}
            {showDropdown && searchResults.length > 0 && (
              <div id="student-search-results" role="listbox" className="student-search-dropdown">
                {searchResults.map((s, idx) => (
              <button
                    className={`student-search-result ${selectedSantri?.santri_id === s.santri_id ? 'is-selected' : ''}`} 
                    type="button" 
                    role="option" 
                    aria-selected={selectedSantri?.santri_id === s.santri_id} 
                    key={s.santri_id ?? idx} 
                    onClick={() => handleSelectSantri(s)}
                  >
                    <span className="search-result-name">{s.nama}</span>
                    <span className="search-result-meta">NIS: {s.nis || '-'} &bull; {s.nama_kamar || 'Kamar -'} &bull; {s.nama_unit || 'Unit -'}</span>
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

          {/* Tanggal Pelanggaran */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="violation-date">Tanggal Kejadian</label>
            <input 
              id="violation-date"
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              required
              aria-invalid={Boolean(fieldErrors.tanggal)}
              aria-describedby={fieldErrors.tanggal ? 'violation-date-error' : undefined}
            />
            {fieldErrors.tanggal && <small id="violation-date-error" className="field-error" role="alert">{fieldErrors.tanggal}</small>}
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
              aria-invalid={Boolean(fieldErrors.kategori)}
              aria-describedby={fieldErrors.kategori ? 'violation-category-error' : undefined}
              onClick={() => {
                setIsKategoriOpen(open => !open);
                setTimeout(() => categorySearchRef.current?.focus(), 0);
              }}
              onKeyDown={handleKategoriKeyDown}
            >
              <span className={selectedKategori || isCustomKategori ? 'category-picker-value' : 'category-picker-placeholder'}>
                {isLoadingKategori ? 'Memuat kategori pelanggaran...' : isCustomKategori
                  ? (uraianPelanggaranCustom ? `[Manual] ${uraianPelanggaranCustom}` : '+ Lainnya / Input Manual (Tidak ada di panduan)')
                  : (selectedKategori ? selectedKategori.uraian_pelanggaran : 'Pilih jenis pelanggaran')}
              </span>
              {selectedKategori && (
                <span className="category-picker-meta">
                  <span className={getSeverityClass(selectedKategori.kategori)}>{selectedKategori.kategori}</span>
                  <span className="points-pill-tag">{selectedKategori.poin_maks} poin maks</span>
                </span>
              )}
              {isCustomKategori && (
                <span className="category-picker-meta">
                  <span className={getSeverityClass(kategoriCustom)}>{kategoriCustom}</span>
                  <span className="points-pill-tag">Input Manual</span>
                </span>
              )}
              <span className="category-picker-chevron" aria-hidden="true">⌄</span>
              </button>
            {fieldErrors.kategori && <small id="violation-category-error" className="field-error" role="alert">{fieldErrors.kategori}</small>}

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
                  <button
                    type="button"
                    role="option"
                    aria-selected={isCustomKategori}
                    className={`category-picker-option ${isCustomKategori ? 'is-selected' : ''}`}
                    style={{ background: 'rgba(15, 110, 86, 0.08)', borderBottom: '1px dashed var(--garis)' }}
                    onClick={() => {
                      handleKategoriChange('0');
                      setKategoriSearch('');
                      setIsKategoriOpen(false);
                    }}
                  >
                    <span className="category-option-copy">
                      <strong style={{ color: 'var(--aksen)', fontWeight: 600 }}>+ Lainnya / Input Manual (Tidak ada di panduan)</strong>
                    </span>
                    <span className="category-option-points">Input Baru</span>
                  </button>

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

          {/* Custom Input Fields (Jika memilih "Lainnya / Input Manual") */}
          {isCustomKategori && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', backgroundColor: 'rgba(15, 110, 86, 0.05)', borderRadius: '8px', border: '1px solid var(--garis)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label htmlFor="custom-uraian" style={{ fontWeight: 600, color: 'var(--tinta)', marginBottom: '6px' }}>Nama / Uraian Pelanggaran Baru *</label>
                <input
                  id="custom-uraian"
                  type="text"
                  value={uraianPelanggaranCustom}
                  onChange={(e) => setUraianPelanggaranCustom(e.target.value)}
                  placeholder="Ketik nama pelanggaran (mis. Menggunakan HP di luar jadwal)..."
                  required
                  aria-invalid={Boolean(fieldErrors.uraian)}
                  aria-describedby={fieldErrors.uraian ? 'custom-uraian-error' : undefined}
                />
                {fieldErrors.uraian && <small id="custom-uraian-error" className="field-error" role="alert">{fieldErrors.uraian}</small>}
              </div>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column' }}>
                  <label htmlFor="custom-kategori" style={{ fontWeight: 600, color: 'var(--tinta)', marginBottom: '6px' }}>Tingkat Kategori Pelanggaran *</label>
                  <select
                    id="custom-kategori"
                    value={kategoriCustom}
                    onChange={(e) => setKategoriCustom(e.target.value as any)}
                    style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--garis)', backgroundColor: 'var(--kertas)' }}
                  >
                    <option value="Ringan">Ringan</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Berat">Berat</option>
                    <option value="Kewajiban">Kewajiban</option>
                  </select>
                </div>
              </div>
            </div>
          )}

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
              aria-invalid={Boolean(fieldErrors.poin)}
              aria-describedby={fieldErrors.poin ? 'violation-points-error' : undefined}
            />
            {poinMaks !== null && <small className="field-hint">Masukkan poin aktual, maksimal sesuai poin kategori yang dipilih.</small>}
            {fieldErrors.poin && <small id="violation-points-error" className="field-error" role="alert">{fieldErrors.poin}</small>}
          </div>

          {/* Custom File Dropzone & Camera Input with Real-time Preview */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="violation-photo">Bukti Foto (Kamera HP / File)</label>
            <div className="file-dropzone-custom">
              {fotoPreview ? (
                <div className="photo-preview-container">
                  <img src={fotoPreview} alt="Bukti Foto Pelanggaran" className="photo-preview-img" />
                  <div className="photo-preview-actions">
                    <span className="photo-filename">{foto?.name}</span>
                    <button
                      type="button"
                      onClick={handleRemoveFoto}
                      className="btn-remove-photo"
                      aria-label="Hapus atau ganti foto"
                      title="Hapus atau ganti foto"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                      </svg>
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
                    <span>Format JPG, PNG, atau WEBP. Maksimal 5 MB.</span>
                  </div>
                  <input
                    id="violation-photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFotoChange}
                    ref={photoInputRef}
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
            {isSubmitting ? (foto ? 'Menyimpan Data & Foto...' : 'Menyimpan Data...') : 'Simpan Pelanggaran'}
          </button>

        </form>

        {poinAccumulated !== null && (
          <section className="violation-success-summary" aria-labelledby="violation-success-title">
            <div className="violation-success-header">
              <span className="violation-success-check" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              <div>
                <h2 id="violation-success-title">Pelanggaran berhasil dicatat</h2>
                <p>Data baru sudah masuk ke riwayat {selectedSantri?.nama || 'santri'}.</p>
              </div>
            </div>
            <div className="violation-success-content">
              <div>
                <span className="violation-success-label">Akumulasi poin saat ini</span>
                <strong className="violation-success-points">{poinAccumulated}<small> poin</small></strong>
              </div>
              <span className="violation-success-note">Pastikan poin ditinjau kembali bila diperlukan.</span>
            </div>
            <div className="violation-success-actions">
              <Link to={`/pelanggaran/semua?santri_id=${selectedSantri?.santri_id}`} className="violation-history-link">
                Lihat riwayat pelanggaran <span aria-hidden="true">→</span>
              </Link>
              <button type="button" className="violation-new-entry" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                Input lagi
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
