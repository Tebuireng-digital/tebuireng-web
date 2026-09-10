import type { AxiosError } from 'axios';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { usePageMeta } from '../hooks/usePageMeta';

interface ViolationCategory {
  kategori_pelanggaran_id: number;
  kode_pasal: string;
  kategori: 'Ringan' | 'Sedang' | 'Berat' | 'Kewajiban';
  uraian_pelanggaran: string;
  poin_maks: number;
  jenis: 'Pelanggaran' | 'Meninggalkan Kewajiban';
  status_aktif: 'Aktif' | 'Tidak Aktif';
}

interface CategoryForm {
  kode_pasal: string;
  kategori: ViolationCategory['kategori'];
  uraian_pelanggaran: string;
  poin_maks: string;
  jenis: ViolationCategory['jenis'];
}

const emptyForm: CategoryForm = {
  kode_pasal: '',
  kategori: 'Ringan',
  uraian_pelanggaran: '',
  poin_maks: '1',
  jenis: 'Pelanggaran',
};

const kategoriOptions: Array<CategoryForm['kategori']> = ['Ringan', 'Sedang', 'Berat', 'Kewajiban'];
const jenisOptions: Array<CategoryForm['jenis']> = ['Pelanggaran', 'Meninggalkan Kewajiban'];

type PaginationItem = number | 'ellipsis';

const getPaginationItems = (current: number, total: number): PaginationItem[] => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, 6, 'ellipsis', total];
  if (current >= total - 3) return [1, 'ellipsis', total - 5, total - 4, total - 3, total - 2, total - 1, total];
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
};

function getErrorMessage(error: unknown, fallback: string) {
  const responseMessage = (error as AxiosError<{ message?: string }>)?.response?.data?.message;
  return typeof responseMessage === 'string' && responseMessage.trim() ? responseMessage : fallback;
}

