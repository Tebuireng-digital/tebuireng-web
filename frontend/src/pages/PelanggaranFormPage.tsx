import { useState, useEffect, useRef, useMemo } from 'react';
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

type FormFeedback = {
  type: 'success' | 'error';
  title: string;
  message: string;
};

type SantriSearchStatus = 'idle' | 'loading' | 'success' | 'error';

interface InputHistoryRecord {
  pelanggaran_id: number;
  santri_id: number;
  petugas_pencatat_id?: number | null;
  nama_santri: string;
  kategori_pelanggaran_id: number;
  uraian_pelanggaran: string;
  kategori: string;
  poin?: number | null;
  poin_maks: number;
  tanggal: string;
  keterangan?: string | null;
  catatan?: string | null;
  tindakan_sanksi?: string | null;
}

const HISTORY_ROW_LIMIT = 8;

const backendFieldMap: Record<string, string> = {
  santri_id: 'santri',
  kategori_pelanggaran_id: 'kategori',
  uraian_pelanggaran_custom: 'uraian',
  kategori_custom: 'kategoriCustom',
  tanggal: 'tanggal',
  poin: 'poin',
  file: 'file',
  keterangan: 'catatan',
};

const focusableFieldIds: Record<string, string> = {
  santri: 'student-search',
  kategori: 'violation-category',
  tanggal: 'violation-date',
  poin: 'violation-points',
  uraian: 'custom-uraian',
  kategoriCustom: 'custom-kategori',
  catatan: 'violation-notes',
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

const getLocalFieldKey = (field?: string) => (field ? backendFieldMap[field] : undefined);

export function PelanggaranFormPage() {
  usePageMeta({
    title: 'Input Pelanggaran Baru',
    description: 'Formulir pencatatan pelanggaran santri baru oleh petugas Pondok Pesantren Tebuireng.',
  });

  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedSantri, setSelectedSantri] = useState<any | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearchingSantri, setIsSearchingSantri] = useState(false);
  const [santriSearchStatus, setSantriSearchStatus] = useState<SantriSearchStatus>('idle');
  const [activeSantriIndex, setActiveSantriIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  const [kategoriList, setKategoriList] = useState<any[]>([]);
  const [kategoriId, setKategoriId] = useState('');
  const [poin, setPoin] = useState('');
  const [isKategoriOpen, setIsKategoriOpen] = useState(false);
  const [kategoriSearch, setKategoriSearch] = useState('');
  const [activeKategoriIndex, setActiveKategoriIndex] = useState(0);
  const [isLoadingKategori, setIsLoadingKategori] = useState(true);

  const selectedKategori = kategoriList.find(item => String(item.kategori_pelanggaran_id) === kategoriId);
  const poinMaks = selectedKategori ? Number(selectedKategori.poin_maks) : null;

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [catatan, setCatatan] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [poinAccumulated, setPoinAccumulated] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState<FormFeedback | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [inputHistory, setInputHistory] = useState<InputHistoryRecord[]>([]);
  const [isInputHistoryLoading, setIsInputHistoryLoading] = useState(true);
  const [inputHistoryError, setInputHistoryError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (fotoPreview) {
        URL.revokeObjectURL(fotoPreview);
      }
    };
  }, [fotoPreview]);

  const clearResolvedSuccess = () => {
    setPoinAccumulated(current => (current === null ? current : null));
    setFormFeedback(current => (current?.type === 'success' ? null : current));
  };

  const clearFieldError = (field: string) => {
    setFieldErrors(previous => {
      if (!previous[field]) {
        return previous;
      }

      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const focusField = (field: string) => {
    const fieldId = focusableFieldIds[field];
    if (!fieldId) {
      return;
    }

    requestAnimationFrame(() => {
      const element = document.getElementById(fieldId) as HTMLElement | null;
      if (!element) {
        return;
      }

      element.focus?.();
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const showFieldError = (field: string, title: string, message: string) => {
    setFieldErrors({ [field]: message });
    setFormFeedback({ type: 'error', title, message });
    focusField(field);
  };

  const handleFotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    clearResolvedSuccess();
    clearFieldError('file');

    const file = event.target.files[0];

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      const message = 'Format bukti foto belum sesuai. Gunakan file JPG, PNG, atau WEBP.';
      setFieldErrors(previous => ({ ...previous, file: message }));
      setFormFeedback({ type: 'error', title: 'Bukti foto belum sesuai', message });
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      const message = 'Ukuran bukti foto terlalu besar. Gunakan foto dengan ukuran maksimal 5 MB.';
      setFieldErrors(previous => ({ ...previous, file: message }));
      setFormFeedback({ type: 'error', title: 'Bukti foto belum sesuai', message });
      event.target.value = '';
      return;
    }

    if (fotoPreview) {
      URL.revokeObjectURL(fotoPreview);
    }

    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleRemoveFoto = () => {
    clearResolvedSuccess();
    clearFieldError('file');
    setFoto(null);

    if (fotoPreview) {
      URL.revokeObjectURL(fotoPreview);
      setFotoPreview(null);
    }

    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const getSeverityClass = (kategori: string) => {
    const normalizedCategory = (kategori || '').toLowerCase().trim();
    if (normalizedCategory === 'kewajiban') return 'severity-badge severity-kewajiban';
    if (normalizedCategory === 'berat') return 'severity-badge severity-berat';
    if (normalizedCategory === 'sedang') return 'severity-badge severity-sedang';
    return 'severity-badge severity-ringan';
  };

  useEffect(() => {
    setIsLoadingKategori(true);
    api.get('/api/pelanggaran/kategori')
      .then(response => {
        let filtered = response.data;
        if (user?.jabatan === 'Pembina Kamar') {
          filtered = response.data.filter((item: any) => item.kategori?.toLowerCase().trim() === 'ringan');
        } else if (user?.jabatan === 'Keamanan') {
          filtered = response.data.filter((item: any) => ['sedang', 'berat'].includes(item.kategori?.toLowerCase().trim()));
        }
        setKategoriList(filtered);
      })
      .catch(console.error)
      .finally(() => setIsLoadingKategori(false));
  }, [user]);

  const loadInputHistory = async (options?: { silent?: boolean; signal?: AbortSignal }) => {
    const petugasId = user?.petugas_id;
    if (!petugasId) {
      setInputHistory([]);
      setInputHistoryError('');
      setIsInputHistoryLoading(false);
      return;
    }

    if (!options?.silent) {
      setIsInputHistoryLoading(true);
    }
    setInputHistoryError('');

    try {
      const response = await api.get('/api/pelanggaran', options?.signal ? { signal: options.signal } : undefined);
      const records = Array.isArray(response.data) ? response.data : [];
      const ownHistory = records
        .filter((record: InputHistoryRecord) => Number(record.petugas_pencatat_id) === Number(petugasId))
        .sort((first: InputHistoryRecord, second: InputHistoryRecord) => {
          const byDate = second.tanggal.localeCompare(first.tanggal);
          if (byDate !== 0) {
            return byDate;
          }
          return second.pelanggaran_id - first.pelanggaran_id;
        });

      setInputHistory(ownHistory);
    } catch (error: any) {
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
        return;
      }

      if (options?.silent) {
        return;
      }

      setInputHistoryError(error.response?.data?.message || 'Riwayat input terbaru belum dapat dimuat.');
      setInputHistory([]);
    } finally {
      if (!options?.silent) {
        setIsInputHistoryLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadInputHistory({ signal: controller.signal });

    return () => {
      controller.abort();
    };
  }, [user?.petugas_id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsKategoriOpen(false);
        if (selectedKategori) {
          setKategoriSearch(selectedKategori.uraian_pelanggaran);
        } else {
          setKategoriSearch('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedKategori]);

  useEffect(() => {
    const normalizedSearchTerm = searchTerm.trim();
    const selectedSantriName = selectedSantri?.nama?.trim();

    if (normalizedSearchTerm.length < 2 || (selectedSantriName && normalizedSearchTerm === selectedSantriName)) {
      setIsSearchingSantri(false);
      setSantriSearchStatus('idle');
      setShowDropdown(false);
      setSearchResults([]);
      setActiveSantriIndex(0);
      return;
    }

    const controller = new AbortController();
    let isCurrent = true;

    setShowDropdown(true);
    setIsSearchingSantri(true);
    setSantriSearchStatus('loading');
    setSearchResults([]);
    setActiveSantriIndex(0);

    const debounceHandle = window.setTimeout(() => {
      api.get(`/api/santri?q=${encodeURIComponent(normalizedSearchTerm)}`, { signal: controller.signal })
        .then(response => {
          if (!isCurrent) {
            return;
          }

          setSearchResults(response.data);
          setSantriSearchStatus('success');
          setActiveSantriIndex(0);
        })
        .catch(error => {
          if (!isCurrent) {
            return;
          }

          if (error?.name !== 'CanceledError' && error?.code !== 'ERR_CANCELED') {
            console.error(error);
            setSantriSearchStatus('error');
          }
        })
        .finally(() => {
          if (isCurrent) {
            setIsSearchingSantri(false);
          }
        });
    }, 300);

    return () => {
      isCurrent = false;
      window.clearTimeout(debounceHandle);
      controller.abort();
    };
  }, [searchTerm, selectedSantri]);

  const handleSelectSantri = (santri: any) => {
    clearResolvedSuccess();
    clearFieldError('santri');
    setSelectedSantri(santri);
    setSearchTerm(santri.nama);
    setSearchResults([]);
    setSantriSearchStatus('idle');
    setShowDropdown(false);
  };

  const handleClearSantri = () => {
    clearResolvedSuccess();
    clearFieldError('santri');
    setSelectedSantri(null);
    setSearchTerm('');
    setSearchResults([]);
    setSantriSearchStatus('idle');
    setShowDropdown(false);
    setActiveSantriIndex(0);
    setTimeout(() => {
      document.getElementById('student-search')?.focus();
    }, 0);
  };

  const handleSantriKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || searchResults.length === 0) {
      if (event.key === 'ArrowDown' && searchResults.length > 0) {
        setShowDropdown(true);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSantriIndex(previous => Math.min(previous + 1, searchResults.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSantriIndex(previous => Math.max(previous - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (searchResults[activeSantriIndex]) {
        handleSelectSantri(searchResults[activeSantriIndex]);
      }
    } else if (event.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleKategoriChange = (value: string) => {
    clearResolvedSuccess();
    clearFieldError('kategori');
    clearFieldError('poin');
    setKategoriId(value);
    const kategori = kategoriList.find(item => String(item.kategori_pelanggaran_id) === value);
    setPoin(kategori ? String(kategori.poin_maks) : '');
  };

  const filteredKategoriList = useMemo(() => {
    const query = kategoriSearch.trim().toLowerCase();
    if (!query || (selectedKategori && query === selectedKategori.uraian_pelanggaran.toLowerCase())) {
      return kategoriList;
    }

    return kategoriList.filter(item =>
      `${item.kategori} ${item.uraian_pelanggaran}`.toLowerCase().includes(query)
    );
  }, [kategoriList, kategoriSearch, selectedKategori]);

  const selectKategori = (kategori: any) => {
    handleKategoriChange(String(kategori.kategori_pelanggaran_id));
    setKategoriSearch(kategori.uraian_pelanggaran);
    setIsKategoriOpen(false);
    setActiveKategoriIndex(0);
  };

  const handleKategoriKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isKategoriOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setIsKategoriOpen(true);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveKategoriIndex(index => Math.min(index + 1, Math.max(filteredKategoriList.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveKategoriIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (filteredKategoriList[activeKategoriIndex]) {
        selectKategori(filteredKategoriList[activeKategoriIndex]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsKategoriOpen(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFieldErrors({});
    setFormFeedback(null);

    if (!selectedSantri) {
      showFieldError('santri', 'Pilih santri terlebih dahulu', 'Pilih santri terlebih dahulu sebelum menyimpan pelanggaran.');
      return;
    }
    if (!kategoriId || !selectedKategori) {
      showFieldError('kategori', 'Pilih jenis pelanggaran terlebih dahulu', 'Pilih jenis pelanggaran dari daftar kategori yang tersedia.');
      return;
    }
    if (!tanggal) {
      showFieldError('tanggal', 'Tanggal kejadian belum diisi', 'Isi tanggal kejadian terlebih dahulu.');
      return;
    }

    if (!poin || Number(poin) < 1 || (poinMaks !== null && Number(poin) > poinMaks)) {
      showFieldError('poin', 'Jumlah poin belum sesuai panduan', `Jumlah poin harus antara 1 dan ${poinMaks ?? 0} poin.`);
      return;
    }

    clearResolvedSuccess();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('santri_id', String(selectedSantri.santri_id));
      formData.append('kategori_pelanggaran_id', kategoriId);
      formData.append('poin', poin);
      formData.append('tanggal', tanggal);
      formData.append('keterangan', catatan);

      if (foto) {
        formData.append('file', foto);
      }

      await api.post('/api/pelanggaran', formData);

      let successMessage = foto
        ? 'Data pelanggaran dan foto pendukung berhasil disimpan.'
        : 'Data pelanggaran berhasil disimpan.';

      try {
        const poinResponse = await api.get(`/api/santri/${selectedSantri.santri_id}/poin`);
        setPoinAccumulated(poinResponse.data.total_poin);
      } catch (poinError) {
        console.warn('Pelanggaran tersimpan, tetapi total poin belum dapat dimuat.', poinError);
        setPoinAccumulated(null);
        successMessage = 'Data pelanggaran berhasil disimpan. Total poin terbaru belum dapat dimuat saat ini.';
      }

      setFormFeedback({
        type: 'success',
        title: 'Pelanggaran tersimpan',
        message: successMessage,
      });
      void loadInputHistory({ silent: true });

      setKategoriId('');
      setKategoriSearch('');
      setPoin('');
      setCatatan('');
      setFoto(null);
      clearFieldError('file');
      if (fotoPreview) {
        URL.revokeObjectURL(fotoPreview);
      }
      setFotoPreview(null);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    } catch (error: any) {
      const validationErrors = error.response?.data?.errors as Record<string, string[]> | undefined;
      const firstValidationField = validationErrors ? Object.keys(validationErrors)[0] : undefined;
      const localField = getLocalFieldKey(firstValidationField);
      const message = getReadableValidationMessage(error);

      if (localField) {
        setFieldErrors({ [localField]: message });
        focusField(localField);
      }

      setFormFeedback({
        type: 'error',
        title: 'Data belum berhasil disimpan',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartAnotherEntry = () => {
    setPoinAccumulated(null);
    setFormFeedback(null);
    requestAnimationFrame(() => {
      document.getElementById('violation-category')?.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const shouldShowFeedback = formFeedback && (formFeedback.type === 'error' || poinAccumulated === null);
  const shouldShowSantriDropdown = showDropdown && searchTerm.trim().length >= 2;
  const shouldShowSantriLoadingState = shouldShowSantriDropdown && isSearchingSantri;
  const shouldShowSantriResults = shouldShowSantriDropdown && santriSearchStatus === 'success' && searchResults.length > 0;
  const shouldShowSantriEmptyState = shouldShowSantriDropdown && santriSearchStatus === 'success' && searchResults.length === 0;
  const shouldShowSantriErrorState = shouldShowSantriDropdown && santriSearchStatus === 'error';
  const visibleInputHistory = useMemo(() => inputHistory.slice(0, HISTORY_ROW_LIMIT), [inputHistory]);
  const historyDescription = user?.jabatan === 'Admin'
    ? 'Catatan yang Anda input sebagai admin akan muncul di sini. Gunakan daftar pelanggaran untuk pencarian lengkap per santri atau kategori.'
    : 'Catatan yang Anda input terakhir akan muncul di sini. Gunakan daftar pelanggaran untuk pencarian lengkap per santri atau kategori.';

  return (
    <div className="violation-page">
      <div className="violation-layout-grid">
        <div className="violation-form-main">
          <div className="stat-card violation-card">
            {shouldShowFeedback && formFeedback && (
              <div
                id="violation-feedback"
                className={`violation-feedback is-${formFeedback.type}`}
                role={formFeedback.type === 'error' ? 'alert' : 'status'}
              >
                <div className="violation-feedback-copy">
                  <strong>{formFeedback.title}</strong>
                  <p>{formFeedback.message}</p>
                </div>
                <button
                  type="button"
                  className="violation-feedback-dismiss"
                  onClick={() => setFormFeedback(null)}
                >
                  Tutup
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="violation-form">
              <section className="form-section-block" aria-labelledby="section-santri-title">
                <div className="form-section-header">
                  <div>
                    <h3 id="section-santri-title" className="form-section-title">Identitas Santri</h3>
                    <p className="form-section-desc">Cari dan pastikan data santri yang akan dicatat agar riwayat tidak tertukar.</p>
                  </div>
                </div>

                {selectedSantri ? (
                  <div className="selected-santri-card">
                    <div className="selected-santri-header">
                      <div className="selected-santri-main">
                        <div className="selected-santri-avatar" aria-hidden="true">
                          {selectedSantri.nama ? selectedSantri.nama.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div className="selected-santri-info">
                          <h4 className="selected-santri-name">{selectedSantri.nama}</h4>
                          <div className="santri-chips">
                            <span className="santri-chip">NIS: {selectedSantri.nis || '-'}</span>
                            <span className="santri-chip">Kamar: {selectedSantri.nama_kamar || '-'}</span>
                            <span className="santri-chip">Unit: {selectedSantri.nama_unit || '-'}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearSantri}
                        className="btn-change-santri"
                        aria-label="Ganti santri terpilih"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <span>Ganti Santri</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="student-search-field" ref={dropdownRef}>
                    <label htmlFor="student-search">Cari Santri (Nama / NIS)</label>
                    <div className="student-search-input-wrap">
                      <input
                        id="student-search"
                        type="text"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-controls="student-search-results"
                        aria-expanded={shouldShowSantriDropdown}
                        placeholder="Ketik nama atau NIS santri..."
                        value={searchTerm}
                        onChange={event => {
                          clearResolvedSuccess();
                          clearFieldError('santri');
                          setSearchTerm(event.target.value);
                        }}
                        onFocus={() => {
                          if (searchTerm.trim().length >= 2) {
                            setShowDropdown(true);
                          }
                        }}
                        onKeyDown={handleSantriKeyDown}
                        style={{ paddingRight: '48px' }}
                        aria-activedescendant={
                          shouldShowSantriResults && searchResults[activeSantriIndex]
                            ? `santri-option-${searchResults[activeSantriIndex].santri_id}`
                            : undefined
                        }
                        aria-invalid={Boolean(fieldErrors.santri)}
                        aria-describedby={fieldErrors.santri ? 'student-search-error' : undefined}
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => {
                            clearResolvedSuccess();
                            clearFieldError('santri');
                            setSearchTerm('');
                            setSearchResults([]);
                            setSantriSearchStatus('idle');
                            setShowDropdown(false);
                            setActiveSantriIndex(0);
                          }}
                          className="btn-clear-input"
                          aria-label="Hapus teks pencarian"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      )}
                    </div>
                    {fieldErrors.santri && <small id="student-search-error" className="field-error" role="alert">{fieldErrors.santri}</small>}

                    {shouldShowSantriDropdown && (
                      <div
                        id="student-search-results"
                        className={`student-search-dropdown ${shouldShowSantriLoadingState ? 'is-loading' : ''}`}
                        role={shouldShowSantriResults ? 'listbox' : undefined}
                        aria-label={shouldShowSantriResults ? 'Hasil pencarian santri' : undefined}
                        aria-live={shouldShowSantriResults ? undefined : 'polite'}
                        aria-busy={shouldShowSantriLoadingState}
                      >
                        {shouldShowSantriLoadingState && (
                          <div className="student-search-state" role="status">
                            <div className="student-search-state-copy">
                              <strong>Mencari santri...</strong>
                              <span>Menyesuaikan nama dan NIS yang paling dekat dengan kata kunci Anda.</span>
                            </div>
                            <div className="student-search-skeleton-list" aria-hidden="true">
                              {Array.from({ length: 3 }, (_, index) => (
                                <div key={index} className="student-search-skeleton-item">
                                  <div
                                    className="skeleton-bar"
                                    style={{ width: `${68 - (index * 6)}%`, height: 12 }}
                                  />
                                  <div
                                    className="skeleton-bar"
                                    style={{ width: `${90 - (index * 7)}%`, height: 10 }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {shouldShowSantriResults && searchResults.map((santri, index) => (
                          <button
                            id={`santri-option-${santri.santri_id}`}
                            className={`student-search-result ${activeSantriIndex === index ? 'is-active' : ''}`}
                            type="button"
                            role="option"
                            aria-selected={activeSantriIndex === index}
                            key={santri.santri_id ?? index}
                            onMouseEnter={() => setActiveSantriIndex(index)}
                            onClick={() => handleSelectSantri(santri)}
                          >
                            <span className="search-result-name">{santri.nama}</span>
                            <span className="search-result-meta">NIS: {santri.nis || '-'} • {santri.nama_kamar || 'Kamar -'} • {santri.nama_unit || 'Unit -'}</span>
                          </button>
                        ))}

                        {shouldShowSantriEmptyState && (
                          <div className="student-search-state student-search-state-empty" role="status">
                            <div className="student-search-state-copy">
                              <strong>Nama tidak ditemukan</strong>
                              <span>Periksa ejaan nama atau coba cari menggunakan NIS santri.</span>
                            </div>
                          </div>
                        )}

                        {shouldShowSantriErrorState && (
                          <div className="student-search-state student-search-state-error" role="status">
                            <div className="student-search-state-copy">
                              <strong>Pencarian belum bisa dimuat</strong>
                              <span>Coba ulang beberapa saat lagi atau ketik ulang kata kunci pencarian.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="form-section-block" aria-labelledby="section-violation-title">
                <div className="form-section-header">
                  <div>
                    <h3 id="section-violation-title" className="form-section-title">Detail Pelanggaran</h3>
                    <p className="form-section-desc">Pilih kategori lebih dulu, lalu cek tanggal kejadian dan poin yang akan dicatat.</p>
                  </div>
                </div>

                <div ref={categoryDropdownRef} className="category-picker-field">
                  <label htmlFor="violation-category">Kategori Pelanggaran</label>
                  <div className="category-picker-input-wrap">
                    <input
                      ref={categoryInputRef}
                      id="violation-category"
                      type="text"
                      role="combobox"
                      aria-expanded={isKategoriOpen}
                      aria-controls="violation-category-menu"
                      aria-autocomplete="list"
                      className={`category-picker-input ${isKategoriOpen ? 'is-open' : ''}`}
                      value={kategoriSearch}
                      onChange={event => {
                        clearResolvedSuccess();
                        clearFieldError('kategori');
                        setKategoriSearch(event.target.value);
                        if (kategoriId) {
                          setKategoriId('');
                          setPoin('');
                        }
                        setIsKategoriOpen(true);
                        setActiveKategoriIndex(0);
                      }}
                      onFocus={event => {
                        setIsKategoriOpen(true);
                        event.target.select();
                      }}
                      onKeyDown={handleKategoriKeyDown}
                      placeholder={isLoadingKategori ? 'Memuat kategori pelanggaran...' : 'Cari jenis pelanggaran...'}
                      autoComplete="off"
                      aria-invalid={Boolean(fieldErrors.kategori)}
                      aria-describedby={fieldErrors.kategori ? 'violation-category-error' : undefined}
                    />
                    <div className="category-picker-actions">
                      {(kategoriSearch || selectedKategori) && (
                        <button
                          type="button"
                          className="btn-clear-input"
                          aria-label="Hapus pilihan jenis pelanggaran"
                          onClick={() => {
                            clearResolvedSuccess();
                            clearFieldError('kategori');
                            clearFieldError('poin');
                            setKategoriId('');
                            setPoin('');
                            setKategoriSearch('');
                            setActiveKategoriIndex(0);
                            setIsKategoriOpen(true);
                            categoryInputRef.current?.focus();
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        className="category-picker-toggle-btn"
                        aria-label={isKategoriOpen ? 'Tutup pilihan jenis pelanggaran' : 'Buka pilihan jenis pelanggaran'}
                        tabIndex={-1}
                        onClick={() => {
                          setIsKategoriOpen(open => !open);
                          categoryInputRef.current?.focus();
                        }}
                      >
                        <span className={`category-picker-chevron ${isKategoriOpen ? 'open' : ''}`} aria-hidden="true">
                          ⌄
                        </span>
                      </button>
                    </div>
                  </div>
                  {fieldErrors.kategori && <small id="violation-category-error" className="field-error" role="alert">{fieldErrors.kategori}</small>}
                  {!selectedKategori && !fieldErrors.kategori && (
                    <small className="field-hint">Kategori yang tampil sudah mengikuti akses jabatan {user?.jabatan || 'petugas'}.</small>
                  )}

                  {isKategoriOpen && (
                    <div id="violation-category-menu" className="category-picker-menu" role="listbox" aria-label="Daftar jenis pelanggaran">
                      <div id="category-options-list" className="category-picker-list">
                        {filteredKategoriList.length > 0 ? (
                          filteredKategoriList.map((kategori, index) => (
                            <button
                              type="button"
                              role="option"
                              aria-selected={String(kategori.kategori_pelanggaran_id) === kategoriId}
                              className={`category-picker-option ${String(kategori.kategori_pelanggaran_id) === kategoriId ? 'is-selected' : ''} ${index === activeKategoriIndex ? 'is-active' : ''}`}
                              key={kategori.kategori_pelanggaran_id}
                              onMouseEnter={() => setActiveKategoriIndex(index)}
                              onClick={() => selectKategori(kategori)}
                            >
                              <span className="category-option-copy">
                                <span className="category-option-title">{kategori.uraian_pelanggaran}</span>
                                <span className={getSeverityClass(kategori.kategori)}>{kategori.kategori}</span>
                              </span>
                              <span className="category-option-points">{kategori.poin_maks} Poin</span>
                            </button>
                          ))
                        ) : (
                          <div className="category-picker-empty">Jenis pelanggaran "{kategoriSearch}" tidak ditemukan.</div>
                        )}
                      </div>
                      <div className="category-picker-hint">↑↓ navigasi · Enter pilih · Esc tutup</div>
                    </div>
                  )}
                </div>

                {selectedKategori && (
                  <div className="violation-selection-note" role="status">
                    <div className="violation-selection-note-top">
                      <strong>{selectedKategori.uraian_pelanggaran}</strong>
                      <span className="violation-selection-note-points">{selectedKategori.poin_maks} poin panduan</span>
                    </div>
                    <div className="violation-selection-note-meta">
                      <span className={getSeverityClass(selectedKategori.kategori)}>{selectedKategori.kategori}</span>
                      <p>Poin awal mengikuti batas kategori. Sesuaikan bila hasil pembinaan menetapkan nilai yang lebih rendah, tetapi jangan melebihi batas panduan.</p>
                    </div>
                  </div>
                )}

                <div className="form-row-2col">
                  <div className="violation-field-stack">
                    <label htmlFor="violation-date">Tanggal Kejadian</label>
                    <input
                      id="violation-date"
                      className="violation-field-tabular"
                      type="date"
                      value={tanggal}
                      onChange={event => {
                        clearResolvedSuccess();
                        clearFieldError('tanggal');
                        setTanggal(event.target.value);
                      }}
                      required
                      aria-invalid={Boolean(fieldErrors.tanggal)}
                      aria-describedby={fieldErrors.tanggal ? 'violation-date-error' : undefined}
                    />
                    {fieldErrors.tanggal && <small id="violation-date-error" className="field-error" role="alert">{fieldErrors.tanggal}</small>}
                  </div>

                  <div className="violation-field-stack">
                    <label htmlFor="violation-points">
                      Jumlah Poin
                      {poinMaks !== null ? ` (Maks. ${poinMaks} poin)` : ''}
                    </label>
                    <input
                      id="violation-points"
                      className="violation-field-tabular"
                      type="number"
                      min="1"
                      max={poinMaks ?? undefined}
                      step="1"
                      value={poin}
                      onChange={event => {
                        clearResolvedSuccess();
                        clearFieldError('poin');
                        setPoin(event.target.value);
                      }}
                      placeholder={poinMaks !== null ? `1 - ${poinMaks}` : 'Pilih kategori lebih dulu'}
                      disabled={poinMaks === null}
                      aria-invalid={Boolean(fieldErrors.poin)}
                      aria-describedby={fieldErrors.poin ? 'violation-points-error' : undefined}
                    />
                    {!fieldErrors.poin && poinMaks !== null && (
                      <small className="field-hint">
                        Poin awal terisi dari kategori dan masih bisa disesuaikan selama tidak melebihi batas panduan.
                      </small>
                    )}
                    {fieldErrors.poin && <small id="violation-points-error" className="field-error" role="alert">{fieldErrors.poin}</small>}
                  </div>
                </div>
              </section>

              <section className="form-section-block" aria-labelledby="section-evidence-title">
                <div className="form-section-header">
                  <div>
                    <h3 id="section-evidence-title" className="form-section-title">Bukti & Keterangan</h3>
                    <p className="form-section-desc">Tambahkan foto bila ada, lalu tulis kronologi singkat agar petugas lain bisa meninjau dengan cepat.</p>
                  </div>
                </div>

                <div className="violation-field-stack">
                  <label htmlFor="violation-photo">Bukti Foto (Kamera HP / File)</label>
                  <small className="field-hint violation-photo-hint">Foto pendukung dianjurkan bila ada konteks insiden atau barang bukti. Jika tidak ada foto, pastikan catatan kronologi cukup jelas.</small>
                  <div className="file-dropzone-custom">
                    {fotoPreview ? (
                      <div className="photo-preview-container">
                        <img src={fotoPreview} alt="Bukti foto pelanggaran" className="photo-preview-img" />
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
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                          </svg>
                        </div>
                        <div className="photo-dropzone-text">
                          <strong>Tambahkan Foto Pendukung</strong>
                          <span>JPG, PNG, atau WEBP. Maksimal 5 MB.</span>
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
                  {fieldErrors.file && <small className="field-error" role="alert">{fieldErrors.file}</small>}
                </div>

                <div className="violation-field-stack">
                  <label htmlFor="violation-notes">Catatan Tambahan (Opsional)</label>
                  <textarea
                    id="violation-notes"
                    placeholder="Tuliskan kronologi singkat atau konteks tambahan kejadian..."
                    value={catatan}
                    onChange={event => {
                      clearResolvedSuccess();
                      clearFieldError('catatan');
                      setCatatan(event.target.value);
                    }}
                  />
                </div>
              </section>

              <div className="violation-form-actions">
                <Link to="/pelanggaran/semua" className="btn-cancel-form">
                  Batal
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="violation-submit"
                >
                  {isSubmitting ? (foto ? 'Menyimpan Data & Foto...' : 'Menyimpan Data...') : 'Simpan Pelanggaran'}
                </button>
              </div>
            </form>

            {poinAccumulated !== null && (
              <section className="violation-success-summary" aria-labelledby="violation-success-title">
                <div className="violation-success-header">
                  <span className="violation-success-check" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
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
                  <span className="violation-success-note">Tinjau kembali bila perlu sebelum menambah catatan berikutnya.</span>
                </div>
                <div className="violation-success-actions">
                  <Link to={`/pelanggaran/semua?santri_id=${selectedSantri?.santri_id}`} className="violation-history-link">
                    Lihat riwayat pelanggaran <span aria-hidden="true">→</span>
                  </Link>
                  <button type="button" className="violation-new-entry" onClick={handleStartAnotherEntry}>
                    Input lagi
                  </button>
                </div>
              </section>
            )}
          </div>

          <section className="master-section violation-history-section" aria-labelledby="violation-history-title">
            <div className="section-heading violation-history-heading">
              <div>
                <h2 id="violation-history-title">Riwayat input terbaru</h2>
                <p className="violation-history-intro">{historyDescription}</p>
              </div>
              <div className="violation-history-heading-actions">
                <Link to="/pelanggaran/semua" className="secondary-button" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  Buka daftar pelanggaran
                </Link>
              </div>
            </div>

            {isInputHistoryLoading ? (
              <div className="table-scroll">
                <table className="master-table violation-history-table" aria-label="Riwayat input terbaru">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Tanggal</th>
                      <th>Nama Santri</th>
                      <th>Kategori</th>
                      <th>Uraian Pelanggaran</th>
                      <th>Poin</th>
                      <th>Catatan / Tindakan</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }, (_, index) => (
                      <tr key={`history-skeleton-${index}`} className="table-skeleton-row">
                        <td><span className="table-skeleton-line line-1" /></td>
                        <td><span className="table-skeleton-line line-2" /></td>
                        <td><span className="table-skeleton-line" /></td>
                        <td><span className="table-skeleton-line line-1" /></td>
                        <td><span className="table-skeleton-line" /></td>
                        <td><span className="table-skeleton-line line-1" /></td>
                        <td><span className="table-skeleton-line" /></td>
                        <td><span className="table-skeleton-line line-2" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : inputHistoryError ? (
              <div className="error-box violation-history-error">
                <span>{inputHistoryError}</span>
                <button type="button" className="secondary-button" onClick={() => void loadInputHistory()}>
                  Coba lagi
                </button>
              </div>
            ) : visibleInputHistory.length > 0 ? (
              <>
                <p className="account-result-count">
                  Menampilkan {visibleInputHistory.length} dari {inputHistory.length} input terbaru Anda.
                </p>
                <div className="table-scroll">
                  <table className="master-table violation-history-table" aria-label="Riwayat input terbaru">
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Tanggal</th>
                        <th>Nama Santri</th>
                        <th>Kategori</th>
                        <th>Uraian Pelanggaran</th>
                        <th>Poin</th>
                        <th>Catatan / Tindakan</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleInputHistory.map((item, index) => (
                        <tr key={item.pelanggaran_id}>
                          <td>{index + 1}</td>
                          <td><strong>{item.tanggal}</strong></td>
                          <td><strong>{item.nama_santri}</strong></td>
                          <td><span className={getSeverityClass(item.kategori)}>{item.kategori || 'Ringan'}</span></td>
                          <td>{item.uraian_pelanggaran}</td>
                          <td>
                            <strong className="violation-history-points">
                              +{item.poin || item.poin_maks}
                            </strong>
                          </td>
                          <td>{item.keterangan || item.catatan || item.tindakan_sanksi || '—'}</td>
                          <td>
                            <Link
                              to={`/pelanggaran/semua?santri_id=${item.santri_id}`}
                              className="table-detail-link"
                              title={`Lihat semua pelanggaran ${item.nama_santri}`}
                            >
                              Lihat detail
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="empty-state violation-history-empty">
                Belum ada riwayat input dari akun ini. Setelah menyimpan pelanggaran, catatan terbaru akan muncul otomatis di tabel.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
