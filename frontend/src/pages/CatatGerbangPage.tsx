import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { AppDropdown } from '../components/AppDropdown';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { usePageMeta } from '../hooks/usePageMeta';

interface SantriResult { santri_id: number; nama: string; nis: string | null; nama_kamar: string | null }
interface JenisIzin { jenis_izin_id: number; nama: string }
interface PerizinanRecord {
  perizinan_id: number;
  santri_id: number;
  nama_santri: string;
  nis: string | null;
  keperluan: string;
  status: 'Disetujui' | 'Sedang Berjalan' | 'Selesai' | 'Dibatalkan' | 'Kadaluarsa';
  tanggal_mulai: string;
  rencana_kembali: string;
  waktu_keluar_aktual?: string | null;
  waktu_masuk_aktual?: string | null;
}

type Feedback = { text: string; type: 'success' | 'error' };
type GateAction = { id: number; nama: string; type: 'keluar' | 'masuk' };
type GateCorrection = {
  id: number;
  nama: string;
  keluar: string;
  masuk: string;
  keluarAwal: string;
  masukAwal: string;
  jadwalKeluar: string;
  jadwalMasuk: string;
};

type PaginationItem = number | 'ellipsis';

const getPaginationItems = (current: number, total: number): PaginationItem[] => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, 6, 'ellipsis', total];
  if (current >= total - 3) return [1, 'ellipsis', total - 5, total - 4, total - 3, total - 2, total - 1, total];
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
};

const jakartaDateTime = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
};

const isWibTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const isWibDateTime = (value: string) => {
  const [date, time] = value.split('T');
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && isWibTime(time ?? '');
};
const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'));

