import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { api } from '../api';
import { AppDropdown } from '../components/AppDropdown';
import { PageSkeleton, Spinner, ValuePulse } from '../components/LoadingSkeleton';
import { usePageMeta } from '../hooks/usePageMeta';

interface Petugas { petugas_id: number; nama: string; username: string; no_hp?: string | null; jabatan: string; status_aktif: boolean; tanggung_jawab_absensi: string }
interface Opsi { jenis: string; nama: string; targets: Array<{ target_id: number; nama_target: string; unit_kode?: string; unit_nama?: string }> }
interface Penugasan { penugasan_id: number; petugas_id: number; nama_petugas: string; jabatan: string; tipe_target: string; target_id: number; nama_target: string }
interface Kamar { kamar_id: number; nama: string; kode_singkat?: string | null; status_aktif?: boolean }
interface Ekstrakurikuler { ekstrakurikuler_id: number; kode: string; nama: string; pembimbing_id?: number | null; nama_pembimbing?: string | null; status_aktif: boolean }
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

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
  ) : (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
  );
}

function PencilIcon() {
  return <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>;
}

interface AssignmentOption { key: string; label: string }

function AssignmentMultiDropdown({ id, label, value, options, disabled, onChange }: { id: string; label: string; value: string[]; options: AssignmentOption[]; disabled?: boolean; onChange: (value: string[]) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  const selectedLabels = options.filter(option => value.includes(option.key)).map(option => option.label);
  const toggleOption = (optionKey: string) => onChange(value.includes(optionKey) ? value.filter(key => key !== optionKey) : [...value, optionKey]);

  return (
    <div className="app-dropdown assignment-multi-dropdown" ref={dropdownRef}>
      <label className="app-dropdown-label" htmlFor={id}>{label}</label>
      <button id={id} type="button" className={`app-dropdown-trigger${isOpen ? ' is-open' : ''}`} aria-haspopup="listbox" aria-expanded={isOpen} disabled={disabled} onClick={() => setIsOpen(open => !open)}>
        <span className={selectedLabels.length ? 'app-dropdown-value' : 'app-dropdown-placeholder'}>{selectedLabels.length ? `${selectedLabels.length} penugasan dipilih` : 'Pilih kelas/kamar'}</span>
        <span className="app-dropdown-chevron" aria-hidden="true">⌄</span>
      </button>
      {isOpen && <div className="app-dropdown-menu assignment-multi-menu" role="listbox" aria-labelledby={id} aria-multiselectable="true">
        {options.map(option => {
          const selected = value.includes(option.key);
          return <button key={option.key} type="button" role="option" aria-selected={selected} className={`app-dropdown-option assignment-multi-option${selected ? ' is-selected' : ''}`} onClick={() => toggleOption(option.key)}><span className={`assignment-option-check${selected ? ' is-selected' : ''}`} aria-hidden="true">{selected ? '✓' : ''}</span><span>{option.label}</span></button>;
        })}
        {options.length === 0 && <div className="app-dropdown-empty">Tidak ada target sesuai jabatan.</div>}
      </div>}
    </div>
  );
}

const getPaginationItems = (current: number, total: number): PaginationItem[] => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, 6, 'ellipsis', total];
  if (current >= total - 3) return [1, 'ellipsis', total - 5, total - 4, total - 3, total - 2, total - 1, total];
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
};

const roleForJenis: Record<string, string> = {
  sekolah: 'Wali Kelas', kamar: 'Pembina Kamar', pbs: 'Ustadz', diniyah: 'Ustadz', pbm: 'Ustadz',
};

const assignmentTypesForRole: Record<string, string[]> = {
  'Pembina Kamar': ['Kamar'],
  'Wali Kelas': ['KelasFormal'],
  Ustadz: ['KelompokPBS', 'KelompokMadin', 'KelompokPBM'],
  Admin: ['Kamar', 'KelasFormal', 'KelompokPBS', 'KelompokMadin', 'KelompokPBM'],
};

const assignmentKindForType: Record<string, string> = {
  Kamar: 'kamar',
  KelasFormal: 'sekolah',
  KelompokPBS: 'pbs',
  KelompokMadin: 'diniyah',
  KelompokPBM: 'pbm',
};

