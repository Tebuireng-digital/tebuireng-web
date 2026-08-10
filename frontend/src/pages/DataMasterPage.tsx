import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { api } from '../api';
import { usePageMeta } from '../hooks/usePageMeta';

interface Petugas { petugas_id: number; nama: string; username: string; jabatan: string; status_aktif: boolean; tanggung_jawab_absensi: string }
interface Opsi { jenis: string; nama: string; targets: Array<{ target_id: number; nama_target: string }> }
interface Penugasan { penugasan_id: number; nama_petugas: string; jabatan: string; tipe_target: string; nama_target: string }
interface Kamar { kamar_id: number; nama: string }
interface KamarMapping { kode_sumber: string; jumlah_review: number; kamar_id?: number; nama_kamar?: string }
interface SantriMaster {
  santri_id: number;
  no_id_induk?: string | null;
  nis: string | null;
  nik_siswa?: string | null;
  nama: string;
  jenis_kelamin?: 'L' | 'P' | null;
  tempat_lahir?: string | null;
  tanggal_lahir?: string | null;
  no_hp_santri?: string | null;
  alamat_jalan?: string | null;
  provinsi?: string | null;
  kabupaten_kota?: string | null;
  kecamatan?: string | null;
  desa_kelurahan?: string | null;
  kode_pos?: string | null;
  unit_id: number;
  kode_unit?: string;
  nama_unit?: string;
  kamar_id?: number | null;
  kelas_formal_id?: number | null;
  kelompok_madin_id?: number | null;
  kelompok_pbs_id?: number | null;
  kelompok_pbm_id?: number | null;
  nama_kamar?: string | null;
  organisasi_daerah_id?: number | null;
  kode_orda?: string | null;
  nama_orda?: string | null;
  nama_kelas_formal?: string | null;
  nama_wali?: string | null;
  no_hp_wali?: string | null;
  status_aktif: boolean;
  status_verifikasi?: string;
  organisasi_daerah_id?: number | null;
  kode_organisasi_daerah?: string | null;
  nama_organisasi_daerah?: string | null;
  kegiatan_partisipasi?: Record<string, { status: 'terdaftar' | 'tidak_ikut' | 'perlu_verifikasi'; alasan?: string | null }>;
  catatan_import?: string | null;
}
interface VerificationSantri {
  santri_id: number;
  no_id_induk?: string | null;
  nama: string;
  kode_unit?: string | null;
  status_verifikasi: string;
  alasan: string[];
}
interface VerificationQueueResponse {
  data: VerificationSantri[];
  current_page: number;
  last_page: number;
  total: number;
}
interface SantriOptions {
  unit_pendidikan: Array<{ unit_id: number; kode: string; nama: string }>;
  organisasi_daerah: Array<{ organisasi_daerah_id: number; kode: string; nama: string }>;
  kelas_formal: Array<{ kelas_formal_id: number; nama_kelas: string }>;
  kelompok_madin: Array<{ kelompok_madin_id: number; nama_kelas_madin: string }>;
  kelompok_pbs: Array<{ kelompok_pbs_id: number; nama_kelompok: string }>;
  kelompok_pbm: Array<{ kelompok_pbm_id: number; nama_kelompok: string }>;
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
interface OrganisasiDaerahItem {
  organisasi_daerah_id: number;
  kode_singkat: string;
  nama_organisasi: string;
  deskripsi_wilayah: string | null;
  status_aktif: boolean;
  total_santri: number;
}

interface ImportReviewItem {
  review_id: number;
  sumber_sheet: string;
  baris_sumber: number;
  nama_sumber: string;
  kode_kamar_sumber: string | null;
  data_tambahan: string | null;
  santri_otomatis_id: number | null;
  kandidat_santri_id: number | null;
  skor_kemiripan: number;
  status: 'perlu_tinjau' | 'perlu_mapping_kamar' | 'terpisah' | 'digabung';
  diputuskan_oleh?: number | null;
  diputuskan_pada?: string | null;
  catatan_keputusan?: string | null;
  nama_santri_otomatis?: string | null;
  kamar_santri_otomatis?: string | null;
  nama_kandidat?: string | null;
  kamar_kandidat?: string | null;
}

type MasterTab = 'santri' | 'alumni' | 'data-orda' | 'ekstrakurikuler' | 'wisma' | 'verifikasi' | 'orda' | 'kamar' | 'review' | 'penugasan' | 'akun' | 'organisasi-daerah';
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
  { id: 6, kode: 'MTSS', nama: 'MTSS' },
  { id: 7, kode: 'SMPT', nama: 'SMPT' },
  { id: 8, kode: 'SMAT', nama: 'SMAT' },
  { id: 9, kode: 'MAS', nama: 'MAS' },
  { id: 10, kode: 'MU', nama: 'MU' },
  { id: 11, kode: 'THS', nama: 'THS' },
];

function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return <>
    {Array.from({ length: rows }, (_, rowIndex) => (
      <tr key={rowIndex} className="table-skeleton-row" aria-hidden="true">
        {Array.from({ length: columns }, (_, columnIndex) => (
          <td key={columnIndex}><span className={`table-skeleton-line line-${(rowIndex + columnIndex) % 3}`} /></td>
        ))}
      </tr>
    ))}
  </>;
}