function DateTimeWibField({ id, label, value, min, onChange, required = true }: { id: string; label: string; value: string; min?: string; onChange: (value: string) => void; required?: boolean }) {
  const [date = '', time = ''] = value.split('T');
  const [hour = '', minute = ''] = time.split(':');
  const [minDate] = min?.split('T') ?? [];
  const updateTime = (nextHour: string, nextMinute: string) => {
    const currentDate = date || minDate || jakartaDateTime().split('T')[0];
    onChange(`${currentDate}T${nextHour && nextMinute ? `${nextHour}:${nextMinute}` : ''}`);
  };
  return (
    <div className="datetime-wib-field">
      <label htmlFor={`${id}-date`}>{label}</label>
      <div className="datetime-wib-inputs">
        <input id={`${id}-date`} type="date" value={date} min={minDate} onChange={event => onChange(`${event.target.value}T${time}`)} required={required} />
        <div className="time-picker" aria-label={`${label}, waktu 24 jam`}>
          <select id={`${id}-hour`} value={hour} onChange={event => updateTime(event.target.value, minute)} required={required} aria-label={`${label}, jam`}>
            <option value="">Jam</option>
            {hours.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <span aria-hidden="true">:</span>
          <select id={`${id}-minute`} value={minute} onChange={event => updateTime(hour, event.target.value)} required={required} aria-label={`${label}, menit`}>
            <option value="">Menit</option>
            {minutes.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination-controls">
      <button type="button" className="secondary-button" disabled={currentPage <= 1} onClick={() => onPageChange(Math.max(1, currentPage - 1))}>
        ← Sebelumnya
      </button>
      <div className="pagination-pages" aria-label="Pilih halaman catatan gerbang">
        {getPaginationItems(currentPage, totalPages).map((item, index) => item === 'ellipsis' ? (
          <span className="pagination-ellipsis" key={`ellipsis-${index}`} aria-hidden="true">…</span>
        ) : (
          <button type="button" className={`pagination-page${currentPage === item ? ' active' : ''}`} aria-label={`Halaman ${item}`} aria-current={currentPage === item ? 'page' : undefined} onClick={() => onPageChange(item)} key={item}>
            {item}
          </button>
        ))}
      </div>
      <button type="button" className="secondary-button" disabled={currentPage >= totalPages} onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}>
        Berikutnya →
      </button>
    </div>
  );
}

export function CatatGerbangPage() {
  const { user } = useAuth();
  usePageMeta({
    title: 'Catat Izin & Gerbang',
    description: 'Catat perizinan keluar santri dan verifikasi pos gerbang Pondok Pesantren Tebuireng.',
  });

  const [activeList, setActiveList] = useState<PerizinanRecord[]>([]);
  const [inactiveList, setInactiveList] = useState<PerizinanRecord[]>([]);
  const [jenisList, setJenisList] = useState<JenisIzin[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SantriResult[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [selectedSantri, setSelectedSantri] = useState<SantriResult | null>(null);
  const [jenisId, setJenisId] = useState('');
  const [keperluan, setKeperluan] = useState('');
  const [tanggalMulai, setTanggalMulai] = useState(jakartaDateTime());
  const [rencanaKembali, setRencanaKembali] = useState(jakartaDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [toast, setToast] = useState<Feedback | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  const [pendingGateAction, setPendingGateAction] = useState<GateAction | null>(null);
  const [gateActionTime, setGateActionTime] = useState(jakartaDateTime());
  const [correction, setCorrection] = useState<GateCorrection | null>(null);
  const [savingCorrection, setSavingCorrection] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Collapsible form & segmented sub-tabs state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'aktif' | 'riwayat'>('aktif');

  // Filter perizinan tidak aktif
  const [inactiveSearch, setInactiveSearch] = useState('');
  const [inactiveStatusFilter, setInactiveStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination State (10 items per page)
  const ITEMS_PER_PAGE = 10;
  const [activePage, setActivePage] = useState(1);
  const [inactivePage, setInactivePage] = useState(1);

  const fetchData = async () => {
    const [activeRes, inactiveRes, jenisRes] = await Promise.all([
      api.get('/api/perizinan?status=Disetujui,Sedang Berjalan'),
      api.get('/api/perizinan?status=Selesai,Dibatalkan,Kadaluarsa'),
      api.get('/api/perizinan-jenis'),
    ]);
    setActiveList(activeRes.data);
    setInactiveList(inactiveRes.data);
    setJenisList(jenisRes.data);
    if (!jenisId && jenisRes.data[0]) setJenisId(String(jenisRes.data[0].jenis_izin_id));
  };

  useEffect(() => {
    fetchData().catch(() => setToast({ text: 'Data perizinan tidak dapat dimuat. Periksa koneksi lalu muat ulang halaman.', type: 'error' })).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedSantri || search.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api.get('/api/santri', { params: { q: search.trim() } })
        .then(response => {
          setResults(response.data);
          setActiveResultIndex(-1);
        })
        .catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, selectedSantri]);

  useEffect(() => {
    if (!pendingGateAction && !correction) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusModal = () => modalRef.current?.querySelector<HTMLElement>('input, button, select, textarea')?.focus();
    const focusTimer = window.setTimeout(focusModal, 0);

    const handleDialogKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPendingGateAction(null);
        setCorrection(null);
        return;
      }

      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) return;

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

    document.addEventListener('keydown', handleDialogKeydown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleDialogKeydown);
      previouslyFocused?.focus();
    };
  }, [Boolean(pendingGateAction), Boolean(correction)]);

  const filteredInactiveList = useMemo(() => {
    const q = inactiveSearch.trim().toLowerCase();
    return inactiveList.filter(item => {
      const matchSearch = !q || [item.nama_santri, item.nis ?? '', item.keperluan]
        .some(val => val.toLowerCase().includes(q));
      const matchStatus = !inactiveStatusFilter || item.status.toLowerCase() === inactiveStatusFilter.toLowerCase();
      const waktuMulai = new Date(item.tanggal_mulai.replace(' ', 'T')).getTime();
      const matchStart = !startDate || waktuMulai >= new Date(`${startDate}T00:00:00`).getTime();
      const matchEnd = !endDate || waktuMulai <= new Date(`${endDate}T23:59:59`).getTime();
      return matchSearch && matchStatus && matchStart && matchEnd;
    });
  }, [inactiveList, inactiveSearch, inactiveStatusFilter, startDate, endDate]);

  useEffect(() => {
    setInactivePage(1);
  }, [inactiveSearch, inactiveStatusFilter, startDate, endDate]);

  const activeTotalPages = Math.ceil(activeList.length / ITEMS_PER_PAGE) || 1;
  const paginatedActiveList = useMemo(() => {
    const start = (activePage - 1) * ITEMS_PER_PAGE;
    return activeList.slice(start, start + ITEMS_PER_PAGE);
  }, [activeList, activePage]);

  const inactiveTotalPages = Math.ceil(filteredInactiveList.length / ITEMS_PER_PAGE) || 1;
  const paginatedInactiveList = useMemo(() => {
    const start = (inactivePage - 1) * ITEMS_PER_PAGE;
    return filteredInactiveList.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredInactiveList, inactivePage]);

  const createIzin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSantri) {
      setFormError('Pilih santri terlebih dahulu sebelum membuat izin.');
      return;
    }
    const cleanKeperluan = keperluan.trim();
    if (!cleanKeperluan) {
      setFormError('Keperluan izin wajib diisi.');
      return;
    }
    if (cleanKeperluan.length < 3) {
      setFormError('Keperluan izin minimal 3 karakter.');
      return;
    }
    if (!jenisId) {
      setFormError('Pilih jenis izin terlebih dahulu.');
      return;
    }
    if (!tanggalMulai) {
      setFormError('Waktu mulai izin wajib diisi.');
      return;
    }
    if (!rencanaKembali) {
      setFormError('Rencana waktu kembali wajib diisi.');
      return;
    }
    if (new Date(rencanaKembali).getTime() < new Date(tanggalMulai).getTime()) {
      setFormError('Rencana waktu kembali tidak boleh lebih awal dari waktu mulai.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await api.post('/api/perizinan', {
        santri_id: selectedSantri.santri_id,
        jenis_izin_id: Number(jenisId),
        keperluan: cleanKeperluan,
        tanggal_mulai: tanggalMulai,
        rencana_kembali: rencanaKembali,
      });
      setToast({ text: 'Izin tersimpan dan status absensi otomatis diperbarui menjadi Izin.', type: 'success' });
      setSelectedSantri(null);
      setSearch('');
      setKeperluan('');
      setIsFormOpen(false);
      await fetchData();
    } catch (error: any) {
      const responseData = error.response?.data;
      if (responseData?.errors) {
        const errorMessages = Object.values(responseData.errors).flat().join(' ');
        setFormError(errorMessages || responseData.message);
      } else {
        setFormError(responseData?.message ?? 'Perizinan gagal disimpan. Periksa data lalu coba lagi.');
      }
    } finally {
      setSaving(false);
    }
  };

  const selectSantri = (santri: SantriResult) => {
    setSelectedSantri(santri);
    setSearch(santri.nama);
    setResults([]);
    setActiveResultIndex(-1);
  };

  const handleGerbang = async (id: number, type: 'keluar' | 'masuk', waktu: string) => {
    try {
      await api.patch(`/api/perizinan/${id}/gerbang`, {
        [type === 'keluar' ? 'waktu_keluar_aktual' : 'waktu_masuk_aktual']: waktu,
      });
      setToast({ text: type === 'keluar' ? 'Waktu keluar tercatat.' : 'Waktu kembali tercatat.', type: 'success' });
      await fetchData();
    } catch (error: any) {
      setToast({ text: error.response?.data?.message ?? 'Data gerbang gagal disimpan. Periksa waktu lalu coba lagi.', type: 'error' });
    }
  };

  const handleDownloadPdf = async (perizinanId: number, namaSantri: string) => {
    setDownloadingId(perizinanId);
    try {
      const response = await api.get(`/api/perizinan/${perizinanId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Surat_Izin_${namaSantri.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setToast({ text: `PDF surat izin ${namaSantri} berhasil diunduh.`, type: 'success' });
    } catch (error) {
      console.error('Gagal mengunduh PDF:', error);
      setToast({ text: 'PDF gagal diunduh. Periksa koneksi lalu coba lagi.', type: 'error' });
    } finally {
      setDownloadingId(null);
    }
  };

  const openGateConfirmation = (item: PerizinanRecord) => {
    setGateActionTime(jakartaDateTime());
    setPendingGateAction({
      id: item.perizinan_id,
      nama: item.nama_santri,
      type: item.status === 'Disetujui' ? 'keluar' : 'masuk',
    });
  };

  const confirmGateAction = async () => {
    if (!pendingGateAction) return;
    await handleGerbang(pendingGateAction.id, pendingGateAction.type, gateActionTime);
    setPendingGateAction(null);
  };

  const toDateTimeLocal = (value?: string | null) => value ? value.replace(' ', 'T').slice(0, 16) : '';

  const openCorrection = (item: PerizinanRecord) => {
    const jadwalKeluar = toDateTimeLocal(item.tanggal_mulai);
    const jadwalMasuk = toDateTimeLocal(item.rencana_kembali);
    const keluarAktual = toDateTimeLocal(item.waktu_keluar_aktual);
    const masukAktual = toDateTimeLocal(item.waktu_masuk_aktual);
    setCorrection({
      id: item.perizinan_id,
      nama: item.nama_santri,
      keluar: keluarAktual || jadwalKeluar,
      masuk: masukAktual || jadwalMasuk,
      keluarAwal: keluarAktual || jadwalKeluar,
      masukAwal: masukAktual || jadwalMasuk,
      jadwalKeluar,
      jadwalMasuk,
    });
  };

  const saveCorrection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!correction) return;
    setSavingCorrection(true);
    try {
      await api.patch(`/api/perizinan/${correction.id}/gerbang/koreksi`, {
        waktu_keluar_aktual: correction.keluar || null,
        waktu_masuk_aktual: correction.masuk || null,
      });
      setToast({ text: `Waktu gerbang ${correction.nama} berhasil dikoreksi.`, type: 'success' });
      setCorrection(null);
      await fetchData();
    } catch (error: any) {
      setToast({ text: error.response?.data?.message ?? 'Koreksi waktu gagal disimpan.', type: 'error' });
    } finally {
      setSavingCorrection(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="permit-page">
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

      <header className="absensi-module-hero" style={{ marginBottom: 24 }}>
        <div className="absensi-module-hero-main">
          <span className="page-eyebrow" style={{ color: 'rgba(255, 255, 255, 0.85)', marginBottom: 4, display: 'inline-block' }}>
            POS KEAMANAN &amp; KONTROL GERBANG
          </span>
          <h1 className="absensi-module-hero-title">Perizinan &amp; Catat Gerbang</h1>
          <p className="absensi-module-hero-desc">
            Pencatatan keluar/kembali santri di pos gerbang, verifikasi surat izin, dan monitoring kepatuhan jadwal secara real-time.
          </p>
          <div className="absensi-module-hero-meta">
            <span className="absensi-module-pill absensi-module-pill-petugas">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Petugas: {user?.nama || 'Petugas Keamanan'}
            </span>
            <span className="absensi-module-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {activeList.length} Izin Aktif Berjalan
            </span>
            <span className="absensi-module-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())}
            </span>
          </div>
        </div>
        <div className="dashboard-mosque-dark" aria-hidden="true"></div>
      </header>

      {/* COLLAPSIBLE FORM BUAT IZIN SANTRI BARU */}
      <div className="collapsible-form-wrapper">
        <button
          type="button"
          className="collapsible-form-toggle"
          onClick={() => setIsFormOpen(!isFormOpen)}
          aria-expanded={isFormOpen}
        >
          <div className="collapsible-form-toggle-left">
            <span className="collapsible-form-toggle-icon">
              {isFormOpen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              )}
            </span>
            <div>
              <span className="collapsible-form-title">{isFormOpen ? 'Sembunyikan Form Buat Izin' : 'Buat Izin Santri Baru'}</span>
              <span className="collapsible-form-subtitle">Pencatatan permohonan izin keluar pondok dan verifikasi awal</span>
            </div>
          </div>
          <span className={`collapsible-form-chevron ${isFormOpen ? 'is-open' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
        </button>

        <form className={`permit-form ${isFormOpen ? 'is-open' : 'is-collapsed'}`} onSubmit={createIzin}>
          <h2>Buat izin santri baru</h2>
          {formError && (
            <div className="error-box" role="alert" style={{ marginBottom: 16 }}>
              {formError}
            </div>
          )}
          <label htmlFor="santri-search">Santri *</label>
          <div className="search-field">
            <input
              id="santri-search"
              value={search}
              onChange={event => { setSearch(event.target.value); setSelectedSantri(null); setActiveResultIndex(-1); }}
              onKeyDown={event => {
                if (!results.length) return;
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setActiveResultIndex(index => Math.min(index + 1, results.length - 1));
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActiveResultIndex(index => Math.max(index - 1, 0));
                } else if (event.key === 'Enter' && activeResultIndex >= 0) {
                  event.preventDefault();
                  selectSantri(results[activeResultIndex]);
                } else if (event.key === 'Escape') {
                  setResults([]);
                  setActiveResultIndex(-1);
                }
              }}
              placeholder="Cari nama santri atau NIS..."
              required={isFormOpen}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={results.length > 0}
              aria-controls="santri-search-results"
              aria-activedescendant={activeResultIndex >= 0 ? `santri-option-${results[activeResultIndex].santri_id}` : undefined}
            />
            {results.length > 0 && (
              <div id="santri-search-results" className="search-results" role="listbox" aria-label="Hasil pencarian santri">
                {results.map((santri, index) => (
                  <button id={`santri-option-${santri.santri_id}`} type="button" role="option" aria-selected={activeResultIndex === index} key={santri.santri_id} onClick={() => selectSantri(santri)}>
                    <strong>{santri.nama}</strong><small>{santri.nis ?? 'Tanpa NIS'} · {santri.nama_kamar ?? 'Kamar belum terdata'}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-grid">
            <AppDropdown
              id="jenis-izin"
              label="Jenis izin"
              value={jenisId}
              onChange={setJenisId}
              required={isFormOpen}
              placeholder="Pilih jenis izin"
              options={jenisList.map(jenis => ({ value: String(jenis.jenis_izin_id), label: jenis.nama }))}
            />
            <div><label htmlFor="keperluan-izin">Keperluan *</label><input id="keperluan-izin" value={keperluan} onChange={event => setKeperluan(event.target.value)} required={isFormOpen} minLength={3} maxLength={255} placeholder="Alasan izin / keperluan (min. 3 karakter)" /></div>
            <DateTimeWibField id="mulai-izin" label="Mulai izin" value={tanggalMulai} onChange={setTanggalMulai} required={isFormOpen} />
            <DateTimeWibField id="rencana-kembali" label="Rencana kembali" value={rencanaKembali} min={tanggalMulai} onChange={setRencanaKembali} required={isFormOpen} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="primary-button" disabled={saving}>{saving ? 'Menyimpan...' : 'Buat dan setujui izin'}</button>
            <button type="button" className="secondary-button" onClick={() => setIsFormOpen(false)}>Tutup Form</button>
          </div>
        </form>
      </div>

      {/* SEGMENTED SUB-TABS */}
      <nav className="permit-segmented-tabs" aria-label="Navigasi Sub-Tab Perizinan">
        <button
          type="button"
          className={`permit-tab-btn ${activeTab === 'aktif' ? 'active' : ''}`}
          onClick={() => setActiveTab('aktif')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>Izin Aktif</span>
          <span className="permit-tab-badge">{activeList.length}</span>
        </button>
        <button
          type="button"
          className={`permit-tab-btn ${activeTab === 'riwayat' ? 'active' : ''}`}
          onClick={() => setActiveTab('riwayat')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <span>Riwayat Selesai</span>
          <span className="permit-tab-badge">{inactiveList.length}</span>
        </button>
      </nav>

      {/* DAFTAR IZIN AKTIF */}
      {activeTab === 'aktif' && (
        <section className="permit-list" style={{ marginBottom: 36, padding: '20px 24px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Kontrol Gerbang - Izin Aktif</h2>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>Santri yang memiliki izin aktif dan membutuhkan verifikasi keluar atau kembali di pos keamanan.</p>
            </div>
          </div>

          {activeList.length === 0 ? (
            <div className="empty-state">Tidak ada santri yang sedang memiliki izin aktif saat ini.</div>
          ) : (
            <>
              {paginatedActiveList.map(item => (
                <article key={item.perizinan_id} className="permit-card-enhanced">
                  <div className="permit-card-main">
                    <div className="permit-card-header-info">
                      <div className="permit-santri-avatar">
                        {item.nama_santri.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="permit-santri-name-row">
                          <strong className="permit-santri-name">{item.nama_santri}</strong>
                          {item.nis && <span className="permit-santri-nis">NIS: {item.nis}</span>}
                        </div>
                        <div className="permit-keperluan-tag">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                          </svg>
                          <span>{item.keperluan}</span>
                        </div>
                      </div>
                    </div>

                    <div className="permit-timing-grid">
                      <div className="permit-timing-item">
                        <span className="permit-timing-label">Mulai Izin</span>
                        <span className="permit-timing-val">{item.tanggal_mulai}</span>
                      </div>
                      <div className="permit-timing-item">
                        <span className="permit-timing-label">Rencana Kembali</span>
                        <span className="permit-timing-val highlight-return">{item.rencana_kembali}</span>
                      </div>
                      {item.waktu_keluar_aktual && (
                        <div className="permit-timing-item">
                          <span className="permit-timing-label">Keluar Real</span>
                          <span className="permit-timing-val">{item.waktu_keluar_aktual}</span>
                        </div>
                      )}
                    </div>

                    <div className="permit-status-badge-wrapper">
                      {item.status === 'Disetujui' ? (
                        <span className="permit-badge permit-badge-approved">
                          <span className="status-dot-amber"></span>
                          Disetujui (Menunggu Keluar)
                        </span>
                      ) : (
                        <span className="permit-badge permit-badge-running">
                          <span className="status-dot-blue"></span>
                          Sedang Berjalan (Di Luar Pondok)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="permit-card-actions-enhanced">
                    {item.status === 'Disetujui' ? (
                      <button
                        type="button"
                        className="gate-btn gate-btn-exit"
                        onClick={() => openGateConfirmation(item)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                          <polyline points="16 17 21 12 16 7"/>
                          <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        <span>Catat Keluar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="gate-btn gate-btn-enter"
                        onClick={() => openGateConfirmation(item)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                          <polyline points="10 17 15 12 10 7"/>
                          <line x1="15" y1="12" x2="3" y2="12"/>
                        </svg>
                        <span>Catat Kembali</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="gate-btn-secondary"
                      onClick={() => openCorrection(item)}
                      title="Koreksi waktu aktual gerbang"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      <span>Koreksi</span>
                    </button>
                    <button
                      type="button"
                      className="gate-btn-secondary"
                      onClick={() => handleDownloadPdf(item.perizinan_id, item.nama_santri)}
                      disabled={downloadingId === item.perizinan_id}
                      title="Unduh surat izin resmi format PDF"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      <span>{downloadingId === item.perizinan_id ? 'Mengunduh...' : 'PDF'}</span>
                    </button>
                  </div>
                </article>
              ))}
              <PaginationControls
                currentPage={activePage}
                totalPages={activeTotalPages}
                onPageChange={setActivePage}
              />
            </>
          )}
        </section>
      )}

      {/* DAFTAR RIWAYAT SELESAI */}
      {activeTab === 'riwayat' && (
        <section className="master-section">
          <div className="section-heading">
            <div>
              <h2>Daftar Riwayat Selesai</h2>
              <p>Daftar santri yang perizinannya telah selesai, dikembalikan, atau kadaluarsa ({inactiveList.length} total riwayat).</p>
            </div>
          </div>

          <div className="account-table-controls">
            <div className="account-search-control">
              <label htmlFor="search-inactive">Pencarian Riwayat</label>
              <input
                id="search-inactive"
                value={inactiveSearch}
                onChange={e => setInactiveSearch(e.target.value)}
                placeholder="Cari nama santri, NIS, atau keperluan..."
              />
            </div>
            <div>
              <label htmlFor="filter-inactive-status">Filter Status</label>
              <select
                id="filter-inactive-status"
                value={inactiveStatusFilter}
                onChange={e => setInactiveStatusFilter(e.target.value)}
              >
                <option value="">Semua Status</option>
                <option value="Selesai">Selesai (Sudah Kembali)</option>
                <option value="Kadaluarsa">Kadaluarsa</option>
                <option value="Dibatalkan">Dibatalkan</option>
              </select>
            </div>
            <div>
              <label htmlFor="filter-dari-perizinan">Dari Tanggal</label>
              <input type="date" id="filter-dari-perizinan" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="filter-sampai-perizinan">Sampai Tanggal</label>
              <input type="date" id="filter-sampai-perizinan" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <p className="account-result-count">
            Menampilkan {filteredInactiveList.length} dari {inactiveList.length} riwayat perizinan.
          </p>

          <div className="table-scroll">
            <table className="master-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>NIS</th>
                  <th>Nama Santri</th>
                  <th>Keperluan</th>
                  <th>Mulai Izin</th>
                  <th>Rencana Kembali</th>
                  <th>Kembali Real</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInactiveList.map((item, idx) => {
                  const isSelesai = item.status === 'Selesai';
                  const isKadaluarsa = item.status === 'Kadaluarsa';
                  const badgeColor = isSelesai ? '#10b981' : isKadaluarsa ? '#ef4444' : '#64748b';
                  const badgeBg = isSelesai ? '#ecfdf5' : isKadaluarsa ? '#fef2f2' : '#f1f5f9';
                  const rowNum = (inactivePage - 1) * ITEMS_PER_PAGE + idx + 1;

                  return (
                    <tr key={item.perizinan_id}>
                      <td>{rowNum}</td>
                      <td>{item.nis || <small style={{ color: '#aaa' }}>—</small>}</td>
                      <td><strong>{item.nama_santri}</strong></td>
                      <td>{item.keperluan}</td>
                      <td>{item.tanggal_mulai}</td>
                      <td>{item.rencana_kembali}</td>
                      <td>{item.waktu_masuk_aktual || <small style={{ color: '#aaa' }}>—</small>}</td>
                      <td>
                        <span style={{
                          padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          color: badgeColor, backgroundColor: badgeBg
                        }}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <div className="table-action-group">
                        <button
                          type="button"
                          className="download-pdf-btn"
                          onClick={() => handleDownloadPdf(item.perizinan_id, item.nama_santri)}
                          disabled={downloadingId === item.perizinan_id}
                          aria-label={`Unduh PDF surat izin ${item.nama_santri}`}
                        >
                          {downloadingId === item.perizinan_id ? 'Mengunduh…' : 'Unduh PDF'}
                        </button>
                        <button type="button" className="secondary-button" onClick={() => openCorrection(item)}>Koreksi waktu</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredInactiveList.length === 0 && (
              <div className="empty-state">Tidak ada riwayat perizinan yang sesuai.</div>
            )}
          </div>
          <PaginationControls
            currentPage={inactivePage}
            totalPages={inactiveTotalPages}
            onPageChange={setInactivePage}
          />
        </section>
      )}

      {pendingGateAction && (
        <div ref={modalRef} className="save-modal-backdrop" role="presentation">
          <section className="save-modal" role="dialog" aria-modal="true" aria-labelledby="gate-confirm-title">
            <h2 id="gate-confirm-title">Konfirmasi pencatatan {pendingGateAction.type}</h2>
            <p>Anda akan mencatat waktu {pendingGateAction.type} untuk <strong>{pendingGateAction.nama}</strong>. Sesuaikan waktunya bila diperlukan.</p>
            <DateTimeWibField id="gate-action-time" label={`Waktu ${pendingGateAction.type}`} value={gateActionTime} onChange={setGateActionTime} />
            <div className="save-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setPendingGateAction(null)}>Batal</button>
              <button type="button" className="primary-button" disabled={!isWibDateTime(gateActionTime)} onClick={() => void confirmGateAction()}>Konfirmasi</button>
            </div>
          </section>
        </div>
      )}

      {correction && (
        <div ref={modalRef} className="save-modal-backdrop" role="presentation">
          <form className="save-modal" onSubmit={saveCorrection} role="dialog" aria-modal="true" aria-labelledby="gate-correction-title">
            <span className="modal-eyebrow">Catatan gerbang</span>
            <h2 id="gate-correction-title">Koreksi waktu izin</h2>
            <p className="correction-name">{correction.nama}</p>
            <DateTimeWibField id="correction-keluar" label="Waktu keluar" value={correction.keluar} onChange={keluar => setCorrection({ ...correction, keluar })} required={false} />
            <DateTimeWibField id="correction-masuk" label="Waktu kembali" value={correction.masuk} min={correction.keluar || undefined} onChange={masuk => setCorrection({ ...correction, masuk })} required={false} />
            <div className="save-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setCorrection(null)}>Batal</button>
              <button type="submit" className="primary-button" disabled={savingCorrection}>{savingCorrection ? 'Menyimpan…' : 'Simpan koreksi'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
