import { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { usePageMeta } from '../hooks/usePageMeta';

interface PrestasiRecord {
  prestasi_id: number;
  santri_id: number;
  nama_santri: string;
  nis: string | null;
  nama_prestasi: string;
  peringkat?: string | null;
  tingkat?: string | null;
  tanggal: string;
  keterangan?: string | null;
}

interface SantriOption {
  santri_id: number;
  nama: string;
  nis: string | null;
  nama_kamar?: string | null;
  nama_unit?: string | null;
}

function getRankBadgeClass(rank?: string | null): string {
  const r = (rank || '').toLowerCase();
  if (r.includes('juara 1') || r.includes('emas')) return 'prestasi-rank rank-1';
  if (r.includes('juara 2') || r.includes('perak')) return 'prestasi-rank rank-2';
  if (r.includes('juara 3') || r.includes('perunggu')) return 'prestasi-rank rank-3';
  if (r.includes('final') || r.includes('semifinal') || r.includes('lolos')) return 'prestasi-rank rank-qualifier';
  if (r.includes('delegasi')) return 'prestasi-rank rank-delegasi';
  return 'prestasi-rank rank-default';
}

function getLevelBadgeClass(level?: string | null): string {
  const l = (level || '').toLowerCase();
  if (l.includes('nasional')) return 'prestasi-level level-nasional';
  if (l.includes('provinsi')) return 'prestasi-level level-provinsi';
  if (l.includes('kabupaten')) return 'prestasi-level level-kabupaten';
  if (l.includes('kecamatan')) return 'prestasi-level level-kecamatan';
  return 'prestasi-level level-pesantren';
}

export function PrestasiListPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [prestasiList, setPrestasiList] = useState<PrestasiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const selectedSantriId = searchParams.get('santri_id');

  // Input Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Form Fields
  const [santriSearchTerm, setSantriSearchTerm] = useState('');
  const [santriSearchResults, setSantriSearchResults] = useState<SantriOption[]>([]);
  const [selectedSantri, setSelectedSantri] = useState<SantriOption | null>(null);
  const [isSearchingSantri, setIsSearchingSantri] = useState(false);
  const [showSantriDropdown, setShowSantriDropdown] = useState(false);
  const santriDropdownRef = useRef<HTMLDivElement>(null);

  const [namaPrestasi, setNamaPrestasi] = useState('');
  const [peringkat, setPeringkat] = useState('');
  const [tingkat, setTingkat] = useState('Pesantren');
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [keterangan, setKeterangan] = useState('');

  // Delete State
  const [deletingId, setDeletingId] = useState<number | null>(null);

  usePageMeta({
    title: 'Daftar Prestasi Santri',
    description: 'Daftar prestasi dan penghargaan santri Pondok Pesantren Tebuireng.',
  });

  const fetchPrestasi = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/prestasi', {
        params: selectedSantriId ? { santri_id: selectedSantriId } : undefined,
      });
      setPrestasiList(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat data prestasi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrestasi();
  }, [selectedSantriId]);

  // Santri search debounced effect
  useEffect(() => {
    if (santriSearchTerm.trim().length >= 2 && (!selectedSantri || santriSearchTerm !== selectedSantri.nama)) {
      const delayDebounceFn = setTimeout(() => {
        setIsSearchingSantri(true);
        api.get(`/api/santri?q=${encodeURIComponent(santriSearchTerm.trim())}`)
          .then(res => {
            setSantriSearchResults(res.data);
            setShowSantriDropdown(true);
          })
          .catch(console.error)
          .finally(() => setIsSearchingSantri(false));
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setShowSantriDropdown(false);
    }
  }, [santriSearchTerm, selectedSantri]);

  // Click outside to close santri dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (santriDropdownRef.current && !santriDropdownRef.current.contains(event.target as Node)) {
        setShowSantriDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPrestasi = useMemo(() => {
    const query = search.trim().toLowerCase();
    return prestasiList.filter(item => {
      const matchesSearch = !query || [item.nama_santri, item.nama_prestasi, item.keterangan ?? '', item.peringkat ?? '', item.tingkat ?? '']
        .some(value => value.toLowerCase().includes(query));
      const matchesStart = !startDate || item.tanggal >= startDate;
      const matchesEnd = !endDate || item.tanggal <= endDate;
      return matchesSearch && matchesStart && matchesEnd;
    });
  }, [prestasiList, search, startDate, endDate]);

  const handleResetForm = () => {
    setFormError('');
    setSelectedSantri(null);
    setSantriSearchTerm('');
    setNamaPrestasi('');
    setPeringkat('');
    setTingkat('Pesantren');
    setTanggal(new Date().toISOString().split('T')[0]);
    setKeterangan('');
  };

  const handleSelectSantri = (santri: SantriOption) => {
    setSelectedSantri(santri);
    setSantriSearchTerm(santri.nama);
    setShowSantriDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedSantri) {
      setFormError('Pilih santri terlebih dahulu.');
      return;
    }
    const cleanNama = namaPrestasi.trim();
    if (!cleanNama) {
      setFormError('Nama / judul prestasi wajib diisi.');
      return;
    }
    if (cleanNama.length < 3) {
      setFormError('Nama / judul prestasi minimal 3 karakter.');
      return;
    }
    if (!tanggal) {
      setFormError('Tanggal kejadian / perlombaan wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/prestasi', {
        santri_id: selectedSantri.santri_id,
        nama_prestasi: cleanNama,
        peringkat: peringkat.trim() || null,
        tingkat: tingkat.trim() || null,
        tanggal,
        keterangan: keterangan.trim() || null,
      });

      handleResetForm();
      setToast({ text: 'Data prestasi santri berhasil disimpan.', type: 'success' });
      await fetchPrestasi();
    } catch (err: any) {
      const responseData = err.response?.data;
      if (responseData?.errors) {
        const errorMessages = Object.values(responseData.errors).flat().join(' ');
        setFormError(errorMessages || responseData.message || 'Gagal menyimpan data prestasi.');
      } else {
        setFormError(responseData?.message || 'Gagal menyimpan data prestasi.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus data prestasi ini?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/prestasi/${id}`);
      setPrestasiList(prev => prev.filter(item => item.prestasi_id !== id));
      setToast({ text: 'Data prestasi berhasil dihapus.', type: 'success' });
    } catch (err: any) {
      setToast({ text: err.response?.data?.message || 'Gagal menghapus data prestasi.', type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const canManage = user?.jabatan === 'Admin';

  if (loading) return <PageSkeleton />;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div className="pelanggaran-list-page">
      {/* Toast Notifikasi Pojok Kanan Atas */}
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

      <header className="absensi-module-hero">
        <div className="absensi-module-hero-main">
          <span className="page-eyebrow" style={{ color: 'rgba(255, 255, 255, 0.85)', marginBottom: 4, display: 'inline-block' }}>REKAP SANTRI</span>
          <h1 className="absensi-module-hero-title">Daftar Prestasi Santri</h1>
          <p className="absensi-module-hero-desc">
            Rekam prestasi, kejuaraan, dan penghargaan santri Pondok Pesantren Tebuireng.
          </p>
          <div className="absensi-module-hero-meta">
            <span className="absensi-module-pill absensi-module-pill-petugas">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Petugas: {user?.nama || 'Petugas'}
            </span>
            <span className="absensi-module-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="7"/>
                <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
              </svg>
              {filteredPrestasi.length} Rekam Prestasi
            </span>
            <span className="absensi-module-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              T.A. 2026/2027
            </span>
            {selectedSantriId && (
              <span className="absensi-module-pill" style={{ background: 'rgba(245, 158, 11, 0.25)', borderColor: 'rgba(245, 158, 11, 0.45)', color: '#fef3c7' }}>
                Filter Santri ID: #{selectedSantriId}
                <Link to="/prestasi/semua" style={{ marginLeft: 6, color: '#fff', textDecoration: 'none', fontWeight: 800 }} title="Hapus filter santri">
                  ✕
                </Link>
              </span>
            )}
          </div>
        </div>
        <div className="dashboard-mosque-dark" aria-hidden="true"></div>
      </header>

      {/* Container Input Prestasi Langsung di Atas Tabel */}
      {canManage && (
        <section className="prestasi-form-card" aria-labelledby="form-input-prestasi-title">
          <div className="prestasi-form-header">
            <div className="prestasi-form-title-group">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="7"/>
                <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
              </svg>
              <div>
                <h2 id="form-input-prestasi-title">Input Rekam Prestasi Santri</h2>
                <p>Form pencatatan prestasi, kejuaraan, atau penghargaan santri.</p>
              </div>
            </div>
            {selectedSantri && (
              <div className="prestasi-selected-santri-badge">
                <span>Santri: <strong>{selectedSantri.nama}</strong> ({selectedSantri.nis || 'Tanpa NIS'})</span>
                <button type="button" onClick={() => { setSelectedSantri(null); setSantriSearchTerm(''); }} title="Ganti santri">✕</button>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="prestasi-form-grid">
              {/* Cari Santri Autocomplete */}
              <div className="prestasi-form-group" style={{ position: 'relative' }} ref={santriDropdownRef}>
                <label htmlFor="input-santri-search">Cari Santri (Nama / NIS) *</label>
                <input
                  id="input-santri-search"
                  type="text"
                  placeholder="Ketik nama atau NIS santri..."
                  value={santriSearchTerm}
                  onChange={e => {
                    setSantriSearchTerm(e.target.value);
                    if (selectedSantri) setSelectedSantri(null);
                  }}
                  style={{
                    backgroundColor: selectedSantri ? '#f0fdf4' : '#fff',
                    fontWeight: selectedSantri ? 600 : 'normal',
                  }}
                />
                {isSearchingSantri && <small style={{ color: 'var(--tinta-muda)', fontSize: '11px', marginTop: 2 }}>Mencari santri...</small>}

                {showSantriDropdown && santriSearchResults.length > 0 && (
                  <div className="santri-autocomplete-dropdown">
                    {santriSearchResults.map(s => (
                      <button
                        key={s.santri_id}
                        type="button"
                        onClick={() => handleSelectSantri(s)}
                        className="santri-autocomplete-item"
                      >
                        <strong>{s.nama}</strong>
                        <small>NIS: {s.nis || '-'} &bull; {s.nama_kamar || 'Kamar -'}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Nama / Judul Prestasi */}
              <div className="prestasi-form-group">
                <label htmlFor="input-nama-prestasi">Nama / Judul Prestasi atau Kejuaraan *</label>
                <input
                  id="input-nama-prestasi"
                  type="text"
                  maxLength={255}
                  placeholder="Misal: Juara 1 Lomba MQK Tingkat Kabupaten"
                  value={namaPrestasi}
                  onChange={e => setNamaPrestasi(e.target.value)}
                  required
                />
              </div>

              {/* Peringkat */}
              <div className="prestasi-form-group">
                <label htmlFor="input-peringkat">Peringkat / Penghargaan</label>
                <input
                  id="input-peringkat"
                  type="text"
                  maxLength={100}
                  placeholder="Misal: Juara 1 / Medali Emas / Delegasi"
                  value={peringkat}
                  onChange={e => setPeringkat(e.target.value)}
                />
              </div>

              {/* Tingkat */}
              <div className="prestasi-form-group">
                <label htmlFor="input-tingkat">Tingkat Perlombaan</label>
                <select
                  id="input-tingkat"
                  value={tingkat}
                  onChange={e => setTingkat(e.target.value)}
                >
                  <option value="Pesantren">Pesantren / Internal</option>
                  <option value="Kecamatan">Kecamatan</option>
                  <option value="Kabupaten">Kabupaten / Kota</option>
                  <option value="Provinsi">Provinsi</option>
                  <option value="Nasional">Nasional</option>
                  <option value="Internasional">Internasional</option>
                </select>
              </div>

              {/* Tanggal */}
              <div className="prestasi-form-group">
                <label htmlFor="input-tanggal-prestasi">Tanggal Kejadian / Perlombaan *</label>
                <input
                  id="input-tanggal-prestasi"
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  value={tanggal}
                  onChange={e => setTanggal(e.target.value)}
                  required
                />
              </div>

              {/* Keterangan */}
              <div className="prestasi-form-group">
                <label htmlFor="input-keterangan-prestasi">Catatan / Keterangan Tambahan</label>
                <input
                  id="input-keterangan-prestasi"
                  type="text"
                  maxLength={2000}
                  placeholder="Catatan ajang atau penyelenggara..."
                  value={keterangan}
                  onChange={e => setKeterangan(e.target.value)}
                />
              </div>
            </div>

            {formError && <div className="error-box" style={{ marginBottom: 12, padding: '8px 12px', fontSize: '12px' }}>{formError}</div>}

            <div className="prestasi-form-footer">
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>* Kolom bertanda bintang wajib diisi</span>
              <div className="prestasi-form-buttons">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleResetForm}
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Data Prestasi'}</span>
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      <section className="master-section" aria-labelledby="prestasi-table-title">
        <h2 id="prestasi-table-title" className="sr-only">Daftar prestasi santri</h2>
        <div className="account-table-controls">
          <div className="account-search-control">
            <label htmlFor="search-prestasi">Pencarian Prestasi</label>
            <input
              id="search-prestasi"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Cari nama santri, lomba, kejuaraan..."
            />
          </div>
          <div>
            <label htmlFor="filter-dari-prestasi">Dari Tanggal</label>
            <input type="date" id="filter-dari-prestasi" value={startDate} onChange={event => setStartDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="filter-sampai-prestasi">Sampai Tanggal</label>
            <input type="date" id="filter-sampai-prestasi" value={endDate} onChange={event => setEndDate(event.target.value)} />
          </div>
        </div>

        <p className="account-result-count">
          Menampilkan {filteredPrestasi.length} dari {prestasiList.length} rekam prestasi santri.
        </p>

        <div className="table-scroll prestasi-table-scroll">
          <table className="master-table prestasi-table">
            <thead>
              <tr>
                <th className="col-no">No</th>
                <th>Tanggal</th>
                <th>Nama Santri</th>
                <th>Judul Prestasi / Kejuaraan</th>
                <th>Peringkat / Penghargaan</th>
                <th>Tingkat</th>
                <th>Keterangan</th>
                {canManage && <th style={{ textAlign: 'center' }}>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {filteredPrestasi.map((item, index) => (
                <tr key={item.prestasi_id}>
                  <td data-label="No" className="col-no">{index + 1}</td>
                  <td data-label="Tanggal">
                    <span className="prestasi-date-badge">{item.tanggal}</span>
                  </td>
                  <td data-label="Nama Santri">
                    <strong className="prestasi-santri-name">{item.nama_santri}</strong>
                  </td>
                  <td data-label="Prestasi">
                    <strong className="prestasi-title">{item.nama_prestasi}</strong>
                  </td>
                  <td data-label="Peringkat / Penghargaan">
                    <span className={getRankBadgeClass(item.peringkat)}>{item.peringkat || 'Penghargaan'}</span>
                  </td>
                  <td data-label="Tingkat">
                    <span className={getLevelBadgeClass(item.tingkat)}>{item.tingkat || 'Pesantren'}</span>
                  </td>
                  <td data-label="Keterangan" style={{ color: '#475569', fontSize: '12.5px' }}>
                    {item.keterangan || '—'}
                  </td>
                  {canManage && (
                    <td data-label="Aksi" style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn-prestasi-delete"
                        onClick={() => handleDelete(item.prestasi_id)}
                        disabled={deletingId === item.prestasi_id}
                        title="Hapus data prestasi ini"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        <span>{deletingId === item.prestasi_id ? '...' : 'Hapus'}</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPrestasi.length === 0 && (
            <div className="empty-state">Belum ada data prestasi yang sesuai dengan pencarian.</div>
          )}
        </div>
      </section>
    </div>
  );
}

export default PrestasiListPage;
