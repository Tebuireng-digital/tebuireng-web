import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { ContentSkeleton, PageSkeleton } from '../components/LoadingSkeleton';
import type { StatusAbsensi } from '../components/PillStatus';
import { usePageMeta } from '../hooks/usePageMeta';

interface TargetKelas { target_id: number; nama_target: string; unit_kode?: string; unit_nama?: string }
interface JadwalKelas { jadwal_id: number; nama_jadwal: string }
interface OpsiSekolah { jenis: string; targets: TargetKelas[]; jadwal: JadwalKelas[] }
interface BarisRekap { santri_id: number; nis: string | null; nama: string; status: StatusAbsensi | null }
interface SesiRekap {
  target: { nama_target: string; nama_penanggung_jawab: string | null };
  jadwal: JadwalKelas;
  santri: BarisRekap[];
}

interface UnitPendidikan {
  kode: string;
  nama: string;
}

interface RekapDropdownOption {
  value: string;
  label: string;
  meta?: string;
}

interface RekapDropdownProps {
  label: string;
  id: string;
  value: string;
  options: RekapDropdownOption[];
  onChange: (value: string) => void;
  searchPlaceholder: string;
}

function RekapDropdown({ label, id, value, options, onChange, searchPlaceholder }: RekapDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedOption = options.find(option => option.value === value) || options[0];
  const filteredOptions = options.filter(option => `${option.label} ${option.meta || ''}`.toLowerCase().includes(search.trim().toLowerCase()));

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (isOpen) setTimeout(() => searchRef.current?.focus(), 0);
    else setSearch('');
  }, [isOpen]);

  const chooseOption = (option: RekapDropdownOption) => {
    onChange(option.value);
    setIsOpen(false);
    setActiveIndex(0);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(event.key === 'ArrowDown' ? 0 : Math.max(filteredOptions.length - 1, 0));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(open => !open);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => Math.min(index + 1, Math.max(filteredOptions.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && filteredOptions[activeIndex]) {
      event.preventDefault();
      chooseOption(filteredOptions[activeIndex]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="rekap-dropdown" ref={dropdownRef}>
      <label id={`${id}-label`} htmlFor={id}>{label}</label>
      <button
        id={id}
        type="button"
        className={`rekap-dropdown-trigger${isOpen ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${id}-label ${id}`}
        onClick={() => setIsOpen(open => !open)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="rekap-dropdown-trigger-copy">
          <strong>{selectedOption?.label || 'Pilih pilihan'}</strong>
          {selectedOption?.meta && <small>{selectedOption.meta}</small>}
        </span>
        <span className="rekap-dropdown-chevron" aria-hidden="true">⌄</span>
      </button>
      {isOpen && (
        <div className="rekap-dropdown-menu" role="listbox" aria-label={label}>
          <div className="rekap-dropdown-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
            <input ref={searchRef} value={search} onChange={event => { setSearch(event.target.value); setActiveIndex(0); }} onKeyDown={handleSearchKeyDown} placeholder={searchPlaceholder} aria-label={`Cari ${label.toLowerCase()}`} />
          </div>
          <div className="rekap-dropdown-options">
            {filteredOptions.length > 0 ? filteredOptions.map((option, index) => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={`rekap-dropdown-option${option.value === value ? ' is-selected' : ''}${index === activeIndex ? ' is-active' : ''}`}
                key={option.value}
                onClick={() => chooseOption(option)}
              >
                <span className="rekap-dropdown-option-copy"><strong>{option.label}</strong>{option.meta && <small>{option.meta}</small>}</span>
                {option.value === value && <span className="rekap-dropdown-option-check" aria-hidden="true">✓</span>}
              </button>
            )) : <span className="rekap-dropdown-empty">Pilihan tidak ditemukan.</span>}
          </div>
          <span className="rekap-dropdown-hint">Gunakan ↑ ↓ untuk memilih · Enter untuk membuka</span>
        </div>
      )}
    </div>
  );
}

const todayJakarta = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const statuses: Array<StatusAbsensi | 'Belum diisi'> = ['Hadir', 'Izin', 'Sakit', 'Alpha', 'Terlambat', 'Belum diisi'];

export function RekapKelasPage() {
  usePageMeta({
    title: 'Rekap Kelas Formal',
    description: 'Pantau rekap kehadiran harian santri untuk kelas formal Pondok Pesantren Tebuireng.',
  });

  const [searchParams] = useSearchParams();
  const [targetId, setTargetId] = useState(Number(searchParams.get('kelas')) || 0);
  const [unitKode, setUnitKode] = useState(searchParams.get('unit') || '');
  const [tanggal, setTanggal] = useState(searchParams.get('tanggal') || todayJakarta());

  const optionsQuery = useQuery<OpsiSekolah[]>({
    queryKey: ['absensi-options-rekap-kelas'],
    queryFn: async () => (await api.get('/api/absensi-options')).data,
  });
  const sekolah = optionsQuery.data?.find(item => item.jenis === 'sekolah');
  const jadwalId = Number(searchParams.get('jadwal')) || sekolah?.jadwal[0]?.jadwal_id || 0;

  const unitOptions = useMemo<UnitPendidikan[]>(() => {
    const uniqueUnits = new Map<string, UnitPendidikan>();
    for (const target of sekolah?.targets ?? []) {
      const kode = target.unit_kode || target.unit_nama || 'lainnya';
      if (!uniqueUnits.has(kode)) {
        uniqueUnits.set(kode, { kode, nama: target.unit_nama || target.unit_kode || 'Unit pendidikan lainnya' });
      }
    }
    return Array.from(uniqueUnits.values());
  }, [sekolah]);

  const filteredTargets = useMemo(
    () => (sekolah?.targets ?? []).filter(target => (target.unit_kode || target.unit_nama || 'lainnya') === unitKode),
    [sekolah, unitKode],
  );

  useEffect(() => {
    if (!sekolah?.targets.length) return;

    const selectedTarget = sekolah.targets.find(target => target.target_id === targetId);
    const nextUnitKode = unitKode && unitOptions.some(unit => unit.kode === unitKode)
      ? unitKode
      : selectedTarget?.unit_kode || selectedTarget?.unit_nama || unitOptions[0]?.kode || '';

    if (nextUnitKode !== unitKode) setUnitKode(nextUnitKode);

    const nextTargets = sekolah.targets.filter(target => (target.unit_kode || target.unit_nama || 'lainnya') === nextUnitKode);
    if (!nextTargets.some(target => target.target_id === targetId)) {
      setTargetId(nextTargets[0]?.target_id || sekolah.targets[0].target_id);
    }
  }, [sekolah, targetId, unitKode, unitOptions]);

  const handleUnitChange = (nextUnitKode: string) => {
    setUnitKode(nextUnitKode);
    const nextTarget = (sekolah?.targets ?? []).find(target => (target.unit_kode || target.unit_nama || 'lainnya') === nextUnitKode);
    if (nextTarget) setTargetId(nextTarget.target_id);
  };

  const unitDropdownOptions = unitOptions.map(unit => ({
    value: unit.kode,
    label: unit.kode !== unit.nama ? unit.kode : unit.nama,
    meta: unit.kode !== unit.nama ? unit.nama : 'Jenjang pendidikan',
  }));
  const kelasDropdownOptions = filteredTargets.map(target => ({
    value: String(target.target_id),
    label: target.nama_target,
    meta: target.unit_nama || target.unit_kode || 'Kelas formal',
  }));

  const sessionQuery = useQuery<SesiRekap>({
    queryKey: ['rekap-kelas', targetId, jadwalId, tanggal],
    enabled: Boolean(targetId && jadwalId),
    queryFn: async () => (await api.get('/api/absensi/sekolah/session', {
      params: { target_id: targetId, jadwal_id: jadwalId, tanggal },
    })).data,
  });

  const totals = useMemo(() => {
    const result = Object.fromEntries(statuses.map(status => [status, 0])) as Record<string, number>;
    for (const santri of sessionQuery.data?.santri ?? []) {
      result[santri.status ?? 'Belum diisi'] += 1;
    }
    return result;
  }, [sessionQuery.data]);

  if (optionsQuery.isLoading) return <PageSkeleton />;
  if (!sekolah?.targets.length) return <div className="empty-state">Belum ada kelas formal yang terdaftar pada akun ini.</div>;

  return (
    <section className="rekap-page">
      <header className="dashboard-header">
        <div>
          <span className="page-eyebrow">Absensi kelas</span>
          <h1>Rekap Kelas</h1>
          <p>Pantau hasil absensi harian santri untuk kelas formal Pondok Pesantren Tebuireng.</p>
        </div>
      </header>

      <div className="rekap-filters">
        <RekapDropdown label="Jenjang / Unit Pendidikan" id="rekap-unit" value={unitKode} options={unitDropdownOptions} onChange={handleUnitChange} searchPlaceholder="Cari jenjang atau unit..." />
        <RekapDropdown label="Kelas" id="rekap-kelas" value={String(targetId)} options={kelasDropdownOptions} onChange={value => setTargetId(Number(value))} searchPlaceholder="Cari kelas..." />
        <div><label htmlFor="rekap-tanggal">Tanggal</label><input id="rekap-tanggal" type="date" value={tanggal} onChange={event => setTanggal(event.target.value)} /></div>
      </div>

      {sessionQuery.isLoading && <ContentSkeleton rows={5} />}
      {sessionQuery.error && <div className="error-box">Rekap kelas gagal dimuat. Periksa koneksi lalu coba kembali.</div>}

      {sessionQuery.data && <>
        <div className="rekap-heading">
          <div><h2>{sessionQuery.data.target.nama_target}</h2><p>{sessionQuery.data.jadwal.nama_jadwal}{sessionQuery.data.target.nama_penanggung_jawab ? ` · ${sessionQuery.data.target.nama_penanggung_jawab}` : ''}</p></div>
          <strong>{sessionQuery.data.santri.length} santri</strong>
        </div>

        <div className="rekap-summary">
          {statuses.map(status => <div className={`rekap-summary-card ${status.toLowerCase().replaceAll(' ', '-')}`} key={status}><strong>{totals[status]}</strong><span>{status}</span></div>)}
        </div>

        <div className="table-scroll"><table className="master-table rekap-table">
          <thead><tr><th>No</th><th>Nama santri</th><th>Status</th></tr></thead>
          <tbody>{sessionQuery.data.santri.map((santri, index) => <tr key={santri.santri_id}><td>{index + 1}</td><td><strong>{santri.nama}</strong><small>{santri.nis || 'NIS belum tersedia'}</small></td><td><span className={`rekap-status ${(santri.status ?? 'belum').toLowerCase()}`}>{santri.status ?? 'Belum diisi'}</span></td></tr>)}</tbody>
        </table></div>
      </>}
    </section>
  );
}