export function PelanggaranMasterPage() {
  usePageMeta({
    title: 'Master Pelanggaran',
    description: 'Kelola master kategori, tipe, dan poin pelanggaran SIMANTEB untuk keamanan dan admin.',
  });

  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement | null>(null);
  const kodePasalInputRef = useRef<HTMLInputElement | null>(null);
  const listTopRef = useRef<HTMLDivElement | null>(null);

  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<ViolationCategory | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);
  const [reactivatingId, setReactivatingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Auto-dismiss toast after 3.5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Search, filter, and pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKategori, setSelectedKategori] = useState<'Semua' | CategoryForm['kategori']>('Semua');
  const [selectedJenis, setSelectedJenis] = useState<'Semua' | CategoryForm['jenis']>('Semua');
  const [selectedStatus, setSelectedStatus] = useState<'Semua' | 'Aktif' | 'Tidak Aktif'>('Aktif');
  const [pageSize, setPageSize] = useState<number | 'all'>(12);
  const [currentPage, setCurrentPage] = useState(1);

  const categories = useQuery<ViolationCategory[]>({
    queryKey: ['pelanggaran-master'],
    queryFn: async () => (await api.get('/api/pelanggaran/kategori', { params: { all: 1 } })).data,
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setEditingCategory(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, poin_maks: Number(form.poin_maks) };
      if (editingId) {
        return (await api.patch(`/api/pelanggaran/kategori/${editingId}`, payload)).data;
      }
      return (await api.post('/api/pelanggaran/kategori', payload)).data;
    },
    onMutate: () => {
      setToast(null);
    },
    onSuccess: () => {
      resetForm();
      setToast({ text: 'Perubahan data berhasil', type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['pelanggaran-master'] });
    },
    onError: (mutationError: unknown) => {
      setToast({
        text: getErrorMessage(mutationError, 'Master pelanggaran belum dapat disimpan. Periksa isian lalu coba lagi.'),
        type: 'error',
      });
    },
  });

  const deactivate = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/api/pelanggaran/kategori/${id}`)).data,
    onMutate: (id: number) => {
      setDeactivatingId(id);
      setToast(null);
    },
    onSuccess: (_response, id) => {
      if (editingId === id) {
        resetForm();
      }
      setToast({ text: 'Perubahan data berhasil', type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['pelanggaran-master'] });
    },
    onError: (mutationError: unknown) => {
      setToast({
        text: getErrorMessage(mutationError, 'Master pelanggaran belum dapat dinonaktifkan. Coba lagi.'),
        type: 'error',
      });
    },
    onSettled: () => {
      setDeactivatingId(null);
    },
  });

  const reactivate = useMutation({
    mutationFn: async (id: number) =>
      (await api.patch(`/api/pelanggaran/kategori/${id}`, { status_aktif: 'Aktif' })).data,
    onMutate: (id: number) => {
      setReactivatingId(id);
      setToast(null);
    },
    onSuccess: () => {
      setToast({ text: 'Perubahan data berhasil', type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['pelanggaran-master'] });
    },
    onError: (mutationError: unknown) => {
      setToast({
        text: getErrorMessage(mutationError, 'Gagal mengaktifkan kembali master pelanggaran.'),
        type: 'error',
      });
    },
    onSettled: () => {
      setReactivatingId(null);
    },
  });

  const beginEdit = (category: ViolationCategory) => {
    setToast(null);
    setEditingId(category.kategori_pelanggaran_id);
    setEditingCategory(category);
    setForm({
      kode_pasal: category.kode_pasal,
      kategori: category.kategori,
      uraian_pelanggaran: category.uraian_pelanggaran,
      poin_maks: String(category.poin_maks),
      jenis: category.jenis,
    });

    // On narrow screens or if scrolled, guide focus to the form
    requestAnimationFrame(() => {
      if (window.innerWidth <= 1080) {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      kodePasalInputRef.current?.focus();
    });
  };

  const handleDeactivate = (category: ViolationCategory) => {
    if (
      window.confirm(
        `Nonaktifkan master pelanggaran "${category.kode_pasal} - ${category.uraian_pelanggaran}"? Master ini tidak akan muncul pada formulir pencatatan baru, namun dapat diaktifkan kembali sewaktu-waktu.`
      )
    ) {
      deactivate.mutate(category.kategori_pelanggaran_id);
    }
  };

  const handleReactivate = (category: ViolationCategory) => {
    if (
      window.confirm(
        `Aktifkan kembali master pelanggaran "${category.kode_pasal} - ${category.uraian_pelanggaran}"?`
      )
    ) {
      reactivate.mutate(category.kategori_pelanggaran_id);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate();
  };

  const handleReset = () => {
    setToast(null);
    resetForm();
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (!categories.data) return [];
    const q = searchQuery.trim().toLowerCase();
    return categories.data.filter(cat => {
      const matchSearch =
        !q ||
        cat.kode_pasal.toLowerCase().includes(q) ||
        cat.uraian_pelanggaran.toLowerCase().includes(q);
      const matchKategori = selectedKategori === 'Semua' || cat.kategori === selectedKategori;
      const matchJenis = selectedJenis === 'Semua' || cat.jenis === selectedJenis;
      const matchStatus = selectedStatus === 'Semua' || cat.status_aktif === selectedStatus;
      return matchSearch && matchKategori && matchJenis && matchStatus;
    });
  }, [categories.data, searchQuery, selectedKategori, selectedJenis, selectedStatus]);

  // Reset pagination when filters change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleKategoriChange = (val: 'Semua' | CategoryForm['kategori']) => {
    setSelectedKategori(val);
    setCurrentPage(1);
  };

  const handleJenisChange = (val: 'Semua' | CategoryForm['jenis']) => {
    setSelectedJenis(val);
    setCurrentPage(1);
  };

  const handleStatusChange = (val: 'Semua' | 'Aktif' | 'Tidak Aktif') => {
    setSelectedStatus(val);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedKategori('Semua');
    setSelectedJenis('Semua');
    setSelectedStatus('Aktif');
    setCurrentPage(1);
  };

  const isFilterActive =
    searchQuery !== '' ||
    selectedKategori !== 'Semua' ||
    selectedJenis !== 'Semua' ||
    selectedStatus !== 'Aktif';

  // Summary counts
  const totalCount = categories.data?.length ?? 0;
  const activeCount = categories.data?.filter(c => c.status_aktif === 'Aktif').length ?? 0;
  const filteredCount = filteredCategories.length;

  const categoryBreakdown = useMemo(() => {
    if (!categories.data) return { Ringan: 0, Sedang: 0, Berat: 0, Kewajiban: 0 };
    return categories.data.reduce(
      (acc, curr) => {
        if (curr.status_aktif === 'Aktif' && curr.kategori in acc) {
          acc[curr.kategori]++;
        }
        return acc;
      },
      { Ringan: 0, Sedang: 0, Berat: 0, Kewajiban: 0 } as Record<CategoryForm['kategori'], number>
    );
  }, [categories.data]);

  // Paginated records
  const effectivePageSize = pageSize === 'all' ? filteredCount : pageSize;
  const totalPages = effectivePageSize > 0 ? Math.ceil(filteredCount / effectivePageSize) : 1;

  const paginatedCategories = useMemo(() => {
    if (pageSize === 'all') return filteredCategories;
    const start = (currentPage - 1) * pageSize;
    return filteredCategories.slice(start, start + pageSize);
  }, [filteredCategories, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    requestAnimationFrame(() => {
      listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const isBusy = save.isPending || deactivate.isPending || reactivate.isPending;

  return (
    <section className="violation-master-page">
      {/* Toast Pojok Kanan Atas - BG Hitam, Font Putih, Ceklis */}
      {toast && (
        <div
          className={`toast-notification-top-right${toast.type === 'error' ? ' toast-error' : ''}`}
          role="status"
          aria-live="polite"
        >
          <div className="toast-notification-content">
            <span className="toast-icon-check" aria-hidden="true">
              {toast.type === 'error' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
            <span className="toast-text">{toast.text}</span>
          </div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Header bar with Submenu Navigation Links */}
      <header className="violation-master-header">
        <div className="violation-master-heading">
          <span className="violation-master-eyebrow">Kedisiplinan & Tata Tertib</span>
          <h1>Master Pelanggaran</h1>
          <p>
            Kelola referensi pasal, kategori pembobotan, dan poin sanksi. Memudahkan petugas keamanan dan admin memperbarui aturan tata tertib santri.
          </p>
        </div>

        {/* Submenu Quick Navigation */}
        <div className="violation-master-header-actions">
          <Link to="/pelanggaran/semua" className="violation-header-link-btn" title="Lihat semua rekam pelanggaran santri">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            <span>Daftar Pelanggaran</span>
          </Link>
          <Link to="/pelanggaran/baru" className="violation-header-link-btn primary" title="Input rekam pelanggaran baru untuk santri">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Input Pelanggaran</span>
          </Link>
        </div>

        {/* Quick stat counters */}
        <div className="violation-master-summary-chips" aria-label="Ringkasan kategori master aktif">
          <div className="violation-summary-stat-chip">
            <span className="violation-summary-stat-num">{activeCount}</span>
            <span className="violation-summary-stat-label">Master Aktif</span>
          </div>
          <div className="violation-summary-stat-chip">
            <span className="violation-summary-stat-num">{categoryBreakdown.Ringan}</span>
            <span className="violation-summary-stat-label">Ringan</span>
          </div>
          <div className="violation-summary-stat-chip">
            <span className="violation-summary-stat-num">{categoryBreakdown.Sedang}</span>
            <span className="violation-summary-stat-label">Sedang</span>
          </div>
          <div className="violation-summary-stat-chip">
            <span className="violation-summary-stat-num">{categoryBreakdown.Berat}</span>
            <span className="violation-summary-stat-label">Berat</span>
          </div>
          <div className="violation-summary-stat-chip">
            <span className="violation-summary-stat-num">{categoryBreakdown.Kewajiban}</span>
            <span className="violation-summary-stat-label">Kewajiban</span>
          </div>
        </div>
      </header>

      {/* Main 2-column layout: LIST ON LEFT, FORM ON RIGHT */}
      <div className="violation-master-layout">
        {/* Left Column: Search, Filter, Compact List & Pagination */}
        <section
          className="violation-master-panel violation-master-list-panel"
          aria-labelledby="violation-master-list-title"
        >
          <div ref={listTopRef} className="violation-master-list-top-anchor" />

          {/* List Toolbar (Search + Filters) */}
          <div className="violation-master-toolbar">
            <div className="violation-master-search-box">
              <span className="violation-master-search-icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </span>
              <input
                type="text"
                className="violation-master-search-input"
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Cari pasal atau uraian pelanggaran… (cth: rokok, pasal 12)"
                aria-label="Cari master pelanggaran"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="violation-master-search-clear"
                  onClick={() => handleSearchChange('')}
                  aria-label="Hapus pencarian"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              ) : null}
            </div>

            {/* Filter Pills / Dropdowns */}
            <div className="violation-master-filter-row">
              <div className="violation-master-filter-group">
                <span className="violation-filter-label">Kategori:</span>
                <div className="violation-filter-chips">
                  {(['Semua', ...kategoriOptions] as const).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`violation-filter-chip${selectedKategori === cat ? ' active' : ''}`}
                      onClick={() => handleKategoriChange(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="violation-master-filter-dropdowns">
                <div className="violation-select-wrapper">
                  <label htmlFor="filter-jenis" className="sr-only">Jenis</label>
                  <select
                    id="filter-jenis"
                    className="violation-filter-select"
                    value={selectedJenis}
                    onChange={e => handleJenisChange(e.target.value as any)}
                  >
                    <option value="Semua">Semua Jenis</option>
                    {jenisOptions.map(j => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="violation-select-wrapper">
                  <label htmlFor="filter-status" className="sr-only">Status</label>
                  <select
                    id="filter-status"
                    className="violation-filter-select"
                    value={selectedStatus}
                    onChange={e => handleStatusChange(e.target.value as any)}
                  >
                    <option value="Aktif">Status: Aktif</option>
                    <option value="Tidak Aktif">Status: Tidak Aktif</option>
                    <option value="Semua">Semua Status</option>
                  </select>
                </div>

                <div className="violation-select-wrapper">
                  <label htmlFor="filter-page-size" className="sr-only">Baris per halaman</label>
                  <select
                    id="filter-page-size"
                    className="violation-filter-select"
                    value={pageSize}
                    onChange={e => {
                      const val = e.target.value;
                      setPageSize(val === 'all' ? 'all' : Number(val));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={10}>10 per hal</option>
                    <option value={12}>12 per hal</option>
                    <option value={20}>20 per hal</option>
                    <option value="all">Semua</option>
                  </select>
                </div>

                {isFilterActive ? (
                  <button
                    type="button"
                    className="violation-reset-filter-btn"
                    onClick={handleResetFilters}
                    title="Reset semua filter"
                  >
                    Reset Filter
                  </button>
                ) : null}
              </div>
            </div>

            {/* Results counter & edit indicator */}
            <div className="violation-master-results-meta">
              <span className="violation-results-count">
                Menampilkan <strong>{filteredCount}</strong> dari {totalCount} total master
                {isFilterActive ? ' (terfilter)' : ''}
              </span>
              {editingId ? (
                <span className="violation-editing-indicator-chip">
                  <span className="violation-editing-dot" /> Sedang mengedit {editingCategory?.kode_pasal || `ID #${editingId}`}
                </span>
              ) : null}
            </div>
          </div>

          {/* Table / List View */}
          {categories.isLoading ? (
            <div className="violation-master-state-loading">
              <div className="violation-skeleton-row" />
              <div className="violation-skeleton-row" />
              <div className="violation-skeleton-row" />
            </div>
          ) : categories.isError ? (
            <div className="error-box violation-master-inline-feedback">
              <span>Daftar master belum dapat dimuat. Periksa koneksi lalu coba lagi.</span>
              <button type="button" className="secondary-button" onClick={() => void categories.refetch()}>
                Coba lagi
              </button>
            </div>
          ) : paginatedCategories.length > 0 ? (
            <div className="violation-master-table-wrap">
              <div className="violation-master-table">
                {paginatedCategories.map(category => {
                  const isBeingEdited = editingId === category.kategori_pelanggaran_id;
                  const isDeactivating = deactivatingId === category.kategori_pelanggaran_id;
                  const isReactivating = reactivatingId === category.kategori_pelanggaran_id;
                  const isInactive = category.status_aktif === 'Tidak Aktif';

                  return (
                    <article
                      key={category.kategori_pelanggaran_id}
                      className={`violation-master-item${isBeingEdited ? ' is-editing' : ''}${isInactive ? ' is-inactive' : ''}`}
                    >
                      <div className="violation-item-main">
                        <div className="violation-item-header">
                          <span className="violation-master-code">{category.kode_pasal}</span>
                          <span className={`violation-badge-kategori kat-${category.kategori.toLowerCase()}`}>
                            {category.kategori}
                          </span>
                          <span className="violation-badge-poin">{category.poin_maks} poin</span>
                          <span className="violation-badge-jenis">{category.jenis}</span>

                          {isInactive ? (
                            <span className="violation-badge-inactive">Tidak Aktif</span>
                          ) : null}

                          {isBeingEdited ? (
                            <span className="violation-badge-editing">Sedang Diedit</span>
                          ) : null}
                        </div>

                        <p className="violation-item-uraian">{category.uraian_pelanggaran}</p>
                      </div>

                      <div className="violation-item-actions">
                        {isBeingEdited ? (
                          <button
                            type="button"
                            className="violation-btn-cancel-edit"
                            onClick={handleReset}
                            title="Batal edit"
                          >
                            Batal
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="violation-btn-edit"
                            onClick={() => beginEdit(category)}
                            disabled={isBusy}
                            title={`Edit ${category.kode_pasal}`}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                            Edit
                          </button>
                        )}

                        {category.status_aktif === 'Aktif' && !isBeingEdited ? (
                          <button
                            type="button"
                            className="violation-btn-deactivate"
                            onClick={() => handleDeactivate(category)}
                            disabled={isBusy}
                            title={`Nonaktifkan ${category.kode_pasal}`}
                          >
                            {isDeactivating ? (
                              'Menonaktifkan…'
                            ) : (
                              <>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                Nonaktifkan
                              </>
                            )}
                          </button>
                        ) : null}

                        {isInactive && !isBeingEdited ? (
                          <button
                            type="button"
                            className="violation-btn-reactivate"
                            onClick={() => handleReactivate(category)}
                            disabled={isBusy}
                            title={`Aktifkan kembali ${category.kode_pasal}`}
                          >
                            {isReactivating ? (
                              'Mengaktifkan…'
                            ) : (
                              <>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                                Aktifkan
                              </>
                            )}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && pageSize !== 'all' ? (
                <div className="violation-pagination-container">
                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={currentPage <= 1}
                      onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    >
                      ← Sebelumnya
                    </button>
                    <div className="pagination-pages" aria-label="Pilih halaman daftar master pelanggaran">
                      {getPaginationItems(currentPage, totalPages).map((item, index) =>
                        item === 'ellipsis' ? (
                          <span className="pagination-ellipsis" key={`ellipsis-${index}`} aria-hidden="true">
                            …
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={`pagination-page${currentPage === item ? ' active' : ''}`}
                            aria-label={`Halaman ${item}`}
                            aria-current={currentPage === item ? 'page' : undefined}
                            onClick={() => handlePageChange(item)}
                          >
                            {item}
                          </button>
                        )
                      )}
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={currentPage >= totalPages}
                      onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    >
                      Berikutnya →
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="empty-state violation-master-empty">
              {isFilterActive ? (
                <div className="violation-empty-filter-content">
                  <p>Tidak ada master pelanggaran yang cocok dengan kriteria pencarian/filter.</p>
                  <button type="button" className="secondary-button" onClick={handleResetFilters}>
                    Bersihkan Filter
                  </button>
                </div>
              ) : (
                <p>Belum ada master pelanggaran. Tambahkan referensi pertama pada formulir di sebelah kanan.</p>
              )}
            </div>
          )}
        </section>

        {/* Right Column: Form (Sticky & Compact) */}
        <form
          ref={formRef}
          className={`violation-master-panel violation-master-form${editingId ? ' is-editing-mode' : ''}`}
          onSubmit={handleSubmit}
        >
          {/* Edit status alert badge */}
          {editingId ? (
            <div className="violation-master-edit-banner" role="status">
              <div className="violation-master-edit-banner-info">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                <span>
                  Mengedit: <strong>{editingCategory?.kode_pasal || `ID #${editingId}`}</strong>
                </span>
              </div>
              <button
                type="button"
                className="violation-master-edit-cancel-btn"
                onClick={handleReset}
                title="Batal edit dan kembali ke mode tambah baru"
              >
                Batal
              </button>
            </div>
          ) : null}

          <div className="violation-master-panel-heading">
            <div>
              <h2>{editingId ? 'Edit Master Pelanggaran' : 'Tambah Master Baru'}</h2>
              <p>
                {editingId
                  ? 'Perubahan pasal/poin hanya berlaku untuk input pelanggaran berikutnya.'
                  : 'Isi referensi pasal yang akan tersedia pada formulir pelanggaran.'}
              </p>
            </div>
          </div>

          <div className="violation-master-field">
            <label htmlFor="violation-master-kode">Kode pasal</label>
            <input
              id="violation-master-kode"
              ref={kodePasalInputRef}
              value={form.kode_pasal}
              onChange={event => setForm({ ...form, kode_pasal: event.target.value })}
              required
              placeholder="Contoh: Pasal 9 ayat 7"
              autoComplete="off"
            />
          </div>

          <div className="violation-master-field">
            <label htmlFor="violation-master-uraian">Uraian pelanggaran</label>
            <textarea
              id="violation-master-uraian"
              value={form.uraian_pelanggaran}
              onChange={event => setForm({ ...form, uraian_pelanggaran: event.target.value })}
              required
              rows={3}
              placeholder="Tulis uraian pelanggaran atau kewajiban secara singkat dan jelas."
            />
          </div>

          <div className="violation-master-field-grid">
            <div className="violation-master-field">
              <label htmlFor="violation-master-kategori">Kategori</label>
              <select
                id="violation-master-kategori"
                value={form.kategori}
                onChange={event => setForm({ ...form, kategori: event.target.value as CategoryForm['kategori'] })}
              >
                {kategoriOptions.map(item => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="violation-master-field">
              <label htmlFor="violation-master-poin">Poin sanksi</label>
              <input
                id="violation-master-poin"
                type="number"
                min="1"
                max="100"
                value={form.poin_maks}
                onChange={event => setForm({ ...form, poin_maks: event.target.value })}
                required
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="violation-master-field">
            <label htmlFor="violation-master-jenis">Jenis pelanggaran</label>
            <select
              id="violation-master-jenis"
              value={form.jenis}
              onChange={event => setForm({ ...form, jenis: event.target.value as CategoryForm['jenis'] })}
            >
              {jenisOptions.map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="violation-master-form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handleReset}
              disabled={save.isPending}
            >
              {editingId ? 'Batalkan edit' : 'Bersihkan'}
            </button>
            <button type="submit" className="primary-button" disabled={isBusy}>
              {save.isPending ? (
                'Menyimpan…'
              ) : editingId ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Simpan Perubahan
                </>
              ) : (
                'Tambah Master'
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}


