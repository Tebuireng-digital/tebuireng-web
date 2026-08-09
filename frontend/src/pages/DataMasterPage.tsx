import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { usePageMeta } from '../hooks/usePageMeta';

interface Petugas { petugas_id: number; nama: string; username: string; jabatan: string; status_aktif: boolean; tanggung_jawab_absensi: string }
interface Opsi { jenis: string; nama: string; targets: Array<{ target_id: number; nama_target: string }> }
interface Penugasan { penugasan_id: number; nama_petugas: string; jabatan: string; tipe_target: string; nama_target: string }
interface Kamar { kamar_id: number; nama: string }
interface ImportReview {
  review_id: number; sumber_sheet: string; baris_sumber: number; nama_sumber: string; kode_kamar_sumber?: string;
  data_tambahan?: string; santri_otomatis_id?: number; nama_santri_otomatis?: string; kamar_santri_otomatis?: string;
  kandidat_santri_id?: number; nama_kandidat?: string; kamar_kandidat?: string; skor_kemiripan?: number; status: string;
}
interface KamarMapping { kode_sumber: string; jumlah_review: number; kamar_id?: number; nama_kamar?: string }
interface SantriMaster {
  santri_id: number;
  nis: string | null;
  nama: string;
  unit_id: number;
  kode_unit?: string;
  nama_unit?: string;
  kamar_id?: number | null;
  nama_kamar?: string | null;
  nama_kelas_formal?: string | null;
  nama_wali?: string | null;
  no_hp_wali?: string | null;
  status_aktif: boolean;
  catatan_import?: string | null;
}
interface AlumniRecord {
  alumni_id: number;
  no_id_induk: string | null;
  nama: string;
  jenis_kelamin: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  orang_tua: string | null;
  jenjang: string | null;
  kelas: string | null;
  no_hp: string | null;
  saldo_spp: string | null;
  nominal_saldo: number;
  alamat: string | null;
  wilayah: string | null;
  provinsi: string | null;
  angkatan: string | null;
  tahun_lulus: string | null;
}
interface AlumniStats {
  total: number;
  by_jenjang: { jenjang: string; jumlah: number }[];
  by_jenis_kelamin: { jenis_kelamin: string; jumlah: number }[];
}

type MasterTab = 'santri' | 'penugasan' | 'review' | 'kamar' | 'akun' | 'alumni';
type AccountSortKey = 'nama' | 'username' | 'jabatan' | 'tanggung_jawab_absensi';
type PaginationItem = number | 'ellipsis';

const getPaginationItems = (current: number, total: number): PaginationItem[] => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, 6, 'ellipsis', total];
  if (current >= total - 3) return [1, 'ellipsis', total - 5, total - 4, total - 3, total - 2, total - 1, total];
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
};

const roleForJenis: Record<string, string> = {
  sekolah: 'Wali Kelas', kamar: 'Pembina Kamar', pbs: 'Ustadz', diniyah: 'Ustadz', pbm: 'Ustadz',
};

const UNIT_LIST = [
  { id: 1, kode: 'MTS', nama: 'MTs Salafiyah Syafi\'iyah' },
  { id: 2, kode: 'SMP', nama: 'SMP A. Wahid Hasyim' },
  { id: 3, kode: 'SMA', nama: 'SMA A. Wahid Hasyim' },
  { id: 4, kode: 'SMK', nama: 'SMK Khoiriyah Hasyim' },
  { id: 5, kode: 'MA', nama: 'MA Salafiyah Syafi\'iyah' },
];

