import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
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
  const [message, setMessage] = useState<Feedback | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
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
    fetchData().catch(() => setMessage({ text: 'Data perizinan tidak dapat dimuat. Periksa koneksi lalu muat ulang halaman.', type: 'error' })).finally(() => setLoading(false));
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
      return matchSearch && matchStatus;
    });
  }, [inactiveList, inactiveSearch, inactiveStatusFilter]);

  useEffect(() => {
    setInactivePage(1);
  }, [inactiveSearch, inactiveStatusFilter]);

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
      setMessage({ text: 'Pilih santri terlebih dahulu sebelum membuat izin.', type: 'error' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await api.post('/api/perizinan', {
        santri_id: selectedSantri.santri_id,
        jenis_izin_id: Number(jenisId),
        keperluan,
        tanggal_mulai: tanggalMulai,
        rencana_kembali: rencanaKembali,
      });
      setMessage({ text: 'Izin tersimpan dan status absensi otomatis diperbarui menjadi Izin.', type: 'success' });
      setSelectedSantri(null);
      setSearch('');
      setKeperluan('');
      setIsFormOpen(false);
      await fetchData();
    } catch (error: any) {
      setMessage({ text: error.response?.data?.message ?? 'Perizinan gagal disimpan. Periksa data lalu coba lagi.', type: 'error' });
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
      setMessage({ text: type === 'keluar' ? 'Waktu keluar tercatat.' : 'Waktu kembali tercatat.', type: 'success' });
      await fetchData();
    } catch (error: any) {
      setMessage({ text: error.response?.data?.message ?? 'Data gerbang gagal disimpan. Periksa waktu lalu coba lagi.', type: 'error' });
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
      setMessage({ text: `PDF surat izin ${namaSantri} berhasil diunduh.`, type: 'success' });
    } catch (error) {
      console.error('Gagal mengunduh PDF:', error);
      setMessage({ text: 'PDF gagal diunduh. Periksa koneksi lalu coba lagi.', type: 'error' });
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
      setMessage({ text: `Waktu gerbang ${correction.nama} berhasil dikoreksi.`, type: 'success' });
      setCorrection(null);
      await fetchData();
    } catch (error: any) {
      setMessage({ text: error.response?.data?.message ?? 'Koreksi waktu gagal disimpan.', type: 'error' });
    } finally {
      setSavingCorrection(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="permit-page">
      <header className="dashboard-header page-header">
        <h1>Perizinan & Gerbang</h1>
        <p>Kelola perizinan santri, pencatatan gerbang keluar/kembali, serta riwayat perizinan selesai.</p>
      </header>

      {message && <div className={message.type === 'success' ? 'success-box' : 'error-box'} role="status" style={{ marginBottom: 20 }}>{message.text}</div>}

      {/* COLLAPSIBLE FORM BUAT IZIN SANTRI BARU */}
      <div className="collapsible-form-wrapper">
        <button
          type="button"
          className="collapsible-form-toggle"
          onClick={() => setIsFormOpen(!isFormOpen)}
          aria-expanded={isFormOpen}
        >
          <div className="collapsible-form-toggle-left">
            <span className="collapsible-form-toggle-icon">{isFormOpen ? '−' : '+'}</span>
            <span>{isFormOpen ? 'Sembunyikan Form Buat Izin' : 'Buat Izin Santri Baru'}</span>
          </div>
          <span className={`collapsible-form-chevron ${isFormOpen ? 'is-open' : ''}`}>▼</span>
        </button>

        <form className={`permit-form ${isFormOpen ? 'is-open' : 'is-collapsed'}`} onSubmit={createIzin}>
          <h2>Buat izin santri baru</h2>
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
            <div><label htmlFor="keperluan-izin">Keperluan</label><input id="keperluan-izin" value={keperluan} onChange={event => setKeperluan(event.target.value)} required={isFormOpen} maxLength={255} placeholder="Alasan izin / keperluan" /></div>
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
          <span>Izin Aktif</span>
          <span className="permit-tab-badge">{activeList.length}</span>
        </button>
        <button
          type="button"
          className={`permit-tab-btn ${activeTab === 'riwayat' ? 'active' : ''}`}
          onClick={() => setActiveTab('riwayat')}
        >
          <span>Riwayat Selesai</span>
          <span className="permit-tab-badge">{inactiveList.length}</span>
        </button>
      </nav>

      {/* DAFTAR IZIN AKTIF */}
      {activeTab === 'aktif' && (
        <section className="permit-list" style={{ marginBottom: 36 }}>
          <h2>Daftar Izin Aktif</h2>
          {activeList.length === 0 ? (
            <div className="empty-state">Tidak ada santri yang sedang memiliki izin aktif saat ini.</div>
          ) : (
            <>
              {paginatedActiveList.map(item => (
                <article key={item.perizinan_id} className="permit-card">
                  <div>
                    <strong>{item.nama_santri}</strong>
                    <p>{item.keperluan} · Rencana kembali: {item.rencana_kembali}</p>
                    <span className="schedule-label" style={{ marginTop: 4, display: 'inline-block' }}>
                      Status: {item.status}
                    </span>
                  </div>
                  <div className="permit-card-actions">
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
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => openGateConfirmation(item)}
                    >
                      {item.status === 'Disetujui' ? 'Catat keluar' : 'Catat kembali'}
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