export function DataMasterPage() {
  const { tab } = useParams<{ tab?: string }>();
  const location = useLocation();
  const [petugas, setPetugas] = useState<Petugas[]>([]);
  const [opsi, setOpsi] = useState<Opsi[]>([]);
  const [penugasan, setPenugasan] = useState<Penugasan[]>([]);
  const [kamar, setKamar] = useState<Kamar[]>([]);
  const [santriList, setSantriList] = useState<SantriMaster[]>([]);
  const [verificationList, setVerificationList] = useState<VerificationSantri[]>([]);
  const [verificationPage, setVerificationPage] = useState(1);
  const [verificationLastPage, setVerificationLastPage] = useState(1);
  const [verificationTotal, setVerificationTotal] = useState(0);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [ordaList, setOrdaList] = useState<VerificationSantri[]>([]);
  const [ordaPage, setOrdaPage] = useState(1);
  const [ordaLastPage, setOrdaLastPage] = useState(1);
  const [ordaTotal, setOrdaTotal] = useState(0);
  const [ordaLoading, setOrdaLoading] = useState(false);
  const [santriOptions, setSantriOptions] = useState<SantriOptions>({ unit_pendidikan: [], organisasi_daerah: [], kelas_formal: [], kelompok_madin: [], kelompok_pbs: [], kelompok_pbm: [] });
  const [mappings, setMappings] = useState<KamarMapping[]>([]);
  const [jenis, setJenis] = useState('sekolah');
  const [petugasId, setPetugasId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [passwordBaru, setPasswordBaru] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [santriLoading, setSantriLoading] = useState(false);
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

  // Review Kemiripan Tab State
  const [reviewList, setReviewList] = useState<ImportReviewItem[]>([]);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('');
  const [reviewSheetFilter, setReviewSheetFilter] = useState<string>('');
  const [reviewSearch, setReviewSearch] = useState<string>('');
  const [reviewPage, setReviewPage] = useState<number>(1);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Filter out items without candidates (only display rows with candidate/pair)
  const validReviewList = useMemo(() => {
    return reviewList.filter(item => Boolean(item.kandidat_santri_id || item.santri_otomatis_id || item.nama_kandidat || item.nama_santri_otomatis));
  }, [reviewList]);

  const reviewItemsPerPage = 10;
  const totalReviewPages = Math.ceil(validReviewList.length / reviewItemsPerPage) || 1;

  const paginatedReviewList = useMemo(() => {
    const start = (reviewPage - 1) * reviewItemsPerPage;
    return validReviewList.slice(start, start + reviewItemsPerPage);
  }, [validReviewList, reviewPage, reviewItemsPerPage]);

  useEffect(() => {
    setReviewPage(1);
  }, [reviewSearch, reviewStatusFilter, reviewSheetFilter]);

  // Modal Review Verification State
  const [activeReviewItem, setActiveReviewItem] = useState<ImportReviewItem | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [candidateSearchText, setCandidateSearchText] = useState<string>('');
  const [isCandidateSearchOpen, setIsCandidateSearchOpen] = useState<boolean>(false);
  const [isMerging, setIsMerging] = useState<boolean>(false);

  const isVerificationData = location.pathname.startsWith('/verifikasi-data');
  const allowedTabs = isVerificationData
    ? ['santri', 'orda', 'kamar', 'review']
    : ['santri', 'alumni', 'data-orda', 'ekstrakurikuler', 'wisma', 'penugasan', 'kamar', 'review', 'akun', 'organisasi-daerah'];
  const activeTab: MasterTab = allowedTabs.includes(tab ?? '') ? (tab as MasterTab) : 'santri';

  const tabTitles: Record<MasterTab, string> = {
    santri: 'Data Santri',
    verifikasi: 'Pemetaan Absensi Santri',
    orda: 'Verifikasi ORDA',
    penugasan: 'Penugasan Absensi',
    kamar: 'Kamar & Pemetaan',
    review: 'Review Kemiripan Data',
    akun: 'Akun Petugas',
    alumni: 'Data Alumni',
    'organisasi-daerah': 'Organisasi Daerah',
    'data-orda': 'Data ORDA',
    ekstrakurikuler: 'Data Ekstrakurikuler',
    wisma: 'Data Wisma',
  };

  usePageMeta({
    title: `${tabTitles[activeTab]} - ${isVerificationData ? 'Verifikasi Data' : 'Data Master'}`,
    description: `Kelola ${tabTitles[activeTab].toLowerCase()} dan konfigurasi operasional Pondok Pesantren Tebuireng.`,
  });

  const fetchData = async () => {
    const [petugasResponse, opsiResponse, penugasanResponse, kamarResponse, santriResponse, santriOptionsResponse] = await Promise.all([
      api.get('/api/master/petugas'),
      api.get('/api/absensi-options'),
      api.get('/api/master/penugasan'),
      api.get('/api/master/kamar'),
      api.get('/api/master/santri'),
      api.get('/api/master/santri/options'),
    ]);
    setPetugas(petugasResponse.data);
    setOpsi(opsiResponse.data);
    setPenugasan(penugasanResponse.data);
    setKamar(kamarResponse.data);
    setSantriList(santriResponse.data);
    setSantriOptions(santriOptionsResponse.data);
  };

  const fetchVerification = async () => {
    setVerificationLoading(true);
    try {
      const response = await api.get<VerificationQueueResponse>('/api/master/santri/verifikasi', {
        params: { page: verificationPage, per_page: 50 },
      });
      setVerificationList(response.data.data);
      setVerificationLastPage(response.data.last_page);
      setVerificationTotal(response.data.total);
    } finally {
      setVerificationLoading(false);
    }
  };

  const fetchOrdaVerification = async () => {
    setOrdaLoading(true);
    try {
      const response = await api.get<VerificationQueueResponse>('/api/master/santri/verifikasi-orda', {
        params: { page: ordaPage, per_page: 50 },
      });
      setOrdaList(response.data.data);
      setOrdaLastPage(response.data.last_page);
      setOrdaTotal(response.data.total);
    } finally {
      setOrdaLoading(false);
    }
  };

  const fetchKamarMappings = async () => {
    const response = await api.get('/api/master/kamar-mappings');
    setMappings(response.data);
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
    if (isVerificationData && activeTab === 'kamar') {
      fetchKamarMappings().catch(() => setMappings([]));
    }
  }, [activeTab, isVerificationData]);

  useEffect(() => {
    if (isVerificationData && activeTab === 'santri') {
      fetchVerification().catch(() => setMessage('Antrean verifikasi gagal dimuat.'));
    }
  }, [activeTab, isVerificationData, verificationPage]);

  useEffect(() => {
    if (isVerificationData && activeTab === 'orda') {
      fetchOrdaVerification().catch(() => setMessage('Antrean verifikasi ORDA gagal dimuat.'));
    }
  }, [activeTab, isVerificationData, ordaPage]);

  const fetchReviewData = async () => {
    setReviewLoading(true);
    try {
      const response = await api.get<ImportReviewItem[]>('/api/master/import-reviews', {
        params: {
          status: reviewStatusFilter || undefined,
          sheet: reviewSheetFilter || undefined,
          search: reviewSearch.trim() || undefined,
        },
      });
      setReviewList(response.data);
    } catch {
      setMessage('Daftar review kemiripan data gagal dimuat.');
    } finally {
      setReviewLoading(false);
    }
  };

  const openReviewModal = (item: ImportReviewItem) => {
    setActiveReviewItem(item);
    setSelectedCandidateId(item.kandidat_santri_id || item.santri_otomatis_id);
    setCandidateSearchText('');
    setIsCandidateSearchOpen(false);
  };

  const closeReviewModal = () => {
    if (isMerging) return;
    setActiveReviewItem(null);
    setSelectedCandidateId(null);
    setCandidateSearchText('');
    setIsCandidateSearchOpen(false);
  };

  const confirmMergeInModal = async () => {
    if (!activeReviewItem) return;
    setIsMerging(true);
    try {
      const response = await api.post(`/api/master/import-reviews/${activeReviewItem.review_id}/merge`, {
        kandidat_santri_id: selectedCandidateId,
      });
      setMessage(response.data.message);
      closeReviewModal();
      await fetchReviewData();
      await fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.message ?? 'Gagal menggabungkan data santri.');
    } finally {
      setIsMerging(false);
    }
  };

  const confirmSeparateInModal = async () => {
    if (!activeReviewItem) return;
    setIsMerging(true);
    try {
      const response = await api.post(`/api/master/import-reviews/${activeReviewItem.review_id}/separate`);
      setMessage(response.data.message);
      closeReviewModal();
      await fetchReviewData();
    } catch (error: any) {
      setMessage(error.response?.data?.message ?? 'Gagal menandai terpisah.');
    } finally {
      setIsMerging(false);
    }
  };

  const handleSeparateDirect = async (item: ImportReviewItem) => {
    if (!window.confirm(`Tandai "${item.nama_sumber}" sebagai dua orang yang berbeda (terpisah)?`)) return;
    try {
      const response = await api.post(`/api/master/import-reviews/${item.review_id}/separate`);
      setMessage(response.data.message);
      await fetchReviewData();
    } catch (error: any) {
      setMessage(error.response?.data?.message ?? 'Gagal menandai terpisah.');
    }
  };

  const handleSyncReview = async () => {
    setReviewLoading(true);
    try {
      const response = await api.post('/api/master/import-reviews/sync');
      setMessage(`${response.data.message} (${response.data.baru_ditambahkan} data baru).`);
      await fetchReviewData();
    } catch (error: any) {
      setMessage(error.response?.data?.message ?? 'Gagal menyinkronkan data review.');
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    if (isVerificationData && activeTab === 'review') {
      const timer = window.setTimeout(() => { fetchReviewData(); }, 300);
      return () => window.clearTimeout(timer);
    }
  }, [activeTab, isVerificationData, reviewStatusFilter, reviewSheetFilter, reviewSearch]);

  // Fetch alumni when tab is alumni or filter changes
  useEffect(() => {
    if (!isVerificationData && activeTab === 'alumni') {
      const timer = window.setTimeout(() => { fetchAlumni(); }, 300);
      return () => window.clearTimeout(timer);
    }
  }, [activeTab, isVerificationData, alumniSearch, alumniJenjangFilter, alumniJkFilter]);

  const fetchOrda = async () => {
    setOrdaLoading(true);
    try {
      const response = await api.get('/api/master/organisasi-daerah');
      setOrdaList(response.data);
    } catch {
      setMessage('Data organisasi daerah gagal dimuat.');
    } finally {
      setOrdaLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'organisasi-daerah') {
      fetchOrda();
    }
  }, [activeTab]);

  const saveOrda = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/master/organisasi-daerah', editingOrda);
      setMessage(res.data.message);
      setShowOrdaModal(false);
      await fetchOrda();
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Gagal menyimpan organisasi daerah.');
    }
  };

  const saveBulkOrda = async () => {
    if (selectedSantriIds.size === 0) {
      alert('Pilih setidaknya 1 santri untuk dipetakan.');
      return;
    }
    setBulkOrdaSaving(true);
    try {
      const res = await api.post('/api/master/santri/bulk-orda', {
        organisasi_daerah_id: selectedOrdaTargetId,
        santri_ids: Array.from(selectedSantriIds),
      });
      setMessage(res.data.message);
      setSelectedSantriIds(new Set());
      await Promise.all([fetchOrda(), fetchData()]);
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Gagal menyimpan pemetaan santri.');
    } finally {
      setBulkOrdaSaving(false);
    }
  };

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
  const unitOptions = santriOptions.unit_pendidikan.length ? santriOptions.unit_pendidikan : UNIT_LIST.map(unit => ({ unit_id: unit.id, kode: unit.kode, nama: unit.nama }));

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
      await fetchVerification();
      await fetchOrdaVerification();
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

  const saveMapping = async (mapping: KamarMapping) => {
    const kamarId = Number(mappingChoices[mapping.kode_sumber] || mapping.kamar_id);
    if (!kamarId) { setMessage('Pilih kamar tujuan terlebih dahulu.'); return; }
    if (!window.confirm(`Simpan kode ${mapping.kode_sumber} sebagai kamar tujuan terpilih?`)) return;
    try {
      const response = await api.post('/api/master/kamar-mappings', { kode_sumber: mapping.kode_sumber, kamar_id: kamarId });
      setMessage(`${response.data.message} ${response.data.santri_diperbarui} data santri dilengkapi.`); await fetchKamarMappings();
    } catch (error: any) { setMessage(error.response?.data?.message ?? 'Mapping kamar gagal disimpan.'); }
  };

  const createKamarAndMapping = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!namaKamarBaru.trim()) { setMessage('Nama kamar resmi wajib diisi.'); return; }
    try {
      const response = await api.post('/api/master/kamar', { nama: namaKamarBaru, kode_sumber: kodeKamarBaru || null });
      setMessage(`${response.data.message} ${response.data.santri_diperbarui ?? 0} data santri dilengkapi.`);
      setNamaKamarBaru(''); setKodeKamarBaru('');
      await Promise.all([fetchData(), fetchKamarMappings()]);
    } catch (error: any) { setMessage(error.response?.data?.message ?? 'Kamar atau mapping gagal disimpan.'); }
  };

  if (loading) return <div className="empty-state">Memuat data master...</div>;

  return (
    <div className="master-page">
      <header className="dashboard-header page-header">
        <h1>{isVerificationData ? 'Verifikasi Data' : 'Data Master'}</h1>
        <p>{isVerificationData ? 'Selesaikan data yang belum tervalidasi sebelum dipakai untuk operasional absensi.' : 'Kelola data referensi santri, alumni, ORDA, ekstrakurikuler, dan wisma.'}</p>
      </header>
      {message && <div className="warning-box" style={{ marginBottom: 16 }}>{message}</div>}
      {passwordBaru && <div className="password-result">Password baru: <strong>{passwordBaru}</strong><button onClick={() => { void navigator.clipboard.writeText(passwordBaru); setPasswordBaru(''); }}>Salin & tutup</button></div>}

      {/* DATA SANTRI TAB */}
      {!isVerificationData && activeTab === 'santri' && (
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
                {unitOptions.map(u => (
                  <option key={u.unit_id} value={u.unit_id}>{u.kode} - {u.nama}</option>
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
                  <th>No. ID</th>
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
                    <td>{s.no_id_induk || <small style={{ color: '#888' }}>Belum diverifikasi</small>}</td>
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

      {!isVerificationData && activeTab === 'data-orda' && (
        <section className="master-section">
          <div className="section-heading"><div><h2>Data ORDA</h2><p>Daftar organisasi daerah yang tersedia untuk penetapan santri.</p></div><span className="schedule-label">{santriOptions.organisasi_daerah.length.toLocaleString('id')} ORDA</span></div>
          <div className="table-scroll"><table className="master-table"><thead><tr><th>Kode</th><th>Nama organisasi daerah</th></tr></thead><tbody>{santriOptions.organisasi_daerah.map(organisasi => <tr key={organisasi.organisasi_daerah_id}><td><strong>{organisasi.kode}</strong></td><td>{organisasi.nama}</td></tr>)}</tbody></table>{santriOptions.organisasi_daerah.length === 0 && <div className="empty-state">Belum ada data ORDA.</div>}</div>
        </section>
      )}

      {!isVerificationData && activeTab === 'ekstrakurikuler' && (
        <section className="master-section">
          <h2>Data ekstrakurikuler</h2>
          <p>Tab ini disiapkan untuk master kegiatan ekstrakurikuler. Belum ada data yang dikelola pada tahap ini.</p>
          <div className="empty-state">Data ekstrakurikuler masih dummy dan belum terhubung ke absensi atau rapor.</div>
        </section>
      )}

      {!isVerificationData && activeTab === 'wisma' && (
        <section className="master-section">
          <div className="section-heading"><div><h2>Data wisma</h2><p>Struktur wisma belum dimodelkan terpisah. Daftar kamar yang tersedia ditampilkan sebagai data penempatan saat ini.</p></div><span className="schedule-label">{kamar.length.toLocaleString('id')} kamar</span></div>
          <div className="table-scroll"><table className="master-table"><thead><tr><th>No.</th><th>Nama kamar</th></tr></thead><tbody>{kamar.map((item, index) => <tr key={item.kamar_id}><td>{index + 1}</td><td>{item.nama}</td></tr>)}</tbody></table>{kamar.length === 0 && <div className="empty-state">Belum ada data kamar untuk ditampilkan.</div>}</div>
        </section>
      )}

      {isVerificationData && activeTab === 'santri' && (
        <section className="master-section">
          <div className="section-heading">
            <div>
              <h2>Antrean pemetaan absensi</h2>
              <p>Petakan kamar, kelas formal, Madin, Al-Qur’an Subuh, dan Takhasus Maghrib sebelum data dipakai untuk absensi dan rapor.</p>
            </div>
            <span className="schedule-label">{verificationTotal.toLocaleString('id')} perlu ditinjau</span>
          </div>
          <div className="table-scroll">
            <table className="master-table">
              <thead><tr><th>No. ID</th><th>Santri</th><th>Unit</th><th>Mapping absensi yang perlu dilengkapi</th><th>Aksi</th></tr></thead>
              <tbody>
                {verificationLoading ? <TableSkeleton columns={5} /> : verificationList.map(item => (
                  <tr key={item.santri_id}>
                    <td>{item.no_id_induk || '—'}</td>
                    <td><strong>{item.nama}</strong><small>{item.status_verifikasi.replaceAll('_', ' ')}</small></td>
                    <td>{item.kode_unit || '—'}</td>
                    <td>{item.alasan.length ? item.alasan.join('; ') : 'Perlu keputusan admin'}</td>
                    <td><button className="secondary-button" onClick={() => {
                      const santri = santriList.find(row => row.santri_id === item.santri_id);
                      if (santri) { setEditingSantri({ ...santri }); setShowSantriModal(true); }
                    }}>Verifikasi</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!verificationLoading && verificationList.length === 0 && <div className="empty-state">Tidak ada santri yang menunggu pemetaan absensi.</div>}
          </div>
          {verificationLastPage > 1 && (
            <div className="pagination-controls">
              <button
                className="secondary-button"
                disabled={verificationPage <= 1}
                onClick={() => setVerificationPage(page => Math.max(1, page - 1))}
              >
                ← Sebelumnya
              </button>
              <div className="pagination-pages" aria-label="Halaman antrean verifikasi">
                {getPaginationItems(verificationPage, verificationLastPage).map((item, index) => item === 'ellipsis' ? (
                  <span key={`verification-ellipsis-${index}`} className="pagination-ellipsis">…</span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={`pagination-page${verificationPage === item ? ' active' : ''}`}
                    aria-label={`Halaman ${item}`}
                    aria-current={verificationPage === item ? 'page' : undefined}
                    onClick={() => setVerificationPage(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button
                className="secondary-button"
                disabled={verificationPage >= verificationLastPage}
                onClick={() => setVerificationPage(page => Math.min(verificationLastPage, page + 1))}
              >
                Berikutnya →
              </button>
            </div>
          )}
        </section>
      )}

      {isVerificationData && activeTab === 'orda' && (
        <section className="master-section">
          <div className="section-heading">
            <div>
              <h2>Antrean verifikasi ORDA</h2>
              <p>Tetapkan organisasi daerah berdasarkan NIK, domisili, dan data pendukung santri. Antrean ini tidak memengaruhi mapping absensi.</p>
            </div>
            <span className="schedule-label">{ordaTotal.toLocaleString('id')} perlu ditinjau</span>
          </div>
          <div className="table-scroll">
            <table className="master-table">
              <thead><tr><th>No. ID</th><th>Santri</th><th>Unit</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {ordaLoading ? <TableSkeleton columns={5} /> : ordaList.map(item => (
                  <tr key={item.santri_id}>
                    <td>{item.no_id_induk || '—'}</td>
                    <td><strong>{item.nama}</strong><small>{item.status_verifikasi.replaceAll('_', ' ')}</small></td>
                    <td>{item.kode_unit || '—'}</td>
                    <td>{item.alasan.join('; ')}</td>
                    <td><button className="secondary-button" onClick={() => {
                      const santri = santriList.find(row => row.santri_id === item.santri_id);
                      if (santri) { setEditingSantri({ ...santri }); setShowSantriModal(true); }
                    }}>Tentukan ORDA</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!ordaLoading && ordaList.length === 0 && <div className="empty-state">Semua santri sudah memiliki ORDA aktif.</div>}
          </div>
          {ordaLastPage > 1 && (
            <div className="pagination-controls">
              <button className="secondary-button" disabled={ordaPage <= 1} onClick={() => setOrdaPage(page => Math.max(1, page - 1))}>← Sebelumnya</button>
              <div className="pagination-pages" aria-label="Halaman antrean verifikasi ORDA">
                {getPaginationItems(ordaPage, ordaLastPage).map((item, index) => item === 'ellipsis' ? (
                  <span key={`orda-ellipsis-${index}`} className="pagination-ellipsis">…</span>
                ) : (
                  <button key={item} type="button" className={`pagination-page${ordaPage === item ? ' active' : ''}`} aria-label={`Halaman ${item}`} aria-current={ordaPage === item ? 'page' : undefined} onClick={() => setOrdaPage(item)}>{item}</button>
                ))}
              </div>
              <button className="secondary-button" disabled={ordaPage >= ordaLastPage} onClick={() => setOrdaPage(page => Math.min(ordaLastPage, page + 1))}>Berikutnya →</button>
            </div>
          )}
        </section>
      )}

      {/* FORM MODAL / SECTION UNTUK TAMBAH / EDIT SANTRI */}
      {showSantriModal && (
        <div className="santri-modal-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget && !santriLoading) setShowSantriModal(false);
        }}>
          <section className="santri-modal" role="dialog" aria-modal="true" aria-labelledby="santri-modal-title">
            <header className="santri-modal-header">
              <div>
                <h2 id="santri-modal-title">{editingSantri.santri_id ? 'Edit Data Santri' : 'Tambah Santri Baru'}</h2>
                {editingSantri.no_id_induk && <p>No. ID {editingSantri.no_id_induk}</p>}
              </div>
              <button type="button" className="santri-modal-close" aria-label="Tutup formulir" disabled={santriLoading} onClick={() => setShowSantriModal(false)}>×</button>
            </header>
            <form id="santri-form" onSubmit={saveSantri} className="santri-modal-form">
              <div className="santri-modal-body">
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
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>No. ID Santri</label>
                <input
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }}
                  value={editingSantri.no_id_induk || ''}
                  onChange={e => setEditingSantri(s => ({ ...s, no_id_induk: e.target.value }))}
                  placeholder="ID resmi dari data santri semua"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>NIK Santri</label>
                <input
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }}
                  value={editingSantri.nik_siswa || ''}
                  onChange={e => setEditingSantri(s => ({ ...s, nik_siswa: e.target.value }))}
                  placeholder="Opsional, dapat dilengkapi kemudian"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>L/P</label>
                  <select style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }} value={editingSantri.jenis_kelamin || ''} onChange={e => setEditingSantri(s => ({ ...s, jenis_kelamin: e.target.value || null } as Partial<SantriMaster>))}>
                    <option value="">-- Belum diisi --</option><option value="L">Laki-laki</option><option value="P">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Tanggal Lahir</label>
                  <input type="date" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }} value={editingSantri.tanggal_lahir || ''} onChange={e => setEditingSantri(s => ({ ...s, tanggal_lahir: e.target.value || null }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Tempat Lahir</label>
                <input style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }} value={editingSantri.tempat_lahir || ''} onChange={e => setEditingSantri(s => ({ ...s, tempat_lahir: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Alamat Domisili</label>
                <textarea style={{ width: '100%', minHeight: 70, padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }} value={editingSantri.alamat_jalan || ''} onChange={e => setEditingSantri(s => ({ ...s, alamat_jalan: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {([
                  ['provinsi', 'Provinsi'], ['kabupaten_kota', 'Kabupaten/Kota'], ['kecamatan', 'Kecamatan'], ['desa_kelurahan', 'Desa/Kelurahan'],
                ] as const).map(([field, label]) => <div key={field}><label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>{label}</label><input style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }} value={editingSantri[field] || ''} onChange={e => setEditingSantri(s => ({ ...s, [field]: e.target.value }))} /></div>)}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Unit Pendidikan *</label>
                <select
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }}
                  value={editingSantri.unit_id || 1}
                  onChange={e => setEditingSantri(s => ({ ...s, unit_id: Number(e.target.value) }))}
                  required
                >
                  {unitOptions.map(u => (
                    <option key={u.unit_id} value={u.unit_id}>{u.kode} - {u.nama}</option>
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
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Organisasi Daerah</label>
                <select
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }}
                  value={editingSantri.organisasi_daerah_id ?? ''}
                  onChange={e => setEditingSantri(s => ({ ...s, organisasi_daerah_id: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">-- Belum Ditetapkan --</option>
                  {santriOptions.organisasi_daerah.map(organisasi => (
                    <option key={organisasi.organisasi_daerah_id} value={organisasi.organisasi_daerah_id}>{organisasi.kode} — {organisasi.nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Kelas Formal</label>
                <select style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }} value={editingSantri.kelas_formal_id ?? ''} onChange={e => setEditingSantri(s => ({ ...s, kelas_formal_id: e.target.value ? Number(e.target.value) : null }))}>
                  <option value="">-- Belum dipetakan --</option>{santriOptions.kelas_formal.map(item => <option key={item.kelas_formal_id} value={item.kelas_formal_id}>{item.nama_kelas}</option>)}
                </select>
              </div>
              <div><label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Kelompok Madin</label><select style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }} value={editingSantri.kelompok_madin_id ?? ''} onChange={e => setEditingSantri(s => ({ ...s, kelompok_madin_id: e.target.value ? Number(e.target.value) : null }))}><option value="">-- Belum dipetakan --</option>{santriOptions.kelompok_madin.map(item => <option key={item.kelompok_madin_id} value={item.kelompok_madin_id}>{item.nama_kelas_madin}</option>)}</select></div>
              <div><label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Kelompok Al-Qur’an Subuh</label><select style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }} value={editingSantri.kelompok_pbs_id ?? ''} onChange={e => setEditingSantri(s => ({ ...s, kelompok_pbs_id: e.target.value ? Number(e.target.value) : null }))}><option value="">-- Belum dipetakan --</option>{santriOptions.kelompok_pbs.map(item => <option key={item.kelompok_pbs_id} value={item.kelompok_pbs_id}>{item.nama_kelompok}</option>)}</select></div>
              <div><label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Kelompok Takhasus Maghrib</label><select style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }} value={editingSantri.kelompok_pbm_id ?? ''} onChange={e => setEditingSantri(s => ({ ...s, kelompok_pbm_id: e.target.value ? Number(e.target.value) : null }))}><option value="">-- Belum dipetakan --</option>{santriOptions.kelompok_pbm.map(item => <option key={item.kelompok_pbm_id} value={item.kelompok_pbm_id}>{item.nama_kelompok}</option>)}</select></div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>Keikutsertaan kegiatan</h3>
                <p style={{ fontSize: 12, color: '#475569', marginTop: 0 }}>Pilih “Tidak ikut” bila memang tidak menjadi peserta; pilihan ini mencegah data terbaca sebagai alfa atau belum diisi.</p>
                {([
                  ['sekolah', 'Sekolah formal'], ['kamar', 'Kamar'], ['diniyah', 'Madin'], ['pbs', 'Al-Qur’an Subuh'], ['pbm', 'Takhasus Maghrib'],
                ] as const).map(([slug, label]) => {
                  const status = editingSantri.kegiatan_partisipasi?.[slug]?.status || 'perlu_verifikasi';
                  return <div key={slug} style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 10, alignItems: 'center', marginBottom: 8 }}><label style={{ fontSize: 13, fontWeight: 600 }}>{label}</label><select style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }} value={status} onChange={e => setEditingSantri(s => ({ ...s, kegiatan_partisipasi: { ...(s.kegiatan_partisipasi || {}), [slug]: { status: e.target.value as 'terdaftar' | 'tidak_ikut' | 'perlu_verifikasi' } } }))}><option value="perlu_verifikasi">Perlu verifikasi</option><option value="terdaftar">Terdaftar</option><option value="tidak_ikut">Tidak ikut</option></select></div>;
                })}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Status Verifikasi</label>
                <select
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }}
                  value={editingSantri.status_verifikasi || 'perlu_verifikasi'}
                  onChange={e => setEditingSantri(s => ({ ...s, status_verifikasi: e.target.value }))}
                >
                  <option value="perlu_verifikasi">Perlu verifikasi</option>
                  <option value="perlu_lengkapi_profil">Perlu lengkapi profil</option>
                  <option value="perlu_tentukan_kelas">Perlu tentukan kelas</option>
                  <option value="perlu_mapping_kegiatan">Perlu mapping kegiatan</option>
                  <option value="perlu_review_identitas">Perlu review identitas</option>
                  <option value="kandidat_alumni">Kandidat alumni</option>
                  <option value="terverifikasi_aktif">Terverifikasi aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </div>
              </div>
            </form>
            <footer className="santri-modal-footer">
              <button type="button" className="secondary-button" disabled={santriLoading} onClick={() => setShowSantriModal(false)}>Batal</button>
              <button type="submit" form="santri-form" className="primary-button" disabled={santriLoading}>{santriLoading ? 'Menyimpan...' : 'Simpan Data'}</button>
            </footer>
          </section>
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

      {/* KAMAR TAB */}
      {isVerificationData && activeTab === 'kamar' && <section className="master-section">
        <h2>Mapping kode kamar</h2><p>Hubungkan singkatan dari file sumber ke kamar resmi. Mapping akan digunakan pada impor berikutnya dan melengkapi santri otomatis yang kamarnya masih kosong.</p>
        <form className="kamar-create-form" onSubmit={createKamarAndMapping}>
          <div><label>Kode dari workbook (opsional)</label><input value={kodeKamarBaru} onChange={event => setKodeKamarBaru(event.target.value)} placeholder="Contoh: KK 201 atau 104.0" /></div>
          <div><label>Nama kamar resmi</label><input value={namaKamarBaru} onChange={event => setNamaKamarBaru(event.target.value)} placeholder="Contoh: Kamar Kiai 201" required /></div>
          <button className="primary-button">Tambah kamar & mapping</button>
        </form>
        {!mappings.length ? <div className="empty-state">Belum ada kode kamar yang perlu dipetakan.</div> : <div className="table-scroll"><table className="master-table"><thead><tr><th>Kode dari sumber</th><th>Jumlah review</th><th>Kamar saat ini</th><th>Ubah / konfirmasi kamar</th><th>Aksi</th></tr></thead><tbody>{mappings.map(item => <tr key={item.kode_sumber}><td><strong>{item.kode_sumber}</strong></td><td>{item.jumlah_review}</td><td>{item.nama_kamar || <span className="warning-text">Belum dipetakan</span>}</td><td><select value={mappingChoices[item.kode_sumber] ?? String(item.kamar_id ?? '')} onChange={event => setMappingChoices(current => ({ ...current, [item.kode_sumber]: event.target.value }))}><option value="">Pilih kamar resmi</option>{kamar.map(room => <option key={room.kamar_id} value={room.kamar_id}>{room.nama}</option>)}</select></td><td><button className="primary-button" onClick={() => void saveMapping(item)}>Simpan mapping</button></td></tr>)}</tbody></table></div>}
      </section>}

      {/* REVIEW KEMIRIPAN DATA TAB */}
      {isVerificationData && activeTab === 'review' && (
        <section className="master-section">
          <div className="section-heading">
            <div>
              <h2>Review Kemiripan Data Santri</h2>
              <p>Pencocokan data santri dari file impor/legacy dengan master santri terdaftar. Evaluasi kemiripan nama (tanda baca/typo) dan pemetaan kamar.</p>
            </div>
            <button type="button" className="secondary-button" onClick={() => void handleSyncReview()} disabled={reviewLoading}>
              {reviewLoading ? 'Menyinkronkan...' : 'Sinkronkan Data Review'}
            </button>
          </div>

          {/* Interactive Stat Cards Bar */}
          <div className="dashboard-grid-premium" style={{ marginBottom: 20 }}>
            <button
              type="button"
              className="stat-card"
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                border: reviewStatusFilter === 'perlu_tinjau' ? '2px solid var(--aksen)' : '1px solid var(--garis)',
                background: reviewStatusFilter === 'perlu_tinjau' ? '#f0fdf4' : 'var(--kertas-kartu)',
              }}
              onClick={() => setReviewStatusFilter(current => current === 'perlu_tinjau' ? '' : 'perlu_tinjau')}
            >
              <span className="stat-card-value">{validReviewList.filter(r => r.status === 'perlu_tinjau').length}</span>
              <span className="stat-card-label">Perlu Tinjau</span>
            </button>
            <button
              type="button"
              className="stat-card"
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                border: reviewStatusFilter === 'perlu_mapping_kamar' ? '2px solid #d97706' : '1px solid var(--garis)',
                background: reviewStatusFilter === 'perlu_mapping_kamar' ? '#fff7ed' : 'var(--kertas-kartu)',
              }}
              onClick={() => setReviewStatusFilter(current => current === 'perlu_mapping_kamar' ? '' : 'perlu_mapping_kamar')}
            >
              <span className="stat-card-value" style={{ color: '#d97706' }}>{validReviewList.filter(r => r.status === 'perlu_mapping_kamar').length}</span>
              <span className="stat-card-label">Perlu Mapping Kamar</span>
            </button>
            <button
              type="button"
              className="stat-card"
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                border: reviewStatusFilter === 'digabung' ? '2px solid #16a34a' : '1px solid var(--garis)',
                background: reviewStatusFilter === 'digabung' ? '#f0fdf4' : 'var(--kertas-kartu)',
              }}
              onClick={() => setReviewStatusFilter(current => current === 'digabung' ? '' : 'digabung')}
            >
              <span className="stat-card-value" style={{ color: '#16a34a' }}>{validReviewList.filter(r => r.status === 'digabung').length}</span>
              <span className="stat-card-label">Telah Digabung</span>
            </button>
            <button
              type="button"
              className="stat-card"
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                border: reviewStatusFilter === 'terpisah' ? '2px solid #6b7280' : '1px solid var(--garis)',
                background: reviewStatusFilter === 'terpisah' ? '#f8fafc' : 'var(--kertas-kartu)',
              }}
              onClick={() => setReviewStatusFilter(current => current === 'terpisah' ? '' : 'terpisah')}
            >
              <span className="stat-card-value" style={{ color: '#6b7280' }}>{validReviewList.filter(r => r.status === 'terpisah').length}</span>
              <span className="stat-card-label">Tandai Terpisah</span>
            </button>
          </div>

          {/* Controls */}
          <div className="account-table-controls">
            <div className="account-search-control">
              <label htmlFor="review-search">Cari Nama / Kode Kamar</label>
              <input
                id="review-search"
                value={reviewSearch}
                onChange={e => setReviewSearch(e.target.value)}
                placeholder="Cari nama sumber, kandidat master, atau kamar..."
              />
            </div>
            <div>
              <label htmlFor="review-status">Status</label>
              <select id="review-status" value={reviewStatusFilter} onChange={e => setReviewStatusFilter(e.target.value)}>
                <option value="">Semua Status</option>
                <option value="perlu_tinjau">Perlu Tinjau</option>
                <option value="perlu_mapping_kamar">Perlu Mapping Kamar</option>
                <option value="digabung">Digabung</option>
                <option value="terpisah">Terpisah</option>
              </select>
            </div>
            <div>
              <label htmlFor="review-sheet">Sumber File/Sheet</label>
              <select id="review-sheet" value={reviewSheetFilter} onChange={e => setReviewSheetFilter(e.target.value)}>
                <option value="">Semua Sumber</option>
                <option value="Database Siswa">Database Siswa</option>
                <option value="Database Siswa Madin">Database Siswa Madin</option>
                <option value="Database Al-Qur'an">Database Al-Qur'an</option>
                <option value="Database Takhassus">Database Takhassus</option>
              </select>
            </div>
          </div>

          <p className="account-result-count">
            {reviewLoading ? 'Memuat data review kemiripan...' : `Menampilkan ${validReviewList.length} baris review kemiripan data yang memiliki kandidat.`}
          </p>

          <div className="table-scroll">
            <table className="master-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Data Sumber (File Lama/Impor)</th>
                  <th>Kandidat Santri Master</th>
                  <th>Kemiripan</th>
                  <th>Status & Informasi Kamar</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReviewList.map((item, idx) => {
                  const hasCandidate = Boolean(item.nama_kandidat || item.nama_santri_otomatis || item.kandidat_santri_id || item.santri_otomatis_id);
                  const kamarMaster = item.kamar_kandidat || item.kamar_santri_otomatis || 'Belum terisi';
                  const isRoomMismatch = item.kode_kamar_sumber && (!item.kamar_kandidat && !item.kamar_santri_otomatis);

                  return (
                    <tr key={item.review_id}>
                      <td>{(reviewPage - 1) * reviewItemsPerPage + idx + 1}</td>
                      <td>
                        <strong style={{ fontSize: 14 }}>{item.nama_sumber}</strong>
                        <div style={{ fontSize: '0.85em', color: '#64748b', marginTop: 2 }}>
                          Sumber: {item.sumber_sheet} | Kamar Impor: {item.kode_kamar_sumber ? <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 4 }}>{item.kode_kamar_sumber}</code> : '—'}
                        </div>
                        {item.data_tambahan && (
                          <div style={{ fontSize: '0.8em', color: '#64748b', marginTop: 2 }}>
                            Info: {item.data_tambahan}
                          </div>
                        )}
                      </td>
                      <td>
                        {hasCandidate ? (
                          <div>
                            <strong style={{ fontSize: 14 }}>{item.nama_kandidat || item.nama_santri_otomatis}</strong>
                            <div style={{ fontSize: '0.85em', color: '#64748b', marginTop: 2 }}>
                              Kamar Master: <span>{kamarMaster}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="warning-text">Belum ada kandidat serupa di master</span>
                        )}
                      </td>
                      <td>
                        {hasCandidate && item.skor_kemiripan > 0 ? (
                          <span style={{ color: item.skor_kemiripan >= 85 ? '#15803d' : '#b45309', fontWeight: 700 }}>
                            {Math.round(item.skor_kemiripan)}%
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ marginBottom: 4 }}>
                          {item.status === 'perlu_tinjau' && <span style={{ color: '#b45309', fontWeight: 600 }}>Perlu Tinjau</span>}
                          {item.status === 'perlu_mapping_kamar' && <span style={{ color: '#b91c1c', fontWeight: 600 }}>Perlu Mapping Kamar</span>}
                          {item.status === 'digabung' && <span style={{ color: '#15803d', fontWeight: 600 }}>Digabung</span>}
                          {item.status === 'terpisah' && <span style={{ color: '#475569', fontWeight: 600 }}>Terpisah</span>}
                        </div>
                        {isRoomMismatch && (
                          <small style={{ color: '#d97706', display: 'block', marginTop: 2 }}>
                            Peringatan: Kamar di data lama ({item.kode_kamar_sumber}), tapi master belum terisi kamar.
                          </small>
                        )}
                      </td>
                      <td>
                        {item.status !== 'digabung' && item.status !== 'terpisah' && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="primary-button"
                              style={{ padding: '6px 12px', fontSize: '0.85em', fontWeight: 600 }}
                              onClick={() => openReviewModal(item)}
                            >
                              Gabungkan
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: '6px 12px', fontSize: '0.85em', fontWeight: 600, borderColor: '#cbd5e1', color: '#475569' }}
                              onClick={() => void handleSeparateDirect(item)}
                            >
                              Terpisah
                            </button>
                          </div>
                        )}
                        {item.status === 'digabung' && (
                          <span style={{ fontSize: '0.85em', color: '#16a34a', fontWeight: 600 }}>Telah digabungkan</span>
                        )}
                        {item.status === 'terpisah' && (
                          <span style={{ fontSize: '0.85em', color: '#6b7280' }}>Dua orang terpisah</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {validReviewList.length === 0 && !reviewLoading && (
              <div className="empty-state">Tidak ada data review kemiripan yang sesuai dengan filter.</div>
            )}
          </div>

          {totalReviewPages > 1 && (
            <div className="pagination-controls" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="secondary-button"
                disabled={reviewPage === 1}
                onClick={() => setReviewPage(p => Math.max(1, p - 1))}
              >
                Sebelumnya
              </button>
              <div className="pagination-pages">
                {getPaginationItems(reviewPage, totalReviewPages).map((pageItem, index) =>
                  pageItem === 'ellipsis' ? (
                    <span key={`review-ellipsis-${index}`} className="pagination-ellipsis">…</span>
                  ) : (
                    <button
                      key={`review-page-${pageItem}`}
                      type="button"
                      className={`pagination-page ${reviewPage === pageItem ? 'active' : ''}`}
                      onClick={() => setReviewPage(pageItem)}
                    >
                      {pageItem}
                    </button>
                  )
                )}
              </div>
              <button
                type="button"
                className="secondary-button"
                disabled={reviewPage === totalReviewPages}
                onClick={() => setReviewPage(p => Math.min(totalReviewPages, p + 1))}
              >
                Selanjutnya
              </button>
            </div>
          )}
        </section>
      )}

      {/* REVIEW & VERIFICATION MODAL */}
      {activeReviewItem && (
        <div
          className="santri-modal-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !isMerging) closeReviewModal();
          }}
        >
          <section className="santri-modal review-modal" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
            <header className="santri-modal-header review-modal-header">
              <div>
                <h2 id="review-modal-title">Verifikasi & Penggabungan Data Santri</h2>
                <p>Sumber Data: {activeReviewItem.sumber_sheet} • Baris ke-{activeReviewItem.baris_sumber}</p>
              </div>
              <button type="button" className="santri-modal-close" aria-label="Tutup modal" disabled={isMerging} onClick={closeReviewModal}>×</button>
            </header>

            <div className="santri-modal-body review-modal-body">
              {/* Score Banner */}
              <div className={`review-match-banner ${activeReviewItem.skor_kemiripan >= 80 ? 'high-match' : ''}`}>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>
                    {activeReviewItem.skor_kemiripan >= 80 ? 'Kemiripan Sangat Tinggi' : 'Kemiripan Sedang (Perlu Evaluasi)'}
                  </span>
                  <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                    Tingkat kemiripan penulisan nama sebesar <strong>{Math.round(activeReviewItem.skor_kemiripan)}%</strong>
                  </div>
                </div>
                <span className="schedule-label" style={{ backgroundColor: activeReviewItem.skor_kemiripan >= 80 ? '#dcfce7' : '#fef3c7', color: activeReviewItem.skor_kemiripan >= 80 ? '#15803d' : '#b45309', fontWeight: 700, fontSize: 14 }}>
                  {Math.round(activeReviewItem.skor_kemiripan)}% Match
                </span>
              </div>

              {/* Compare Grid */}
              <div className="review-compare-grid">
                {/* Source Box */}
                <div className="review-compare-card source">
                  <div className="review-card-title source-title">Data Sumber (File Impor/Lama)</div>
                  <div className="review-field-group">
                    <div className="review-field-label">Nama Sumber</div>
                    <div className="review-field-value" style={{ fontSize: 15, color: '#1e293b' }}>{activeReviewItem.nama_sumber}</div>
                  </div>
                  <div className="review-field-group">
                    <div className="review-field-label">Kode Kamar dari Impor</div>
                    <div className="review-field-value">
                      {activeReviewItem.kode_kamar_sumber ? (
                        <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{activeReviewItem.kode_kamar_sumber}</code>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Tidak ada kamar</span>
                      )}
                    </div>
                  </div>
                  {activeReviewItem.data_tambahan && (
                    <div className="review-field-group">
                      <div className="review-field-label">Informasi Tambahan</div>
                      <div className="review-field-value" style={{ fontSize: 12, color: '#475569' }}>{activeReviewItem.data_tambahan}</div>
                    </div>
                  )}
                </div>

                {/* Target Master Box */}
                <div className="review-compare-card target">
                  <div className="review-card-title target-title">Data Master Santri Terdaftar</div>
                  
                  {/* Selected Target Preview */}
                  {(() => {
                    const selectedSantri = santriList.find(s => s.santri_id === selectedCandidateId);
                    const defaultName = activeReviewItem.nama_kandidat || activeReviewItem.nama_santri_otomatis;
                    const displayName = selectedSantri ? selectedSantri.nama : (defaultName || 'Pilih Kandidat Master');
                    const displayKamar = selectedSantri ? (selectedSantri.nama_kamar || 'Belum terisi') : (activeReviewItem.kamar_kandidat || activeReviewItem.kamar_santri_otomatis || 'Belum terisi');
                    const displayId = selectedSantri ? (selectedSantri.no_id_induk || selectedSantri.nis || '-') : '-';

                    return (
                      <>
                        <div className="review-field-group">
                          <div className="review-field-label">Nama Santri Master</div>
                          <div className="review-field-value" style={{ fontSize: 15, color: '#065f46' }}>{displayName}</div>
                        </div>
                        <div className="review-field-group">
                          <div className="review-field-label">No. ID Induk / NIS</div>
                          <div className="review-field-value" style={{ fontSize: 13, fontFamily: 'monospace' }}>{displayId}</div>
                        </div>
                        <div className="review-field-group">
                          <div className="review-field-label">Kamar Terdaftar Saat Ini</div>
                          <div className="review-field-value" style={{ fontSize: 13 }}>{displayKamar}</div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Change candidate toggle */}
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #cbd5e1' }}>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ padding: '4px 10px', fontSize: 11, width: '100%' }}
                      onClick={() => setIsCandidateSearchOpen(!isCandidateSearchOpen)}
                    >
                      {isCandidateSearchOpen ? 'Sembunyikan Pencarian Kandidat' : 'Ganti / Cari Santri Master Lain'}
                    </button>

                    {isCandidateSearchOpen && (
                      <div style={{ marginTop: 8 }}>
                        <input
                          type="text"
                          value={candidateSearchText}
                          onChange={e => setCandidateSearchText(e.target.value)}
                          placeholder="Ketik nama santri master..."
                          style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 6 }}
                        />
                        <div style={{ maxHeight: 150, overflowY: 'auto', marginTop: 4, background: 'white', border: '1px solid #cbd5e1', borderRadius: 6 }}>
                          {santriList
                            .filter(s => !candidateSearchText.trim() || s.nama.toLowerCase().includes(candidateSearchText.toLowerCase()))
                            .slice(0, 20)
                            .map(s => (
                              <button
                                key={s.santri_id}
                                type="button"
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  padding: '6px 10px',
                                  textAlign: 'left',
                                  border: '0',
                                  borderBottom: '1px solid #f1f5f9',
                                  background: selectedCandidateId === s.santri_id ? '#dcfce7' : 'white',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                }}
                                onClick={() => {
                                  setSelectedCandidateId(s.santri_id);
                                  setIsCandidateSearchOpen(false);
                                }}
                              >
                                <strong>{s.nama}</strong> <small style={{ color: '#64748b' }}>({s.kode_unit || 'Unit'} - {s.nama_kamar || 'Tanpa Kamar'})</small>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Info Notice */}
              <div style={{ background: '#f1f5f9', padding: '12px 16px', borderRadius: 10, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                <strong>Dampak Penggabungan:</strong> Seluruh riwayat absensi, perizinan, dan pelanggaran dari santri otomatis akan dialihkan ke data santri master terpilih. Profil master yang masih kosong akan otomatis dilengkapi dari data sumber.
              </div>
            </div>

            <footer className="santri-modal-footer review-modal-footer">
              <button
                type="button"
                className="secondary-button"
                style={{ borderColor: '#ef4444', color: '#b91c1c' }}
                disabled={isMerging}
                onClick={() => void confirmSeparateInModal()}
              >
                Tandai Berbeda (Terpisah)
              </button>
              <div className="review-modal-footer-right">
                <button type="button" className="secondary-button" disabled={isMerging} onClick={closeReviewModal}>Batal</button>
                <button type="button" className="primary-button" disabled={isMerging || !selectedCandidateId} onClick={() => void confirmMergeInModal()}>
                  {isMerging ? 'Memproses Merge...' : 'Konfirmasi & Gabungkan Data'}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

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
      {!isVerificationData && activeTab === 'alumni' && (
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

      {/* ORGANISASI DAERAH TAB */}
      {activeTab === 'organisasi-daerah' && (
        <section className="master-section">
          <div className="section-heading">
            <div>
              <h2>Organisasi Daerah (Orda) Santri</h2>
              <p>Kelola data master Orda dan pemetaan wilayah santri.</p>
            </div>
            {ordaSubTab === 'master' && (
              <button
                className="primary-button"
                onClick={() => {
                  setEditingOrda({ organisasi_daerah_id: 0, kode_singkat: '', nama_organisasi: '', deskripsi_wilayah: '', status_aktif: true });
                  setShowOrdaModal(true);
                }}
              >
                + Tambah Orda
              </button>
            )}
          </div>

          {/* Sub Tab Switcher */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button
              className={`secondary-button ${ordaSubTab === 'master' ? 'active' : ''}`}
              style={{ background: ordaSubTab === 'master' ? 'var(--aksen)' : undefined, color: ordaSubTab === 'master' ? '#fff' : undefined }}
              onClick={() => setOrdaSubTab('master')}
            >
              📋 Master Orda ({ordaList.length})
            </button>
            <button
              className={`secondary-button ${ordaSubTab === 'mapping' ? 'active' : ''}`}
              style={{ background: ordaSubTab === 'mapping' ? 'var(--aksen)' : undefined, color: ordaSubTab === 'mapping' ? '#fff' : undefined }}
              onClick={() => setOrdaSubTab('mapping')}
            >
              🔗 Pemetaan Bulk Santri
            </button>
          </div>

          {ordaSubTab === 'master' && (
            <div className="table-scroll">
              <table className="master-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>No</th>
                    <th>Kode Singkat</th>
                    <th>Nama Organisasi Daerah</th>
                    <th>Cakupan Wilayah</th>
                    <th style={{ textAlign: 'center' }}>Total Santri</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center', width: '80px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {ordaList.map((o, idx) => (
                    <tr key={o.organisasi_daerah_id}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td><strong>{o.kode_singkat}</strong></td>
                      <td>{o.nama_organisasi}</td>
                      <td>{o.deskripsi_wilayah || <small style={{ color: '#888' }}>—</small>}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{o.total_santri} santri</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`status-pill ${o.status_aktif ? 'status-hadir' : 'status-alpha'}`}>
                          {o.status_aktif ? 'Aktif' : 'Non-aktif'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="secondary-button"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => {
                            setEditingOrda(o);
                            setShowOrdaModal(true);
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ordaList.length === 0 && !ordaLoading && (
                <div className="empty-state">Belum ada data Organisasi Daerah.</div>
              )}
            </div>
          )}

          {ordaSubTab === 'mapping' && (
            <div>
              <div className="account-table-controls" style={{ marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="orda-target-select">Orda Tujuan (Pemetaan Bulk)</label>
                  <select
                    id="orda-target-select"
                    value={selectedOrdaTargetId ?? ''}
                    onChange={e => setSelectedOrdaTargetId(Number(e.target.value) || null)}
                  >
                    <option value="">— Kosongkan Orda (Hapus Pemetaan) —</option>
                    {ordaList.filter(o => o.status_aktif).map(o => (
                      <option key={o.organisasi_daerah_id} value={o.organisasi_daerah_id}>
                        {o.kode_singkat} — {o.nama_organisasi} ({o.total_santri} santri)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="account-search-control" style={{ flex: 1 }}>
                  <label htmlFor="orda-santri-search">Cari Santri</label>
                  <input
                    id="orda-santri-search"
                    value={santriSearch}
                    onChange={e => setSantriSearch(e.target.value)}
                    placeholder="Cari Nama, NIS, Orda..."
                  />
                </div>

                <div style={{ alignSelf: 'flex-end' }}>
                  <button
                    className="primary-button"
                    disabled={selectedSantriIds.size === 0 || bulkOrdaSaving}
                    onClick={() => void saveBulkOrda()}
                  >
                    {bulkOrdaSaving ? 'Menyimpan...' : `Simpan Pemetaan (${selectedSantriIds.size} Santri)`}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button
                  className="secondary-button"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => {
                    const allIds = new Set(filteredSantri.map(s => s.santri_id));
                    setSelectedSantriIds(allIds);
                  }}
                >
                  ✓ Pilih Semua ({filteredSantri.length})
                </button>
                <button
                  className="secondary-button"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => setSelectedSantriIds(new Set())}
                >
                  ✕ Batal Pilih All
                </button>
              </div>

              <div className="table-scroll">
                <table className="master-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Pilih</th>
                      <th>No</th>
                      <th>NIS</th>
                      <th>Nama Santri</th>
                      <th>Unit</th>
                      <th>Kamar</th>
                      <th>Organisasi Daerah Saat Ini</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentSantriPageData.map((s, idx) => {
                      const isChecked = selectedSantriIds.has(s.santri_id);
                      return (
                        <tr key={s.santri_id} style={{ background: isChecked ? 'rgba(15, 110, 86, 0.06)' : undefined }}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                const next = new Set(selectedSantriIds);
                                if (e.target.checked) next.add(s.santri_id);
                                else next.delete(s.santri_id);
                                setSelectedSantriIds(next);
                              }}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>{(santriPage - 1) * itemsPerPage + idx + 1}</td>
                          <td>{s.nis || '—'}</td>
                          <td><strong>{s.nama}</strong></td>
                          <td><span className="schedule-label">{s.kode_unit || '—'}</span></td>
                          <td>{s.nama_kamar || '—'}</td>
                          <td>
                            {s.kode_orda ? (
                              <span style={{ fontWeight: 600, color: 'var(--aksen)' }}>
                                {s.kode_orda} ({s.nama_orda})
                              </span>
                            ) : (
                              <small style={{ color: '#888' }}>Belum Dipetakan</small>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalSantriPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                  <button className="secondary-button" disabled={santriPage <= 1} onClick={() => setSantriPage(p => p - 1)}>Sebelumnya</button>
                  <span style={{ display: 'flex', alignItems: 'center', fontSize: '13px' }}>Halaman {santriPage} dari {totalSantriPages}</span>
                  <button className="secondary-button" disabled={santriPage >= totalSantriPages} onClick={() => setSantriPage(p => p + 1)}>Berikutnya</button>
                </div>
              )}
            </div>
          )}

          {/* ORDA MODAL */}
          {showOrdaModal && (
            <div className="save-modal-backdrop" role="presentation">
              <div className="save-modal" style={{ maxWidth: '500px', width: '90%', textAlign: 'left' }} role="dialog">
                <h2>{editingOrda.organisasi_daerah_id ? 'Edit Organisasi Daerah' : 'Tambah Organisasi Daerah'}</h2>
                <form onSubmit={e => void saveOrda(e)} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                  <div>
                    <label className="ui-text-label">Kode Singkat (singkatan)</label>
                    <input
                      className="raport-select"
                      style={{ width: '100%' }}
                      required
                      value={editingOrda.kode_singkat || ''}
                      onChange={e => setEditingOrda(p => ({ ...p, kode_singkat: e.target.value }))}
                      placeholder="Contoh: HISPA, OPIM, IKSMA"
                    />
                  </div>
                  <div>
                    <label className="ui-text-label">Nama Resmi Organisasi</label>
                    <input
                      className="raport-select"
                      style={{ width: '100%' }}
                      required
                      value={editingOrda.nama_organisasi || ''}
                      onChange={e => setEditingOrda(p => ({ ...p, nama_organisasi: e.target.value }))}
                      placeholder="Contoh: Himpunan Santri Pasundan"
                    />
                  </div>
                  <div>
                    <label className="ui-text-label">Cakupan Wilayah / Daerah Asal</label>
                    <input
                      className="raport-select"
                      style={{ width: '100%' }}
                      value={editingOrda.deskripsi_wilayah || ''}
                      onChange={e => setEditingOrda(p => ({ ...p, deskripsi_wilayah: e.target.value }))}
                      placeholder="Contoh: Jawa Barat & Banten"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="orda-aktif-chk"
                      checked={editingOrda.status_aktif ?? true}
                      onChange={e => setEditingOrda(p => ({ ...p, status_aktif: e.target.checked }))}
                    />
                    <label htmlFor="orda-aktif-chk" className="ui-text-label" style={{ marginBottom: 0 }}>Status Aktif</label>
                  </div>

                  <div className="save-modal-actions" style={{ marginTop: '16px' }}>
                    <button type="button" className="secondary-button" onClick={() => setShowOrdaModal(false)}>Batal</button>
                    <button type="submit" className="primary-button">Simpan</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