export function DataMasterPage() {
  const { tab } = useParams<{ tab?: string }>();
  const [petugas, setPetugas] = useState<Petugas[]>([]);
  const [opsi, setOpsi] = useState<Opsi[]>([]);
  const [penugasan, setPenugasan] = useState<Penugasan[]>([]);
  const [kamar, setKamar] = useState<Kamar[]>([]);
  const [santriList, setSantriList] = useState<SantriMaster[]>([]);
  const [reviews, setReviews] = useState<ImportReview[]>([]);
  const [mappings, setMappings] = useState<KamarMapping[]>([]);
  const [jenis, setJenis] = useState('sekolah');
  const [petugasId, setPetugasId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [passwordBaru, setPasswordBaru] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [santriLoading, setSantriLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('perlu_tinjau');
  const [mappingChoices, setMappingChoices] = useState<Record<string, string>>({});
  const [namaKamarBaru, setNamaKamarBaru] = useState('');
  const [kodeKamarBaru, setKodeKamarBaru] = useState('');

  // Santri Tab Filter & State
  const [santriSearch, setSantriSearch] = useState('');
  const [santriUnitFilter, setSantriUnitFilter] = useState('');
  const [santriKamarFilter, setSantriKamarFilter] = useState('');
  const [santriPage, setSantriPage] = useState(1);
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [showSantriModal, setShowSantriModal] = useState(false);
  const [editingSantri, setEditingSantri] = useState<Partial<SantriMaster>>({
    santri_id: 0,
    nis: '',
    nama: '',
    unit_id: 1,
    kamar_id: null,
    nama_wali: '',
    no_hp_wali: '',
  });

  // Account Tab State
  const [accountSearch, setAccountSearch] = useState('');
  const [accountRole, setAccountRole] = useState('');
  const [accountStatus, setAccountStatus] = useState('');
  const [accountAssignment, setAccountAssignment] = useState('');
  const [accountSort, setAccountSort] = useState<AccountSortKey>('nama');
  const [accountSortDirection, setAccountSortDirection] = useState<'asc' | 'desc'>('asc');

  // Alumni Tab State
  const [alumniList, setAlumniList] = useState<AlumniRecord[]>([]);
  const [alumniStats, setAlumniStats] = useState<AlumniStats>({ total: 0, by_jenjang: [], by_jenis_kelamin: [] });
  const [alumniSearch, setAlumniSearch] = useState('');
  const [alumniJenjangFilter, setAlumniJenjangFilter] = useState('');
  const [alumniJkFilter, setAlumniJkFilter] = useState('');
  const [alumniPage, setAlumniPage] = useState(1);
  const [alumniLoading, setAlumniLoading] = useState(false);

  const activeTab: MasterTab = ['santri', 'penugasan', 'review', 'kamar', 'akun', 'alumni'].includes(tab ?? '')
    ? (tab as MasterTab)
    : 'santri';

  const tabTitles: Record<MasterTab, string> = {
    santri: 'Data Santri',
    penugasan: 'Penugasan Absensi',
    review: 'Review Hasil Impor',
    kamar: 'Kamar & Pemetaan',
    akun: 'Akun Petugas',
    alumni: 'Data Alumni',
  };

  usePageMeta({
    title: `${tabTitles[activeTab]} - Data Master`,
    description: `Kelola ${tabTitles[activeTab].toLowerCase()} dan konfigurasi operasional Pondok Pesantren Tebuireng.`,
  });

  const fetchData = async () => {
    const [petugasResponse, opsiResponse, penugasanResponse, kamarResponse, santriResponse] = await Promise.all([
      api.get('/api/master/petugas'),
      api.get('/api/absensi-options'),
      api.get('/api/master/penugasan'),
      api.get('/api/master/kamar'),
      api.get('/api/master/santri'),
    ]);
    setPetugas(petugasResponse.data);
    setOpsi(opsiResponse.data);
    setPenugasan(penugasanResponse.data);
    setKamar(kamarResponse.data);
    setSantriList(santriResponse.data);
  };

  const fetchReviews = async () => {
    const [reviewsResponse, mappingsResponse] = await Promise.all([
      api.get('/api/master/import-reviews', { params: reviewStatus ? { status: reviewStatus } : {} }),
      api.get('/api/master/kamar-mappings'),
    ]);
    setReviews(reviewsResponse.data);
    setMappings(mappingsResponse.data);
  };

  const fetchAlumni = async () => {
    setAlumniLoading(true);
    try {
      const params: Record<string, string> = {};
      if (alumniSearch.trim()) params.q = alumniSearch.trim();
      if (alumniJenjangFilter) params.jenjang = alumniJenjangFilter;
      if (alumniJkFilter) params.jenis_kelamin = alumniJkFilter;
      const [listRes, statsRes] = await Promise.all([
        api.get('/api/master/alumni', { params }),
        api.get('/api/master/alumni/stats'),
      ]);
      setAlumniList(listRes.data);
      setAlumniStats(statsRes.data);
    } catch {
      setMessage('Data alumni gagal dimuat.');
    } finally {
      setAlumniLoading(false);
    }
  };

  useEffect(() => {
    fetchData().catch(() => setMessage('Data master gagal dimuat.')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchReviews().catch(() => {
      setReviews([]); setMappings([]);
    });
  }, [reviewStatus]);

  // Fetch alumni when tab is alumni or filter changes
  useEffect(() => {
    if (activeTab === 'alumni') {
      const timer = window.setTimeout(() => { fetchAlumni(); }, 300);
      return () => window.clearTimeout(timer);
    }
  }, [activeTab, alumniSearch, alumniJenjangFilter, alumniJkFilter]);

  // Reset alumni pagination on filter change
  useEffect(() => {
    setAlumniPage(1);
  }, [alumniSearch, alumniJenjangFilter, alumniJkFilter]);

  // Santri Tab Computations
  const filteredSantri = useMemo(() => {
    const search = santriSearch.trim().toLowerCase();
    return santriList.filter(item => {
      const matchSearch = !search || [item.nama, item.nis ?? '', item.nama_wali ?? '', item.nama_kamar ?? '', item.kode_unit ?? '']
        .some(val => val.toLowerCase().includes(search));
      const matchUnit = !santriUnitFilter || String(item.unit_id) === santriUnitFilter;
      const matchKamar = !santriKamarFilter || String(item.kamar_id) === santriKamarFilter;
      return matchSearch && matchUnit && matchKamar;
    });
  }, [santriList, santriSearch, santriUnitFilter, santriKamarFilter]);

  const itemsPerPage = isMobileViewport ? 10 : 50;
  const totalSantriPages = Math.ceil(filteredSantri.length / itemsPerPage) || 1;
  const currentSantriPageData = useMemo(() => {
    const start = (santriPage - 1) * itemsPerPage;
    return filteredSantri.slice(start, start + itemsPerPage);
  }, [filteredSantri, santriPage, itemsPerPage]);

  // Reset pagination on filter change
  useEffect(() => {
    setSantriPage(1);
  }, [santriSearch, santriUnitFilter, santriKamarFilter]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleViewportChange = () => setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleViewportChange);
    return () => mediaQuery.removeEventListener('change', handleViewportChange);
  }, []);

  useEffect(() => {
    setSantriPage(1);
  }, [isMobileViewport]);

  const saveSantri = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSantri.nama?.trim()) {
      setMessage('Nama santri wajib diisi.');
      return;
    }
    setSantriLoading(true);
    try {
      const response = await api.post('/api/master/santri', editingSantri);
      setMessage(response.data.message);
      setShowSantriModal(false);
      await fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.message ?? 'Gagal menyimpan data santri.');
    } finally {
      setSantriLoading(false);
    }
  };

  const selectedOption = opsi.find(item => item.jenis === jenis);
  const eligiblePetugas = useMemo(
    () => petugas.filter(item => item.status_aktif && item.jabatan === roleForJenis[jenis]),
    [petugas, jenis],
  );
  const accountRoles = useMemo(
    () => [...new Set(petugas.map(item => item.jabatan))].sort((left, right) => left.localeCompare(right, 'id')),
    [petugas],
  );
  const visibleAccounts = useMemo(() => {
    const search = accountSearch.trim().toLocaleLowerCase('id');
    return petugas
      .filter(item => !search || [item.nama, item.username, item.jabatan, item.tanggung_jawab_absensi]
        .some(value => value.toLocaleLowerCase('id').includes(search)))
      .filter(item => !accountRole || item.jabatan === accountRole)
      .filter(item => !accountStatus || (accountStatus === 'aktif' ? item.status_aktif : !item.status_aktif))
      .filter(item => !accountAssignment
        || (accountAssignment === 'ditugaskan'
          ? item.tanggung_jawab_absensi !== '-'
          : item.tanggung_jawab_absensi === '-'))
      .sort((left, right) => {
        const comparison = left[accountSort].localeCompare(right[accountSort], 'id', {
          numeric: true,
          sensitivity: 'base',
        });
        return accountSortDirection === 'asc' ? comparison : -comparison;
      });
  }, [petugas, accountSearch, accountRole, accountStatus, accountAssignment, accountSort, accountSortDirection]);

  const toggleAccountSort = (key: AccountSortKey) => {
    if (accountSort === key) {
      setAccountSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    setAccountSort(key);
    setAccountSortDirection('asc');
  };

  const accountSortIndicator = (key: AccountSortKey) => accountSort === key
    ? (accountSortDirection === 'asc' ? ' ↑' : ' ↓')
    : '';

  useEffect(() => {
    setPetugasId(eligiblePetugas[0] ? String(eligiblePetugas[0].petugas_id) : '');
    setTargetId(selectedOption?.targets[0] ? String(selectedOption.targets[0].target_id) : '');
  }, [jenis, petugas, opsi]);

  const saveAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.post('/api/master/penugasan', { petugas_id: Number(petugasId), jenis, target_id: Number(targetId) });
      setMessage('Penugasan berhasil disimpan.');
      await fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.message ?? 'Penugasan gagal disimpan.');
    }
  };

  const removeAssignment = async (id: number) => {
    if (!window.confirm('Hapus penugasan ini?')) return;
    await api.delete(`/api/master/penugasan/${id}`);
    setMessage('Penugasan dihapus.');
    await fetchData();
  };

  const resetPassword = async (id: number) => {
    if (!window.confirm('Reset password petugas ini?')) return;
    try {
      const response = await api.post(`/api/petugas/${id}/reset-password`);
      setPasswordBaru(response.data.new_password);
    } catch (error: any) {
      setMessage(error.response?.data?.message ?? 'Password gagal direset.');
    }
  };

  const syncReviews = async () => {
    setReviewLoading(true);
    try {
      const response = await api.post('/api/master/import-reviews/sync');
      setMessage(`${response.data.message} ${response.data.total_sumber} baris sumber diperiksa.`);
      await fetchReviews();
    } catch (error: any) {
      setMessage(error.response?.data?.message ?? 'Sinkronisasi review impor gagal.');
    } finally { setReviewLoading(false); }
  };

  const mergeReview = async (review: ImportReview) => {
    if (!review.kandidat_santri_id || !window.confirm(`Gabungkan “${review.nama_sumber}” ke kandidat “${review.nama_kandidat}”? Data induk kandidat dipertahankan.`)) return;
    try {
      const response = await api.post(`/api/master/import-reviews/${review.review_id}/merge`, { kandidat_santri_id: review.kandidat_santri_id });
      setMessage(response.data.message); await fetchReviews();
    } catch (error: any) { setMessage(error.response?.data?.message ?? 'Penggabungan gagal.'); }
  };

  const markSeparate = async (review: ImportReview) => {
    if (!window.confirm(`Tandai “${review.nama_sumber}” dan kandidatnya sebagai dua santri berbeda?`)) return;
    try {
      const response = await api.post(`/api/master/import-reviews/${review.review_id}/separate`);
      setMessage(response.data.message); await fetchReviews();
    } catch (error: any) { setMessage(error.response?.data?.message ?? 'Keputusan gagal disimpan.'); }
  };

  const saveMapping = async (mapping: KamarMapping) => {
    const kamarId = Number(mappingChoices[mapping.kode_sumber] || mapping.kamar_id);
    if (!kamarId) { setMessage('Pilih kamar tujuan terlebih dahulu.'); return; }
    if (!window.confirm(`Simpan kode ${mapping.kode_sumber} sebagai kamar tujuan terpilih?`)) return;
    try {
      const response = await api.post('/api/master/kamar-mappings', { kode_sumber: mapping.kode_sumber, kamar_id: kamarId });
      setMessage(`${response.data.message} ${response.data.santri_diperbarui} data santri dilengkapi.`); await fetchReviews();
    } catch (error: any) { setMessage(error.response?.data?.message ?? 'Mapping kamar gagal disimpan.'); }
  };

  const createKamarAndMapping = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!namaKamarBaru.trim()) { setMessage('Nama kamar resmi wajib diisi.'); return; }
    try {
      const response = await api.post('/api/master/kamar', { nama: namaKamarBaru, kode_sumber: kodeKamarBaru || null });
      setMessage(`${response.data.message} ${response.data.santri_diperbarui ?? 0} data santri dilengkapi.`);
      setNamaKamarBaru(''); setKodeKamarBaru('');
      await Promise.all([fetchData(), fetchReviews()]);
    } catch (error: any) { setMessage(error.response?.data?.message ?? 'Kamar atau mapping gagal disimpan.'); }
  };

  if (loading) return <div className="empty-state">Memuat data master...</div>;

  return (
    <div className="master-page">
      <header className="dashboard-header page-header">
        <h1>Data Master</h1>
        <p>Kelola data santri, penugasan pembina, kamar, dan akun petugas.</p>
      </header>
      {message && <div className="warning-box" style={{ marginBottom: 16 }}>{message}</div>}
      {passwordBaru && <div className="password-result">Password baru: <strong>{passwordBaru}</strong><button onClick={() => { void navigator.clipboard.writeText(passwordBaru); setPasswordBaru(''); }}>Salin & tutup</button></div>}

      {/* DATA SANTRI TAB */}
      {activeTab === 'santri' && (
        <section className="master-section">
          <div className="section-heading">
            <div>
              <h2>Master Data Santri</h2>
              <p>Kelola seluruh data santri ({santriList.length.toLocaleString('id')} total santri terdaftar).</p>
            </div>
            <button
              className="primary-button"
              onClick={() => {
                setEditingSantri({ santri_id: 0, nis: '', nama: '', unit_id: 1, kamar_id: null, nama_wali: '', no_hp_wali: '' });
                setShowSantriModal(true);
              }}
            >
              + Tambah Santri
            </button>
          </div>

          <div className="account-table-controls">
            <div className="account-search-control">
              <label htmlFor="santri-search">Pencarian Santri</label>
              <input
                id="santri-search"
                value={santriSearch}
                onChange={e => setSantriSearch(e.target.value)}
                placeholder="Cari Nama, NIS, Nama Wali, Kamar..."
              />
            </div>
            <div>
              <label htmlFor="santri-unit">Unit Pendidikan</label>
              <select
                id="santri-unit"
                value={santriUnitFilter}
                onChange={e => setSantriUnitFilter(e.target.value)}
              >
                <option value="">Semua Unit</option>
                {UNIT_LIST.map(u => (
                  <option key={u.id} value={u.id}>{u.kode} - {u.nama}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="santri-kamar">Filter Kamar</label>
              <select
                id="santri-kamar"
                value={santriKamarFilter}
                onChange={e => setSantriKamarFilter(e.target.value)}
              >
                <option value="">Semua Kamar</option>
                {kamar.map(k => (
                  <option key={k.kamar_id} value={k.kamar_id}>{k.nama}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="account-result-count">
            Menampilkan {currentSantriPageData.length} dari {filteredSantri.length.toLocaleString('id')} santri.
          </p>

          <div className="table-scroll">
            <table className="master-table santri-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>NIS / NIK</th>
                  <th>Nama Santri</th>
                  <th>Unit</th>
                  <th>Kamar</th>
                  <th>Nama Wali</th>
                  <th>No. HP Wali</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {currentSantriPageData.map((s, idx) => (
                  <tr key={s.santri_id}>
                    <td>{(santriPage - 1) * itemsPerPage + idx + 1}</td>
                    <td>{s.nis || <small style={{ color: '#888' }}>—</small>}</td>
                    <td><strong>{s.nama}</strong></td>
                    <td><span className="schedule-label">{s.kode_unit || '—'}</span></td>
                    <td>{s.nama_kamar || <small style={{ color: '#aaa' }}>Belum diatur</small>}</td>
                    <td>{s.nama_wali || '—'}</td>
                    <td>{s.no_hp_wali || '—'}</td>
                    <td>
                      <button
                        className="secondary-button"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => {
                          setEditingSantri({ ...s });
                          setShowSantriModal(true);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredSantri.length === 0 && <div className="empty-state">Tidak ada santri yang sesuai dengan kriteria filter.</div>}
          </div>

          {/* Pagination Controls */}
          {totalSantriPages > 1 && (
            <div className="pagination-controls">
              <button
                className="secondary-button"
                disabled={santriPage <= 1}
                onClick={() => setSantriPage(p => Math.max(1, p - 1))}
              >
                ← Sebelumnya
              </button>
              <div className="pagination-pages" aria-label="Pilih halaman data santri">
                {getPaginationItems(santriPage, totalSantriPages).map((item, index) => item === 'ellipsis' ? (
                  <span className="pagination-ellipsis" key={`ellipsis-${index}`} aria-hidden="true">…</span>
                ) : (
                  <button
                    type="button"
                    className={`pagination-page${santriPage === item ? ' active' : ''}`}
                    aria-label={`Halaman ${item}`}
                    aria-current={santriPage === item ? 'page' : undefined}
                    onClick={() => setSantriPage(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button
                className="secondary-button"
                disabled={santriPage >= totalSantriPages}
                onClick={() => setSantriPage(p => Math.min(totalSantriPages, p + 1))}
              >
                Berikutnya →
              </button>
            </div>
          )}
        </section>
      )}

      {/* FORM MODAL / SECTION UNTUK TAMBAH / EDIT SANTRI */}
      {showSantriModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520, padding: 28,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
              {editingSantri.santri_id ? 'Edit Data Santri' : 'Tambah Santri Baru'}
            </h2>
            <form onSubmit={saveSantri} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Nama Lengkap *</label>
                <input
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }}
                  value={editingSantri.nama || ''}
                  onChange={e => setEditingSantri(s => ({ ...s, nama: e.target.value }))}
                  placeholder="Masukkan nama santri"
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>NIS / NIK</label>
                <input
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }}
                  value={editingSantri.nis || ''}
                  onChange={e => setEditingSantri(s => ({ ...s, nis: e.target.value }))}
                  placeholder="Nomor Induk Santri / NIK"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Unit Pendidikan *</label>
                <select
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }}
                  value={editingSantri.unit_id || 1}
                  onChange={e => setEditingSantri(s => ({ ...s, unit_id: Number(e.target.value) }))}
                  required
                >
                  {UNIT_LIST.map(u => (
                    <option key={u.id} value={u.id}>{u.kode} - {u.nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Kamar Santri</label>
                <select
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }}
                  value={editingSantri.kamar_id ?? ''}
                  onChange={e => setEditingSantri(s => ({ ...s, kamar_id: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">-- Belum Diatur --</option>
                  {kamar.map(k => (
                    <option key={k.kamar_id} value={k.kamar_id}>{k.nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Nama Wali</label>
                <input
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }}
                  value={editingSantri.nama_wali || ''}
                  onChange={e => setEditingSantri(s => ({ ...s, nama_wali: e.target.value }))}
                  placeholder="Nama orang tua / wali"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>No. HP Wali</label>
                <input
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }}
                  value={editingSantri.no_hp_wali || ''}
                  onChange={e => setEditingSantri(s => ({ ...s, no_hp_wali: e.target.value }))}
                  placeholder="Nomor HP aktif (cth: 08123456789)"
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowSantriModal(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={santriLoading}
                >
                  {santriLoading ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PENUGASAN TAB */}
      {activeTab === 'penugasan' && <section className="master-section">
        <h2>Tambah penugasan absensi</h2>
        <form className="assignment-form" onSubmit={saveAssignment}>
          <div><label>Kegiatan</label><select value={jenis} onChange={event => setJenis(event.target.value)}>{opsi.map(item => <option key={item.jenis} value={item.jenis}>{item.nama}</option>)}</select></div>
          <div><label>Petugas ({roleForJenis[jenis]})</label><select value={petugasId} onChange={event => setPetugasId(event.target.value)} required>{eligiblePetugas.map(item => <option key={item.petugas_id} value={item.petugas_id}>{item.nama}</option>)}</select></div>
          <div><label>{jenis === 'sekolah' ? 'Kelas formal' : 'Kelompok'}</label><select value={targetId} onChange={event => setTargetId(event.target.value)} required>{selectedOption?.targets.map(target => <option key={target.target_id} value={target.target_id}>{target.nama_target}</option>)}</select></div>
          <button className="primary-button" disabled={!petugasId || !targetId}>Simpan penugasan</button>
        </form>
        {jenis === 'sekolah' && <div className="warning-box">Setiap kelas formal hanya dapat memiliki satu petugas absensi aktif agar penyimpanan tidak saling menimpa.</div>}
        {eligiblePetugas.length === 0 && <div className="warning-box">Belum ada petugas aktif dengan jabatan {roleForJenis[jenis]}.</div>}

        <div className="table-scroll"><table className="master-table"><thead><tr><th>Petugas</th><th>Jabatan</th><th>Jenis</th><th>Kelompok</th><th>Aksi</th></tr></thead><tbody>{penugasan.map(item => <tr key={item.penugasan_id}><td>{item.nama_petugas}</td><td>{item.jabatan}</td><td>{item.tipe_target}</td><td>{item.nama_target ?? `ID ${item.penugasan_id}`}</td><td><button className="danger-button" onClick={() => void removeAssignment(item.penugasan_id)}>Hapus</button></td></tr>)}</tbody></table></div>
      </section>}

      {/* REVIEW TAB */}
      {activeTab === 'review' && <section className="master-section">
        <div className="section-heading"><div><h2>Review impor santri</h2><p>Konfirmasi kandidat nama yang mirip. Keputusan disimpan agar tidak berubah saat sinkronisasi ulang.</p></div><button className="primary-button" onClick={() => void syncReviews()} disabled={reviewLoading}>{reviewLoading ? 'Menyinkronkan...' : 'Sinkronkan 971 data review'}</button></div>
        <div className="assignment-form compact-form"><div><label>Status review</label><select value={reviewStatus} onChange={event => setReviewStatus(event.target.value)}><option value="perlu_tinjau">Perlu tinjau</option><option value="perlu_mapping_kamar">Perlu mapping kamar</option><option value="terpisah">Sudah diputuskan terpisah</option><option value="digabung">Sudah digabung</option></select></div></div>
        {!reviews.length ? <div className="empty-state">Belum ada review pada status ini. Tekan “Sinkronkan 971 data review” untuk memuat data impor awal.</div> : <div className="table-scroll"><table className="master-table review-table"><thead><tr><th>Sumber</th><th>Santri dari impor</th><th>Kode kamar</th><th>Kandidat data induk</th><th>Skor</th><th>Aksi</th></tr></thead><tbody>{reviews.map(item => <tr key={item.review_id}><td>{item.sumber_sheet}<small>Baris {item.baris_sumber}</small></td><td><strong>{item.nama_sumber}</strong><small>{item.nama_santri_otomatis ? `ID otomatis ${item.santri_otomatis_id}${item.kamar_santri_otomatis ? ` · ${item.kamar_santri_otomatis}` : ''}` : 'Belum ditemukan di data otomatis'}</small></td><td>{item.kode_kamar_sumber || '—'}</td><td>{item.nama_kandidat ? <><strong>{item.nama_kandidat}</strong><small>{item.kamar_kandidat || 'Kamar kosong'}</small></> : 'Tidak ada kandidat yang cukup mirip'}</td><td>{item.skor_kemiripan ? `${item.skor_kemiripan}%` : '—'}</td><td className="review-actions">{item.status === 'perlu_tinjau' && item.kandidat_santri_id && <><button className="primary-button" onClick={() => void mergeReview(item)}>Gabungkan</button><button className="secondary-button" onClick={() => void markSeparate(item)}>Tetap terpisah</button></>}{item.status === 'perlu_tinjau' && !item.kandidat_santri_id && <span>Perlu data tambahan</span>}{item.status !== 'perlu_tinjau' && <span>{item.status.replaceAll('_', ' ')}</span>}</td></tr>)}</tbody></table></div>}
      </section>}

      {/* KAMAR TAB */}
      {activeTab === 'kamar' && <section className="master-section">
        <h2>Mapping kode kamar</h2><p>Hubungkan singkatan dari file sumber ke kamar resmi. Mapping akan digunakan pada impor berikutnya dan melengkapi santri otomatis yang kamarnya masih kosong.</p>
        <form className="kamar-create-form" onSubmit={createKamarAndMapping}>
          <div><label>Kode dari workbook (opsional)</label><input value={kodeKamarBaru} onChange={event => setKodeKamarBaru(event.target.value)} placeholder="Contoh: KK 201 atau 104.0" /></div>
          <div><label>Nama kamar resmi</label><input value={namaKamarBaru} onChange={event => setNamaKamarBaru(event.target.value)} placeholder="Contoh: Kamar Kiai 201" required /></div>
          <button className="primary-button">Tambah kamar & mapping</button>
        </form>
        {!mappings.length ? <div className="empty-state">Mapping akan tampil setelah review impor disinkronkan.</div> : <div className="table-scroll"><table className="master-table"><thead><tr><th>Kode dari sumber</th><th>Jumlah review</th><th>Kamar saat ini</th><th>Ubah / konfirmasi kamar</th><th>Aksi</th></tr></thead><tbody>{mappings.map(item => <tr key={item.kode_sumber}><td><strong>{item.kode_sumber}</strong></td><td>{item.jumlah_review}</td><td>{item.nama_kamar || <span className="warning-text">Belum dipetakan</span>}</td><td><select value={mappingChoices[item.kode_sumber] ?? String(item.kamar_id ?? '')} onChange={event => setMappingChoices(current => ({ ...current, [item.kode_sumber]: event.target.value }))}><option value="">Pilih kamar resmi</option>{kamar.map(room => <option key={room.kamar_id} value={room.kamar_id}>{room.nama}</option>)}</select></td><td><button className="primary-button" onClick={() => void saveMapping(item)}>Simpan mapping</button></td></tr>)}</tbody></table></div>}
      </section>}

      {/* AKUN PETUGAS TAB */}
      {activeTab === 'akun' && <section className="master-section">
        <h2>Akun petugas</h2>
        <div className="account-table-controls">
          <div className="account-search-control"><label htmlFor="account-search">Cari akun</label><input id="account-search" value={accountSearch} onChange={event => setAccountSearch(event.target.value)} placeholder="Nama, username, kelas..." /></div>
          <div><label htmlFor="account-role">Jabatan</label><select id="account-role" value={accountRole} onChange={event => setAccountRole(event.target.value)}><option value="">Semua jabatan</option>{accountRoles.map(role => <option key={role} value={role}>{role}</option>)}</select></div>
          <div><label htmlFor="account-assignment">Penugasan</label><select id="account-assignment" value={accountAssignment} onChange={event => setAccountAssignment(event.target.value)}><option value="">Semua</option><option value="ditugaskan">Ada penugasan</option><option value="belum">Belum ditugaskan</option></select></div>
          <div><label htmlFor="account-status">Status akun</label><select id="account-status" value={accountStatus} onChange={event => setAccountStatus(event.target.value)}><option value="">Semua status</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select></div>
        </div>
        <p className="account-result-count">Menampilkan {visibleAccounts.length} dari {petugas.length} akun.</p>
        <div className="table-scroll"><table className="master-table account-table"><thead><tr><th><button className="table-sort-button" onClick={() => toggleAccountSort('nama')}>Nama{accountSortIndicator('nama')}</button></th><th><button className="table-sort-button" onClick={() => toggleAccountSort('username')}>Username{accountSortIndicator('username')}</button></th><th><button className="table-sort-button" onClick={() => toggleAccountSort('jabatan')}>Jabatan{accountSortIndicator('jabatan')}</button></th><th><button className="table-sort-button" onClick={() => toggleAccountSort('tanggung_jawab_absensi')}>Tanggung Jawab Absensi{accountSortIndicator('tanggung_jawab_absensi')}</button></th><th>Aksi</th></tr></thead><tbody>{visibleAccounts.map(item => <tr key={item.petugas_id}><td>{item.nama}</td><td>{item.username}</td><td>{item.jabatan}</td><td>{item.tanggung_jawab_absensi || '-'}</td><td><button className="danger-button" onClick={() => void resetPassword(item.petugas_id)}>Reset password</button></td></tr>)}</tbody></table>{visibleAccounts.length === 0 && <div className="empty-state">Tidak ada akun yang sesuai dengan filter.</div>}</div>
      </section>}

      {/* DATA ALUMNI TAB */}
      {activeTab === 'alumni' && (
        <section className="master-section">
          <div className="section-heading">
            <div>
              <h2>Data Alumni Santri</h2>
              <p>Seluruh data alumni Pondok Pesantren Tebuireng ({alumniStats.total.toLocaleString('id')} alumni terdaftar).</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="dashboard-grid-premium" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <span className="stat-card-value">{alumniStats.total.toLocaleString('id')}</span>
              <span className="stat-card-label">Total Alumni</span>
            </div>
            {alumniStats.by_jenjang.slice(0, 2).map(item => (
              <div key={item.jenjang} className="stat-card">
                <span className="stat-card-value" style={{ color: '#0284c7' }}>{item.jumlah.toLocaleString('id')}</span>
                <span className="stat-card-label">{item.jenjang}</span>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="account-table-controls">
            <div className="account-search-control">
              <label htmlFor="alumni-search">Pencarian Alumni</label>
              <input
                id="alumni-search"
                value={alumniSearch}
                onChange={e => setAlumniSearch(e.target.value)}
                placeholder="Cari nama, No ID, orang tua..."
              />
            </div>
            <div>
              <label htmlFor="alumni-jenjang">Jenjang</label>
              <select id="alumni-jenjang" value={alumniJenjangFilter} onChange={e => setAlumniJenjangFilter(e.target.value)}>
                <option value="">Semua Jenjang</option>
                {alumniStats.by_jenjang.map(j => (
                  <option key={j.jenjang} value={j.jenjang}>{j.jenjang} ({j.jumlah.toLocaleString('id')})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="alumni-jk">L/P</label>
              <select id="alumni-jk" value={alumniJkFilter} onChange={e => setAlumniJkFilter(e.target.value)}>
                <option value="">Semua</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
          </div>

          <p className="account-result-count">
            {alumniLoading ? 'Memuat data alumni...' : `Menampilkan ${Math.min(alumniPage * 100, alumniList.length)} dari ${alumniList.length.toLocaleString('id')} alumni.`}
          </p>

          {/* Data Table */}
          <div className="table-scroll">
            <table className="master-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>No ID (Induk)</th>
                  <th>Nama Alumni</th>
                  <th>L/P</th>
                  <th>Tempat Lahir</th>
                  <th>Tanggal Lahir</th>
                  <th>Orang Tua</th>
                  <th>Jenjang</th>
                  <th>Kelas</th>
                  <th>No HP</th>
                  <th>Saldo SPP</th>
                  <th>Alamat</th>
                  <th>Wilayah</th>
                  <th>Provinsi</th>
                  <th>Angkatan</th>
                  <th>Tahun Lulus</th>
                </tr>
              </thead>
              <tbody>
                {alumniList.slice(0, alumniPage * 100).map((a, idx) => (
                  <tr key={a.alumni_id}>
                    <td>{idx + 1}</td>
                    <td>{a.no_id_induk || <small style={{ color: '#888' }}>—</small>}</td>
                    <td><strong>{a.nama}</strong></td>
                    <td>{a.jenis_kelamin || '—'}</td>
                    <td>{a.tempat_lahir || '—'}</td>
                    <td>{a.tanggal_lahir || '—'}</td>
                    <td>{a.orang_tua || '—'}</td>
                    <td><span className="schedule-label">{a.jenjang || '—'}</span></td>
                    <td>{a.kelas || '—'}</td>
                    <td>{a.no_hp || '—'}</td>
                    <td>{a.saldo_spp || '0'}</td>
                    <td>{a.alamat || '—'}</td>
                    <td>{a.wilayah || '—'}</td>
                    <td>{a.provinsi || '—'}</td>
                    <td>{a.angkatan || '—'}</td>
                    <td>{a.tahun_lulus || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {alumniList.length === 0 && !alumniLoading && (
              <div className="empty-state">Tidak ada data alumni yang sesuai dengan filter pencarian.</div>
            )}
          </div>

          {/* Load More */}
          {alumniPage * 100 < alumniList.length && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
              <button
                className="primary-button"
                onClick={() => setAlumniPage(p => p + 1)}
              >
                Muat {Math.min(100, alumniList.length - alumniPage * 100)} data berikutnya
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