const assignmentKey = (tipeTarget: string, targetId: number) => `${tipeTarget}:${targetId}`;

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
  const [message, setMessage] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [errorToast, setErrorToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [santriLoading, setSantriLoading] = useState(false);
  const [mappingChoices, setMappingChoices] = useState<Record<string, string>>({});
  const [namaKamarBaru, setNamaKamarBaru] = useState('');
  const [kodeKamarBaru, setKodeKamarBaru] = useState('');
  const [showKamarModal, setShowKamarModal] = useState(false);
  const [kamarToDeactivate, setKamarToDeactivate] = useState<Kamar | null>(null);
  const [ekstrakurikuler, setEkstrakurikuler] = useState<Ekstrakurikuler[]>([]);
  const [showEkstrakurikulerModal, setShowEkstrakurikulerModal] = useState(false);
  const [editingEkstrakurikuler, setEditingEkstrakurikuler] = useState<Partial<Ekstrakurikuler>>({ ekstrakurikuler_id: 0, kode: '', nama: '', pembimbing_id: null, status_aktif: true });
  const [ekstrakurikulerToDeactivate, setEkstrakurikulerToDeactivate] = useState<Ekstrakurikuler | null>(null);
  const [editingKamar, setEditingKamar] = useState<Partial<Kamar>>({ kamar_id: 0, nama: '', kode_singkat: '', status_aktif: true });
  const [showPetugasModal, setShowPetugasModal] = useState(false);
  const [petugasToDelete, setPetugasToDelete] = useState<{ id: number; nama: string } | null>(null);
  const [showPetugasPassword, setShowPetugasPassword] = useState(false);
  const [showPetugasPasswordConfirmation, setShowPetugasPasswordConfirmation] = useState(false);
  const [editingAssignments, setEditingAssignments] = useState<string[]>([]);
  const [initialEditingPetugas, setInitialEditingPetugas] = useState<Partial<Petugas> & { password?: string }>({});
  const [initialEditingAssignments, setInitialEditingAssignments] = useState<string[]>([]);
  const [editingPetugas, setEditingPetugas] = useState<Partial<Petugas> & { password?: string; password_confirmation?: string }>({ petugas_id: 0, nama: '', username: '', no_hp: '', jabatan: 'Pembina Kamar', status_aktif: true, password: '', password_confirmation: '' });

  useEffect(() => {
    if (!successToast) return undefined;
    const timeoutId = window.setTimeout(() => setSuccessToast(''), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [successToast]);

  useEffect(() => {
    if (!errorToast) return undefined;
    const timeoutId = window.setTimeout(() => setErrorToast(''), 4200);
    return () => window.clearTimeout(timeoutId);
  }, [errorToast]);

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
  const [accountStatus, setAccountStatus] = useState('aktif');
  const [accountAssignment, setAccountAssignment] = useState('');
  const [accountSort, setAccountSort] = useState<AccountSortKey>('nama');
  const [accountSortDirection, setAccountSortDirection] = useState<'asc' | 'desc'>('asc');
  const [accountPage, setAccountPage] = useState(1);
  const [wismaPage, setWismaPage] = useState(1);

  // Alumni Tab State
  const [alumniList, setAlumniList] = useState<AlumniRecord[]>([]);
  const [alumniStats, setAlumniStats] = useState<AlumniStats>({ total: 0, by_jenjang: [], by_jenis_kelamin: [] });
  const [alumniSearch, setAlumniSearch] = useState('');
  const [alumniJenjangFilter, setAlumniJenjangFilter] = useState('');
  const [alumniJkFilter, setAlumniJkFilter] = useState('');
  const [alumniPage, setAlumniPage] = useState(1);
  const [alumniLoading, setAlumniLoading] = useState(false);

  // Organisasi Daerah State
  const [ordaMasterList, setOrdaMasterList] = useState<OrganisasiDaerahItem[]>([]);
  const [ordaSubTab, setOrdaSubTab] = useState<'master' | 'mapping'>('master');
  const [showOrdaModal, setShowOrdaModal] = useState(false);
  const [ordaToDeactivate, setOrdaToDeactivate] = useState<OrganisasiDaerahItem | null>(null);
  const [editingOrda, setEditingOrda] = useState<Partial<OrganisasiDaerahItem>>({
    organisasi_daerah_id: 0,
    kode_singkat: '',
    nama_organisasi: '',
    deskripsi_wilayah: '',
    status_aktif: true,
  });
  const [selectedOrdaTargetId, setSelectedOrdaTargetId] = useState<number | null>(null);
  const [selectedSantriIds, setSelectedSantriIds] = useState<Set<number>>(new Set());
  const [bulkOrdaSaving, setBulkOrdaSaving] = useState(false);

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
      setOrdaMasterList(response.data);
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

  const fetchEkstrakurikuler = async () => {
    try { const response = await api.get('/api/master/ekstrakurikuler'); setEkstrakurikuler(response.data); }
    catch { setMessage('Data ekstrakurikuler gagal dimuat.'); }
  };

  useEffect(() => { if (activeTab === 'ekstrakurikuler') void fetchEkstrakurikuler(); }, [activeTab]);

  const saveEkstrakurikuler = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = editingEkstrakurikuler.ekstrakurikuler_id
        ? await api.put(`/api/master/ekstrakurikuler/${editingEkstrakurikuler.ekstrakurikuler_id}`, editingEkstrakurikuler)
        : await api.post('/api/master/ekstrakurikuler', editingEkstrakurikuler);
      setMessage(response.data.message); setShowEkstrakurikulerModal(false); await fetchEkstrakurikuler();
    } catch (error: any) { setMessage(error.response?.data?.message ?? 'Ekstrakurikuler gagal disimpan.'); }
  };

  const deactivateEkstrakurikuler = async (id: number) => {
    try { const response = await api.delete(`/api/master/ekstrakurikuler/${id}`); setMessage(response.data.message); await fetchEkstrakurikuler(); }
    catch (error: any) { setMessage(error.response?.data?.message ?? 'Ekstrakurikuler gagal dinonaktifkan.'); }
  };

  const saveOrda = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = editingOrda.organisasi_daerah_id
        ? await api.put(`/api/master/organisasi-daerah/${editingOrda.organisasi_daerah_id}`, editingOrda)
        : await api.post('/api/master/organisasi-daerah', editingOrda);
      setMessage(res.data.message);
      setShowOrdaModal(false);
      await fetchOrda();
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Gagal menyimpan organisasi daerah.');
    }
  };

  const deactivateOrda = async (id: number) => {
    try { const response = await api.delete(`/api/master/organisasi-daerah/${id}`); setMessage(response.data.message); await fetchOrda(); }
    catch (error: any) { setMessage(error.response?.data?.message ?? 'Organisasi daerah gagal dinonaktifkan.'); }
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
  const editableAssignmentTypes = assignmentTypesForRole[editingPetugas.jabatan || ''] ?? [];
  const editableAssignmentOptions = opsi
    .filter(option => editableAssignmentTypes.some(tipeTarget => assignmentKindForType[tipeTarget] === option.jenis))
    .flatMap(option => {
      const tipeTarget = editableAssignmentTypes.find(type => assignmentKindForType[type] === option.jenis) || option.jenis;
      return option.targets.map(target => ({ key: assignmentKey(tipeTarget, target.target_id), label: `${option.nama}: ${target.nama_target}${target.unit_kode ? ` (${target.unit_kode})` : ''}` }));
    });
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
  const accountsPerPage = isMobileViewport ? 10 : 25;
  const totalAccountPages = Math.ceil(visibleAccounts.length / accountsPerPage) || 1;
  const paginatedAccounts = useMemo(() => {
    const start = (accountPage - 1) * accountsPerPage;
    return visibleAccounts.slice(start, start + accountsPerPage);
  }, [visibleAccounts, accountPage, accountsPerPage]);
  const wismaPerPage = isMobileViewport ? 10 : 25;
  const totalWismaPages = Math.ceil(kamar.length / wismaPerPage) || 1;
  const paginatedWisma = useMemo(() => {
    const start = (wismaPage - 1) * wismaPerPage;
    return kamar.slice(start, start + wismaPerPage);
  }, [kamar, wismaPage, wismaPerPage]);

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

  useEffect(() => {
    setAccountPage(1);
  }, [accountSearch, accountRole, accountStatus, accountAssignment, accountSort, accountSortDirection, isMobileViewport]);

  useEffect(() => {
    setWismaPage(1);
  }, [isMobileViewport]);

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

  const saveKamar = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = { nama: editingKamar.nama?.trim(), kode_singkat: editingKamar.kode_singkat?.trim() || null, status_aktif: editingKamar.status_aktif ?? true };
      const response = editingKamar.kamar_id
        ? await api.put(`/api/master/kamar/${editingKamar.kamar_id}`, payload)
        : await api.post('/api/master/kamar', payload);
      setMessage(response.data.message);
      setShowKamarModal(false);
      await fetchData();
    } catch (error: any) { setMessage(error.response?.data?.message ?? 'Data wisma/kamar gagal disimpan.'); }
  };

  const deactivateKamar = async (id: number) => {
    try { const response = await api.delete(`/api/master/kamar/${id}`); setMessage(response.data.message); await fetchData(); }
    catch (error: any) { setMessage(error.response?.data?.message ?? 'Wisma/kamar gagal dihapus.'); }
  };

  const openPetugasModal = (item?: Petugas) => {
    const nextPetugas = item
      ? { ...item, status_aktif: Boolean(item.status_aktif), password: '', password_confirmation: '' }
      : { petugas_id: 0, nama: '', username: '', no_hp: '', jabatan: 'Pembina Kamar', status_aktif: true, password: '', password_confirmation: '' };
    const nextAssignments = item
      ? penugasan.filter(assignment => assignment.petugas_id === item.petugas_id).map(assignment => assignmentKey(assignment.tipe_target, assignment.target_id))
      : [];
    setEditingPetugas(nextPetugas);
    setInitialEditingPetugas({ ...nextPetugas, password: '' });
    setEditingAssignments(nextAssignments);
    setInitialEditingAssignments(nextAssignments);
    setShowPetugasPassword(false);
    setShowPetugasPasswordConfirmation(false);
    setShowPetugasModal(true);
  };

  const savePetugas = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editingPetugas.password && editingPetugas.password !== editingPetugas.password_confirmation) {
      setMessage('');
      setErrorToast('Konfirmasi password tidak sama.');
      return;
    }
    const petugasId = editingPetugas.petugas_id;
    const accountFieldsChanged = ['nama', 'username', 'no_hp', 'jabatan', 'status_aktif'].some(field => editingPetugas[field as keyof typeof editingPetugas] !== initialEditingPetugas[field as keyof typeof initialEditingPetugas]) || Boolean(editingPetugas.password);
    const assignmentsChanged = [...editingAssignments].sort().join('|') !== [...initialEditingAssignments].sort().join('|');
    if (petugasId && !accountFieldsChanged && !assignmentsChanged) {
      setShowPetugasModal(false);
      setSuccessToast('Tidak ada perubahan untuk disimpan.');
      return;
    }
    try {
      const { password_confirmation, ...petugasFields } = editingPetugas;
      const payload = {
        nama: petugasFields.nama,
        username: petugasFields.username,
        no_hp: petugasFields.no_hp,
        jabatan: petugasFields.jabatan,
        status_aktif: petugasFields.status_aktif,
        password: editingPetugas.password || undefined,
        ...(editingPetugas.password ? { password_confirmation } : {}),
      };
      const response = petugasId
        ? await api.put(`/api/master/petugas/${petugasId}`, payload)
        : await api.post('/api/master/petugas', payload);
      if (petugasId && assignmentsChanged) {
        const initialKeys = new Set(initialEditingAssignments);
        const selectedKeys = new Set(editingAssignments);
        const removedAssignments = penugasan.filter(item => item.petugas_id === petugasId && !selectedKeys.has(assignmentKey(item.tipe_target, item.target_id)));
        const addedAssignments = editingAssignments.filter(key => !initialKeys.has(key)).map(key => {
          const [tipeTarget, targetId] = key.split(':');
          return { jenis: assignmentKindForType[tipeTarget], target_id: Number(targetId) };
        });
        await Promise.all([
          ...removedAssignments.map(item => api.delete(`/api/master/penugasan/${item.penugasan_id}`)),
          ...addedAssignments.map(item => api.post('/api/master/penugasan', { petugas_id: petugasId, ...item })),
        ]);
      }
      setMessage('');
      setSuccessToast(response.data.message);
      setShowPetugasModal(false);
      await fetchData();
    } catch (error: any) { setMessage(''); setErrorToast(error.response?.data?.message ?? 'Data petugas gagal disimpan.'); }
  };

  const deactivatePetugas = async (id: number) => {
    try { const response = await api.delete(`/api/master/petugas/${id}`); setMessage(''); setSuccessToast(response.data.message); await fetchData(); }
    catch (error: any) { setMessage(''); setErrorToast(error.response?.data?.message ?? 'Akun petugas gagal dinonaktifkan.'); }
  };

  const requestDeletePetugas = (item: Petugas) => setPetugasToDelete({ id: item.petugas_id, nama: item.nama });

  if (loading) return <PageSkeleton />;

  return (
    <div className="master-page">
      <header className="dashboard-header page-header">
        <h1>{isVerificationData ? 'Verifikasi Data' : 'Data Master'}</h1>
        <p>{isVerificationData ? 'Selesaikan data yang belum tervalidasi sebelum dipakai untuk operasional absensi.' : 'Kelola data referensi santri, alumni, ORDA, ekstrakurikuler, dan wisma.'}</p>
      </header>
      {successToast && <div className="success-toast" role="status" aria-live="polite">{successToast}</div>}
      {errorToast && <div className="error-toast" role="alert" aria-live="assertive">{errorToast}</div>}
      {message && <div className="warning-box" style={{ marginBottom: 16 }}>{message}</div>}

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
            <AppDropdown
              id="santri-unit"
              label="Unit Pendidikan"
              value={santriUnitFilter}
              onChange={setSantriUnitFilter}
              placeholder="Semua Unit"
              options={[{ value: '', label: 'Semua Unit' }, ...unitOptions.map(u => ({ value: String(u.unit_id), label: `${u.kode} - ${u.nama}` }))]}
            />
            <AppDropdown
              id="santri-kamar"
              label="Filter Kamar"
              value={santriKamarFilter}
              onChange={setSantriKamarFilter}
              placeholder="Semua Kamar"
              options={[{ value: '', label: 'Semua Kamar' }, ...kamar.map(k => ({ value: String(k.kamar_id), label: k.nama }))]}
            />
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
          <div className="section-heading"><div><h2>Data ekstrakurikuler</h2><p>Kelola kode, nama kegiatan, dan pembimbing ekstrakurikuler.</p></div><button className="primary-button" onClick={() => { setEditingEkstrakurikuler({ ekstrakurikuler_id: 0, kode: '', nama: '', pembimbing_id: null, status_aktif: true }); setShowEkstrakurikulerModal(true); }}>+ Tambah Ekstrakurikuler</button></div>
          <div className="table-scroll"><table className="master-table account-like-table"><thead><tr><th>Kode</th><th>Nama ekstrakurikuler</th><th>Pembimbing</th><th>Status</th><th className="account-action-column">Aksi</th></tr></thead><tbody>{ekstrakurikuler.map(item => { const isActive = Boolean(item.status_aktif); return <tr key={item.ekstrakurikuler_id}><td><strong>{item.kode}</strong></td><td>{item.nama}</td><td>{item.nama_pembimbing || 'Belum ditentukan'}</td><td><span className={isActive ? 'schedule-label' : 'warning-text'}>{isActive ? 'Aktif' : 'Nonaktif'}</span></td><td className="account-action-cell"><div className="account-actions"><button type="button" className="secondary-button account-action-edit" aria-label={`Edit ekstrakurikuler ${item.nama}`} title="Edit ekstrakurikuler" onClick={() => { setEditingEkstrakurikuler({ ...item, status_aktif: isActive }); setShowEkstrakurikulerModal(true); }}><PencilIcon /></button>{isActive && <button type="button" className="danger-button account-action-delete" onClick={() => setEkstrakurikulerToDeactivate(item)}>Nonaktif</button>}</div></td></tr>; })}</tbody></table>{ekstrakurikuler.length === 0 && <div className="empty-state">Belum ada data ekstrakurikuler.</div>}</div>
          {showEkstrakurikulerModal && <div className="save-modal-backdrop" role="presentation"><div className="save-modal" style={{ maxWidth: '500px', width: '90%', textAlign: 'left' }} role="dialog" aria-modal="true"><h2>{editingEkstrakurikuler.ekstrakurikuler_id ? 'Edit Ekstrakurikuler' : 'Tambah Ekstrakurikuler'}</h2><form onSubmit={e => void saveEkstrakurikuler(e)} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}><div><label className="ui-text-label" htmlFor="ekstra-kode">Kode Ekstrakurikuler</label><input id="ekstra-kode" className="raport-select" style={{ width: '100%' }} required value={editingEkstrakurikuler.kode || ''} onChange={e => setEditingEkstrakurikuler(p => ({ ...p, kode: e.target.value }))} placeholder="Contoh: PRAMUKA" /></div><div><label className="ui-text-label" htmlFor="ekstra-nama">Nama Ekstrakurikuler</label><input id="ekstra-nama" className="raport-select" style={{ width: '100%' }} required value={editingEkstrakurikuler.nama || ''} onChange={e => setEditingEkstrakurikuler(p => ({ ...p, nama: e.target.value }))} placeholder="Contoh: Pramuka" /></div><div><label className="ui-text-label" htmlFor="ekstra-pembimbing">Pembimbing Ekstrakurikuler</label><select id="ekstra-pembimbing" className="raport-select" style={{ width: '100%' }} value={editingEkstrakurikuler.pembimbing_id ?? ''} onChange={e => setEditingEkstrakurikuler(p => ({ ...p, pembimbing_id: e.target.value ? Number(e.target.value) : null }))}><option value="">Pilih pembimbing</option>{petugas.filter(item => Boolean(item.status_aktif)).map(item => <option key={item.petugas_id} value={item.petugas_id}>{item.nama} — {item.jabatan}</option>)}</select></div><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input id="ekstra-aktif" type="checkbox" checked={Boolean(editingEkstrakurikuler.status_aktif)} onChange={e => setEditingEkstrakurikuler(p => ({ ...p, status_aktif: e.target.checked }))} /><label htmlFor="ekstra-aktif" className="ui-text-label" style={{ marginBottom: 0 }}>Status Aktif</label></div><div className="save-modal-actions" style={{ marginTop: '16px' }}><button type="button" className="secondary-button" onClick={() => setShowEkstrakurikulerModal(false)}>Batal</button><button type="submit" className="primary-button">Simpan</button></div></form></div></div>}
          {ekstrakurikulerToDeactivate && <div className="delete-modal-backdrop" role="presentation"><section className="delete-modal" role="dialog" aria-modal="true"><div className="delete-modal-content"><span className="delete-modal-eyebrow">Konfirmasi tindakan</span><h2>Jadikan ekstrakurikuler nonaktif?</h2><p>Ekstrakurikuler <strong>{ekstrakurikulerToDeactivate.nama}</strong> tidak akan tersedia untuk penetapan baru.</p></div><div className="delete-modal-actions"><button type="button" className="secondary-button delete-modal-cancel" onClick={() => setEkstrakurikulerToDeactivate(null)}>Batal</button><button type="button" className="danger-button delete-modal-confirm" onClick={() => { const id = ekstrakurikulerToDeactivate.ekstrakurikuler_id; setEkstrakurikulerToDeactivate(null); void deactivateEkstrakurikuler(id); }}>Nonaktif</button></div></section></div>}
        </section>
      )}

      {!isVerificationData && activeTab === 'wisma' && (
        <section className="master-section">
          <div className="section-heading"><div><h2>Data wisma</h2><p>Kelola nama, kode, dan status wisma/kamar yang digunakan dalam penempatan santri.</p></div><button className="primary-button" onClick={() => { setEditingKamar({ kamar_id: 0, nama: '', kode_singkat: '', status_aktif: true }); setShowKamarModal(true); }}>+ Tambah Wisma</button></div>
          <div className="table-scroll"><table className="master-table account-like-table"><thead><tr><th>No.</th><th>Nama wisma/kamar</th><th>Kode</th><th>Status</th><th className="account-action-column">Aksi</th></tr></thead><tbody>{paginatedWisma.map((item, index) => { const isActive = Boolean(item.status_aktif); return <tr key={item.kamar_id}><td>{(wismaPage - 1) * wismaPerPage + index + 1}</td><td>{item.nama}</td><td>{item.kode_singkat || '—'}</td><td><span className={isActive ? 'schedule-label' : 'warning-text'}>{isActive ? 'Aktif' : 'Nonaktif'}</span></td><td className="account-action-cell"><div className="account-actions"><button type="button" className="secondary-button account-action-edit" aria-label={`Edit wisma ${item.nama}`} title="Edit wisma" onClick={() => { setEditingKamar({ ...item, status_aktif: isActive }); setShowKamarModal(true); }}><PencilIcon /></button>{isActive && <button type="button" className="danger-button account-action-delete" onClick={() => setKamarToDeactivate(item)}>Nonaktif</button>}</div></td></tr>; })}</tbody></table>{kamar.length === 0 && <div className="empty-state">Belum ada data kamar untuk ditampilkan.</div>}</div>
          {totalWismaPages > 1 && <div className="pagination-controls" aria-label="Paginasi data wisma"><button className="secondary-button" disabled={wismaPage === 1} onClick={() => setWismaPage(page => Math.max(1, page - 1))}>← Sebelumnya</button><span>Halaman {wismaPage} dari {totalWismaPages}</span><button className="secondary-button" disabled={wismaPage === totalWismaPages} onClick={() => setWismaPage(page => Math.min(totalWismaPages, page + 1))}>Berikutnya →</button></div>}
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
              <span className="stat-card-value">{reviewLoading ? <ValuePulse width={40} /> : validReviewList.filter(r => r.status === 'perlu_tinjau').length}</span>
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
              <span className="stat-card-value" style={{ color: '#d97706' }}>{reviewLoading ? <ValuePulse width={40} /> : validReviewList.filter(r => r.status === 'perlu_mapping_kamar').length}</span>
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
              <span className="stat-card-value" style={{ color: '#16a34a' }}>{reviewLoading ? <ValuePulse width={40} /> : validReviewList.filter(r => r.status === 'digabung').length}</span>
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
              <span className="stat-card-value" style={{ color: '#6b7280' }}>{reviewLoading ? <ValuePulse width={40} /> : validReviewList.filter(r => r.status === 'terpisah').length}</span>
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
            <AppDropdown
              id="review-status"
              label="Status"
              value={reviewStatusFilter}
              onChange={setReviewStatusFilter}
              placeholder="Semua Status"
              options={[
                { value: '', label: 'Semua Status' },
                { value: 'perlu_tinjau', label: 'Perlu Tinjau' },
                { value: 'perlu_mapping_kamar', label: 'Perlu Mapping Kamar' },
                { value: 'digabung', label: 'Digabung' },
                { value: 'terpisah', label: 'Terpisah' },
              ]}
            />
            <AppDropdown
              id="review-sheet"
              label="Sumber File/Sheet"
              value={reviewSheetFilter}
              onChange={setReviewSheetFilter}
              placeholder="Semua Sumber"
              options={[
                { value: '', label: 'Semua Sumber' },
                { value: 'Database Siswa', label: 'Database Siswa' },
                { value: 'Database Siswa Madin', label: 'Database Siswa Madin' },
                { value: "Database Al-Qur'an", label: "Database Al-Qur'an" },
                { value: 'Database Takhassus', label: 'Database Takhassus' },
              ]}
            />
          </div>

          <p className="account-result-count">
            {reviewLoading ? <><Spinner size="sm" /> Memuat data review kemiripan...</> : `Menampilkan ${validReviewList.length} baris review kemiripan data yang memiliki kandidat.`}
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
        <div className="section-heading"><div><h2>Akun petugas</h2><p>Kelola akun, jabatan, status, dan akses login petugas.</p></div><button className="primary-button" onClick={() => openPetugasModal()}>+ Tambah Petugas</button></div>
        <div className="account-table-controls">
          <div className="account-search-control"><label htmlFor="account-search">Cari akun</label><input id="account-search" value={accountSearch} onChange={event => setAccountSearch(event.target.value)} placeholder="Nama, username, kelas..." /></div>
          <AppDropdown id="account-role" label="Jabatan" value={accountRole} onChange={setAccountRole} placeholder="Semua jabatan" options={[{ value: '', label: 'Semua jabatan' }, ...accountRoles.map(role => ({ value: role, label: role }))]} />
          <AppDropdown id="account-assignment" label="Penugasan" value={accountAssignment} onChange={setAccountAssignment} placeholder="Semua" options={[{ value: '', label: 'Semua' }, { value: 'ditugaskan', label: 'Ada penugasan' }, { value: 'belum', label: 'Belum ditugaskan' }]} />
          <AppDropdown id="account-status" label="Status akun" value={accountStatus} onChange={setAccountStatus} placeholder="Aktif" options={[{ value: '', label: 'Semua status' }, { value: 'aktif', label: 'Aktif' }, { value: 'nonaktif', label: 'Nonaktif' }]} />
        </div>
        <p className="account-result-count">Menampilkan {visibleAccounts.length === 0 ? 0 : (accountPage - 1) * accountsPerPage + 1}–{Math.min(accountPage * accountsPerPage, visibleAccounts.length)} dari {visibleAccounts.length} akun.</p>
        <div className="table-scroll"><table className="master-table account-table"><thead><tr><th><button className="table-sort-button" onClick={() => toggleAccountSort('nama')}>Nama{accountSortIndicator('nama')}</button></th><th><button className="table-sort-button" onClick={() => toggleAccountSort('username')}>Username{accountSortIndicator('username')}</button></th><th><button className="table-sort-button" onClick={() => toggleAccountSort('jabatan')}>Jabatan{accountSortIndicator('jabatan')}</button></th><th><button className="table-sort-button" onClick={() => toggleAccountSort('tanggung_jawab_absensi')}>Tanggung Jawab Absensi{accountSortIndicator('tanggung_jawab_absensi')}</button></th><th>Status</th><th>Aksi</th></tr></thead><tbody>{paginatedAccounts.map(item => <tr key={item.petugas_id}><td>{item.nama}</td><td>{item.username}</td><td>{item.jabatan}</td><td>{item.tanggung_jawab_absensi || '-'}</td><td><span className={item.status_aktif ? 'schedule-label' : 'warning-text'}>{item.status_aktif ? 'Aktif' : 'Nonaktif'}</span></td><td><div className="account-actions"><button type="button" className="secondary-button account-action-edit" aria-label={`Edit petugas ${item.nama}`} title="Edit petugas" onClick={() => openPetugasModal(item)}><PencilIcon /></button>{item.status_aktif ? <button className="danger-button account-action-delete" onClick={() => requestDeletePetugas(item)}>Nonaktif</button> : null}</div></td></tr>)}</tbody></table>{visibleAccounts.length === 0 && <div className="empty-state">Tidak ada akun yang sesuai dengan filter.</div>}</div>
        {totalAccountPages > 1 && <div className="pagination-controls" aria-label="Pilih halaman akun petugas"><button className="secondary-button" disabled={accountPage <= 1} onClick={() => setAccountPage(page => Math.max(1, page - 1))}>← Sebelumnya</button><div className="pagination-pages">{getPaginationItems(accountPage, totalAccountPages).map((item, index) => item === 'ellipsis' ? <span className="pagination-ellipsis" key={`account-ellipsis-${index}`} aria-hidden="true">…</span> : <button type="button" className={`pagination-page${accountPage === item ? ' active' : ''}`} aria-label={`Halaman ${item}`} aria-current={accountPage === item ? 'page' : undefined} onClick={() => setAccountPage(item)} key={item}>{item}</button>)}</div><button className="secondary-button" disabled={accountPage >= totalAccountPages} onClick={() => setAccountPage(page => Math.min(totalAccountPages, page + 1))}>Berikutnya →</button></div>}
      </section>}

      {/* DATA ALUMNI TAB */}
      {!isVerificationData && activeTab === 'alumni' && (
        <section className="master-section">
          <div className="section-heading">
            <div>
              <h2>Data Alumni Santri</h2>
              <p>{alumniLoading ? 'Memuat data alumni Pondok Pesantren Tebuireng...' : `Seluruh data alumni Pondok Pesantren Tebuireng (${alumniStats.total.toLocaleString('id')} alumni terdaftar).`}</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="dashboard-grid-premium" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <span className="stat-card-value">{alumniLoading ? <ValuePulse width={56} /> : alumniStats.total.toLocaleString('id')}</span>
              <span className="stat-card-label">Total Alumni</span>
            </div>
            {alumniStats.by_jenjang.slice(0, 2).map(item => (
              <div key={item.jenjang} className="stat-card">
                <span className="stat-card-value" style={{ color: '#0284c7' }}>{alumniLoading ? <ValuePulse width={48} /> : item.jumlah.toLocaleString('id')}</span>
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
            <AppDropdown id="alumni-jenjang" label="Jenjang" value={alumniJenjangFilter} onChange={setAlumniJenjangFilter} placeholder="Semua Jenjang" options={[{ value: '', label: 'Semua Jenjang' }, ...alumniStats.by_jenjang.map(j => ({ value: j.jenjang, label: `${j.jenjang} (${j.jumlah.toLocaleString('id')})` }))]} />
            <AppDropdown id="alumni-jk" label="L/P" value={alumniJkFilter} onChange={setAlumniJkFilter} placeholder="Semua" options={[{ value: '', label: 'Semua' }, { value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }]} />
          </div>

          <p className="account-result-count">
            {alumniLoading ? <><Spinner size="sm" /> Memuat data alumni...</> : `Menampilkan ${Math.min(alumniPage * 100, alumniList.length)} dari ${alumniList.length.toLocaleString('id')} alumni.`}
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
              Master Orda ({ordaList.length})
            </button>
            <button
              className={`secondary-button ${ordaSubTab === 'mapping' ? 'active' : ''}`}
              style={{ background: ordaSubTab === 'mapping' ? 'var(--aksen)' : undefined, color: ordaSubTab === 'mapping' ? '#fff' : undefined }}
              onClick={() => setOrdaSubTab('mapping')}
            >
              Pemetaan Bulk Santri
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
                    <th className="account-action-column">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {ordaMasterList.map((o, idx) => (
                    <tr key={o.organisasi_daerah_id}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td><strong>{o.kode_singkat}</strong></td>
                      <td>{o.nama_organisasi}</td>
                      <td>{o.deskripsi_wilayah || <small style={{ color: '#888' }}>—</small>}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{o.total_santri} santri</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`status-pill ${o.status_aktif ? 'status-hadir' : 'status-alpha'}`}>
                          {o.status_aktif ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="account-action-cell">
                        <div className="account-actions">
                          <button type="button" className="secondary-button account-action-edit" aria-label={`Edit ORDA ${o.nama_organisasi}`} title="Edit ORDA" onClick={() => { setEditingOrda({ ...o, status_aktif: Boolean(o.status_aktif) }); setShowOrdaModal(true); }}><PencilIcon /></button>
                          {Boolean(o.status_aktif) && <button type="button" className="danger-button account-action-delete" onClick={() => setOrdaToDeactivate(o)}>Nonaktif</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ordaMasterList.length === 0 && !ordaLoading && (
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
                    {ordaMasterList.filter(o => o.status_aktif).map(o => (
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
                  Pilih Semua ({filteredSantri.length})
                </button>
                <button
                  className="secondary-button"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => setSelectedSantriIds(new Set())}
                >
                  Batal Pilih All
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
                <div className="pagination-controls">
                  <button type="button" className="secondary-button" disabled={santriPage <= 1} onClick={() => setSantriPage(p => Math.max(1, p - 1))}>
                    ← Sebelumnya
                  </button>
                  <div className="pagination-pages" aria-label="Pilih halaman pemetaan ORDA">
                    {getPaginationItems(santriPage, totalSantriPages).map((item, index) => item === 'ellipsis' ? (
                      <span className="pagination-ellipsis" key={`mapping-ellipsis-${index}`} aria-hidden="true">…</span>
                    ) : (
                      <button type="button" className={`pagination-page${santriPage === item ? ' active' : ''}`} aria-label={`Halaman ${item}`} aria-current={santriPage === item ? 'page' : undefined} onClick={() => setSantriPage(item)} key={item}>
                        {item}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="secondary-button" disabled={santriPage >= totalSantriPages} onClick={() => setSantriPage(p => Math.min(totalSantriPages, p + 1))}>
                    Berikutnya →
                  </button>
                </div>
              )}
            </div>
          )}

          {showKamarModal && (
            <div className="save-modal-backdrop" role="presentation">
              <div className="save-modal" style={{ maxWidth: '500px', width: '90%', textAlign: 'left' }} role="dialog">
                <h2>{editingKamar.kamar_id ? 'Edit Wisma/Kamar' : 'Tambah Wisma/Kamar'}</h2>
                <form onSubmit={e => void saveKamar(e)} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                  <div><label className="ui-text-label" htmlFor="kamar-nama">Nama Wisma/Kamar</label><input id="kamar-nama" className="raport-select" style={{ width: '100%' }} required value={editingKamar.nama || ''} onChange={e => setEditingKamar(p => ({ ...p, nama: e.target.value }))} /></div>
                  <div><label className="ui-text-label" htmlFor="kamar-kode">Kode Singkat</label><input id="kamar-kode" className="raport-select" style={{ width: '100%' }} value={editingKamar.kode_singkat || ''} onChange={e => setEditingKamar(p => ({ ...p, kode_singkat: e.target.value }))} placeholder="Contoh: HK 201" /></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input id="kamar-aktif" type="checkbox" checked={editingKamar.status_aktif !== false} onChange={e => setEditingKamar(p => ({ ...p, status_aktif: e.target.checked }))} /><label htmlFor="kamar-aktif" className="ui-text-label" style={{ marginBottom: 0 }}>Status Aktif</label></div>
                  <div className="save-modal-actions" style={{ marginTop: '16px' }}><button type="button" className="secondary-button" onClick={() => setShowKamarModal(false)}>Batal</button><button type="submit" className="primary-button">Simpan</button></div>
                </form>
              </div>
            </div>
          )}

          {kamarToDeactivate && (
            <div className="delete-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setKamarToDeactivate(null); }}>
              <section className="delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-kamar-title">
                <div className="delete-modal-content"><span className="delete-modal-eyebrow">Konfirmasi tindakan</span><h2 id="delete-kamar-title">Jadikan wisma nonaktif?</h2><p>Wisma/kamar <strong>{kamarToDeactivate.nama}</strong> tidak akan tersedia untuk penempatan baru. Histori penugasan tetap dipertahankan.</p></div>
                <div className="delete-modal-actions"><button type="button" className="secondary-button delete-modal-cancel" onClick={() => setKamarToDeactivate(null)}>Batal</button><button type="button" className="danger-button delete-modal-confirm" onClick={() => { const id = kamarToDeactivate.kamar_id; setKamarToDeactivate(null); void deactivateKamar(id); }}>Nonaktif</button></div>
              </section>
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

          {ordaToDeactivate && (
            <div className="delete-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOrdaToDeactivate(null); }}>
              <section className="delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-orda-title">
                <div className="delete-modal-content"><span className="delete-modal-eyebrow">Konfirmasi tindakan</span><h2 id="delete-orda-title">Jadikan ORDA nonaktif?</h2><p>ORDA <strong>{ordaToDeactivate.nama_organisasi}</strong> tidak akan tersedia untuk pemetaan baru. Data santri yang sudah terhubung tetap dipertahankan.</p></div>
                <div className="delete-modal-actions"><button type="button" className="secondary-button delete-modal-cancel" onClick={() => setOrdaToDeactivate(null)}>Batal</button><button type="button" className="danger-button delete-modal-confirm" onClick={() => { const id = ordaToDeactivate.organisasi_daerah_id; setOrdaToDeactivate(null); void deactivateOrda(id); }}>Nonaktif</button></div>
              </section>
            </div>
          )}
        </section>
      )}

      {showPetugasModal && (
        <div className="save-modal-backdrop" role="presentation">
          <div className="save-modal" style={{ maxWidth: '500px', width: '90%', textAlign: 'left' }} role="dialog" aria-labelledby="petugas-modal-title">
            <h2 id="petugas-modal-title">{editingPetugas.petugas_id ? 'Edit Petugas' : 'Tambah Petugas'}</h2>
            <form onSubmit={e => void savePetugas(e)} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div><label className="ui-text-label" htmlFor="petugas-nama">Nama</label><input id="petugas-nama" className="raport-select" style={{ width: '100%' }} required value={editingPetugas.nama || ''} onChange={e => setEditingPetugas(p => ({ ...p, nama: e.target.value }))} /></div>
              <div><label className="ui-text-label" htmlFor="petugas-username">Username</label><input id="petugas-username" className="raport-select" style={{ width: '100%' }} required value={editingPetugas.username || ''} onChange={e => setEditingPetugas(p => ({ ...p, username: e.target.value }))} /></div>
              <div><label className="ui-text-label" htmlFor="petugas-no-hp">No. HP</label><input id="petugas-no-hp" className="raport-select" style={{ width: '100%' }} value={editingPetugas.no_hp || ''} onChange={e => setEditingPetugas(p => ({ ...p, no_hp: e.target.value }))} /></div>
              <AppDropdown id="petugas-jabatan" label="Jabatan" value={editingPetugas.jabatan || ''} options={['Admin', 'Pengasuh', 'Ustadz', 'Pembina Kamar', 'Wali Kelas', 'Keamanan'].map(role => ({ value: role, label: role }))} onChange={value => { setEditingPetugas(p => ({ ...p, jabatan: value })); setEditingAssignments(current => { const compatible = current.filter(key => (assignmentTypesForRole[value] ?? []).includes(key.split(':')[0])); return value === 'Admin' ? compatible : compatible.slice(0, 1); }); }} />
              <div><label className="ui-text-label" htmlFor="petugas-password">Password {editingPetugas.petugas_id ? '(opsional)' : ''}</label><div className="password-field petugas-password-field"><input id="petugas-password" type={showPetugasPassword ? 'text' : 'password'} className="raport-select petugas-password-input" style={{ width: '100%' }} required={!editingPetugas.petugas_id} minLength={8} value={editingPetugas.password || ''} onChange={e => setEditingPetugas(p => ({ ...p, password: e.target.value, password_confirmation: e.target.value ? p.password_confirmation : '' }))} placeholder={editingPetugas.petugas_id ? 'Kosongkan jika tidak diubah' : 'Minimal 8 karakter'} /><button type="button" className="password-toggle" onClick={() => setShowPetugasPassword(value => !value)} aria-label={showPetugasPassword ? 'Sembunyikan password' : 'Tampilkan password'} title={showPetugasPassword ? 'Sembunyikan password' : 'Tampilkan password'}><EyeIcon hidden={showPetugasPassword} /></button></div>{editingPetugas.petugas_id && <small className="field-hint">Isi password baru jika ingin mereset password akun ini.</small>}</div>
              {editingPetugas.password && <div><label className="ui-text-label" htmlFor="petugas-password-confirmation">Konfirmasi Password</label><div className="password-field petugas-password-field"><input id="petugas-password-confirmation" type={showPetugasPasswordConfirmation ? 'text' : 'password'} className="raport-select petugas-password-input" style={{ width: '100%' }} required minLength={8} value={editingPetugas.password_confirmation || ''} onChange={e => setEditingPetugas(p => ({ ...p, password_confirmation: e.target.value }))} placeholder="Ulangi password baru" /><button type="button" className="password-toggle" onClick={() => setShowPetugasPasswordConfirmation(value => !value)} aria-label={showPetugasPasswordConfirmation ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'} title={showPetugasPasswordConfirmation ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'}><EyeIcon hidden={showPetugasPasswordConfirmation} /></button></div></div>}
              {editingPetugas.jabatan === 'Admin' ? <AssignmentMultiDropdown id="petugas-tanggung-jawab" label="Tanggung Jawab Absensi" value={editingAssignments} options={editableAssignmentOptions} disabled={!editingPetugas.petugas_id || editableAssignmentOptions.length === 0} onChange={setEditingAssignments} /> : <AppDropdown id="petugas-tanggung-jawab" label="Tanggung Jawab Absensi" value={editingAssignments[0] || ''} options={editableAssignmentOptions.map(option => ({ value: option.key, label: option.label }))} placeholder="Pilih kelas/kamar" disabled={!editingPetugas.petugas_id || editableAssignmentOptions.length === 0} onChange={value => setEditingAssignments(value ? [value] : [])} />}
              <small className="field-hint assignment-field-hint">{editingPetugas.jabatan === 'Admin' ? 'Admin dapat memiliki beberapa penugasan.' : 'Satu akun hanya dapat memiliki satu tanggung jawab absensi sesuai jabatannya.'}</small>
              <div className="account-status-field"><label htmlFor="petugas-aktif" className="account-status-label"><input id="petugas-aktif" className="account-status-checkbox" type="checkbox" checked={editingPetugas.status_aktif === true} onChange={e => setEditingPetugas(p => ({ ...p, status_aktif: e.target.checked }))} /><span className="account-status-box" aria-hidden="true" /><span className="account-status-text">Status Aktif</span></label></div>
              <div className="save-modal-actions" style={{ marginTop: '16px' }}><button type="button" className="secondary-button" onClick={() => setShowPetugasModal(false)}>Batal</button><button type="submit" className="primary-button">Simpan</button></div>
            </form>
          </div>
        </div>
      )}

      {petugasToDelete && (
        <div className="delete-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPetugasToDelete(null); }}>
          <section className="delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-petugas-title" aria-describedby="delete-petugas-description">
            <div className="delete-modal-content">
              <span className="delete-modal-eyebrow">Konfirmasi tindakan</span>
              <h2 id="delete-petugas-title">Jadikan akun nonaktif?</h2>
              <p id="delete-petugas-description">Akun <strong>{petugasToDelete.nama}</strong> akan dinonaktifkan dan akses loginnya dicabut. Riwayat penugasan tetap dipertahankan.</p>
            </div>
            <div className="delete-modal-actions">
              <button type="button" className="secondary-button delete-modal-cancel" onClick={() => setPetugasToDelete(null)}>Batal</button>
              <button type="button" className="danger-button delete-modal-confirm" onClick={() => { const id = petugasToDelete.id; setPetugasToDelete(null); void deactivatePetugas(id); }}>Nonaktif</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
