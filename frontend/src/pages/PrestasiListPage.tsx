import { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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

  // Modal Input Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

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

  const handleOpenModal = () => {
    setIsModalOpen(true);
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
    if (!namaPrestasi.trim()) {
      setFormError('Nama / judul prestasi wajib diisi.');
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
        nama_prestasi: namaPrestasi.trim(),
        peringkat: peringkat.trim() || null,
        tingkat: tingkat.trim() || null,
        tanggal,
        keterangan: keterangan.trim() || null,
      });

      setIsModalOpen(false);
      await fetchPrestasi();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Gagal menyimpan data prestasi.');
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
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menghapus data prestasi.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCsv = () => {
    if (filteredPrestasi.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }
    const headers = ['No', 'Tanggal', 'NIS', 'Nama Santri', 'Nama Prestasi', 'Peringkat', 'Tingkat', 'Keterangan'];
    const rows = filteredPrestasi.map((item, idx) => [
      idx + 1,
      item.tanggal,
      item.nis || '',
      `"${(item.nama_santri || '').replace(/"/g, '""')}"`,
      `"${(item.nama_prestasi || '').replace(/"/g, '""')}"`,
      `"${(item.peringkat || '').replace(/"/g, '""')}"`,
      `"${(item.tingkat || '').replace(/"/g, '""')}"`,
      `"${(item.keterangan || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap-prestasi-santri-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const canManage = user && ['Admin', 'Keamanan', 'Pembina Kamar', 'Pengasuh'].includes(user.jabatan);

  if (loading) return <PageSkeleton />;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div className="pelanggaran-list-page">
      <header className="dashboard-header" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span className="page-eyebrow">Rekap Santri</span>
          <h1>Daftar Prestasi Santri</h1>
          <p>Rekam prestasi, kejuaraan, dan penghargaan santri Pondok Pesantren Tebuireng.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {canManage && (
            <button
              type="button"
              className="primary-button"
              onClick={handleOpenModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              + Tambah Prestasi
            </button>
          )}
        </div>
      </header>

      {/* Modal Input Prestasi */}
      {isModalOpen && (
        <div className="save-modal-backdrop" role="presentation" style={{ zIndex: 9999 }}>
          <div aria-modal="true" className="save-modal" role="dialog" style={{ maxWidth: '540px', width: '90%', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Input Data Prestasi Santri</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--tinta-muda)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Santri Autocomplete */}
              <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }} ref={santriDropdownRef}>
                <label htmlFor="modal-santri-search" style={{ fontWeight: 600, fontSize: '13px', marginBottom: 4 }}>
                  Cari Santri (Nama / NIS) *
                </label>
                <input
                  id="modal-santri-search"
                  type="text"
                  placeholder="Ketik nama atau NIS santri..."
                  value={santriSearchTerm}
                  onChange={e => {
                    setSantriSearchTerm(e.target.value);
                    if (selectedSantri) setSelectedSantri(null);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--garis)',
                    backgroundColor: selectedSantri ? '#F0FDF4' : '#fff',
                    fontWeight: selectedSantri ? 600 : 'normal',
                  }}
                />
                {isSearchingSantri && <small style={{ color: 'var(--tinta-muda)', fontSize: '11px', marginTop: 2 }}>Sedang mencari santri...</small>}

                {showSantriDropdown && santriSearchResults.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: '#fff',
                      border: '1px solid var(--garis)',
                      borderRadius: '6px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 100,
                    }}
                  >
                    {santriSearchResults.map(s => (
                      <button
                        key={s.santri_id}
                        type="button"
                        onClick={() => handleSelectSantri(s)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 12px',
                          border: 'none',
                          borderBottom: '1px solid #f0f0f0',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <strong style={{ fontSize: '13px' }}>{s.nama}</strong>
                        <span style={{ fontSize: '11px', color: '#666' }}>NIS: {s.nis || '-'} &bull; {s.nama_kamar || 'Kamar -'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Nama / Judul Prestasi */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label htmlFor="modal-nama-prestasi" style={{ fontWeight: 600, fontSize: '13px', marginBottom: 4 }}>
                  Nama / Judul Kejuaraan atau Prestasi *
                </label>
                <input
                  id="modal-nama-prestasi"
                  type="text"
                  placeholder="Misal: Juara 1 Lomba MQK Tingkat Kabupaten"
                  value={namaPrestasi}
                  onChange={e => setNamaPrestasi(e.target.value)}
                  required
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--garis)' }}
                />
              </div>

              {/* Peringkat & Tingkat */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column' }}>
                  <label htmlFor="modal-peringkat" style={{ fontWeight: 600, fontSize: '13px', marginBottom: 4 }}>
                    Peringkat / Penghargaan
                  </label>
                  <input
                    id="modal-peringkat"
                    type="text"
                    placeholder="Juara 1 / Medali Emas / Best Speaker"
                    value={peringkat}
                    onChange={e => setPeringkat(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--garis)' }}
                  />
                </div>
                <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column' }}>
                  <label htmlFor="modal-tingkat" style={{ fontWeight: 600, fontSize: '13px', marginBottom: 4 }}>
                    Tingkat Perlombaan
                  </label>
                  <select
                    id="modal-tingkat"
                    value={tingkat}
                    onChange={e => setTingkat(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--garis)', backgroundColor: '#fff' }}
                  >
                    <option value="Pesantren">Pesantren / Internal</option>
                    <option value="Kabupaten">Kabupaten / Kota</option>
                    <option value="Provinsi">Provinsi</option>
                    <option value="Nasional">Nasional</option>
                    <option value="Internasional">Internasional</option>
                  </select>
                </div>
              </div>

              {/* Tanggal */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label htmlFor="modal-tanggal-prestasi" style={{ fontWeight: 600, fontSize: '13px', marginBottom: 4 }}>
                  Tanggal Kejadian / Perlombaan *
                </label>
                <input
                  id="modal-tanggal-prestasi"
                  type="date"
                  value={tanggal}
                  onChange={e => setTanggal(e.target.value)}
                  required
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--garis)' }}
                />
              </div>

              {/* Keterangan */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label htmlFor="modal-keterangan-prestasi" style={{ fontWeight: 600, fontSize: '13px', marginBottom: 4 }}>
                  Catatan / Keterangan Tambahan
                </label>
                <textarea
                  id="modal-keterangan-prestasi"
                  placeholder="Catatan tambahan mengenai prestasi..."
                  value={keterangan}
                  onChange={e => setKeterangan(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--garis)', minHeight: '60px' }}
                />
              </div>

              {formError && <div className="error-box" style={{ padding: '8px 12px', fontSize: '12px' }}>{formError}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Data Prestasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
                <th>No</th>
                <th>Tanggal</th>
                <th>Nama Santri</th>
                <th>Judul Prestasi / Kejuaraan</th>
                <th>Peringkat / Penghargaan</th>
                <th>Tingkat</th>
                <th>Keterangan</th>
                {canManage && <th>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {filteredPrestasi.map((item, index) => (
                <tr key={item.prestasi_id}>
                  <td data-label="No">{index + 1}</td>
                  <td data-label="Tanggal"><strong>{item.tanggal}</strong></td>
                  <td data-label="Nama Santri"><strong>{item.nama_santri}</strong></td>
                  <td data-label="Prestasi"><strong className="prestasi-title">{item.nama_prestasi}</strong></td>
                  <td data-label="Peringkat / Penghargaan">
                    <span className="prestasi-rank">{item.peringkat || 'Juara'}</span>
                  </td>
                  <td data-label="Tingkat">{item.tingkat || 'Tebuireng'}</td>
                  <td data-label="Keterangan">{item.keterangan || '—'}</td>
                  {canManage && (
                    <td data-label="Aksi">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.prestasi_id)}
                        disabled={deletingId === item.prestasi_id}
                        style={{
                          backgroundColor: '#EF4444',
                          color: '#fff',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        {deletingId === item.prestasi_id ? '...' : 'Hapus'}
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
