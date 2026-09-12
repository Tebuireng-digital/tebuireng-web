import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { AppToast } from '../components/AppToast';

interface AttendanceRecord {
  absensi_id: number;
  tanggal: string;
  jenis_kegiatan: string;
  nama_kegiatan: string;
  nama_jadwal: string;
  santri_id: number;
  nama_santri: string;
  no_id_induk?: string | null;
  nis?: string | null;
  unit?: string | null;
  kamar?: string | null;
  kelas_formal?: string | null;
  status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpha' | 'Terlambat';
  menit_terlambat?: number | null;
  keterangan?: string | null;
  waktu_input: string;
}

interface AbsensiTarget {
  target_id: number;
  nama_target: string;
  kategori_target?: string | null;
  nama_target_asli?: string | null;
  tingkat?: string | number | null;
  unit_kode?: string | null;
  unit_nama?: string | null;
}

interface AbsensiOptionGroup {
  jenis: string;
  nama: string;
  sumber: string;
  targets: AbsensiTarget[];
  jadwal: Array<{
    jadwal_id: number;
    nama_jadwal: string;
    jam_mulai: string;
    jam_selesai: string;
  }>;
}

const statusOptions = ['Hadir', 'Izin', 'Sakit', 'Alpha', 'Terlambat'] as const;

const JENIS_TO_KODE: Record<string, string> = {
  sekolah: 'SEKOLAH',
  kamar: 'KAMAR',
  keberangkatan: 'KAMAR',
  pbs: 'PBS',
  pbm: 'PBM',
  diniyah: 'DINIYAH',
};

function getTodayWIB(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatTanggalWIB(tanggalIso: string): string {
  if (!tanggalIso) return '—';
  const parts = tanggalIso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return tanggalIso;
  }
  const [year, month, day] = parts;
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function formatWaktuInputWIB(waktu: string | null | undefined): string {
  if (!waktu) return '—';
  let date: Date;
  if (waktu.includes('T')) {
    date = new Date(waktu);
  } else {
    date = new Date(waktu.replace(' ', 'T') + '+07:00');
  }
  if (isNaN(date.getTime())) {
    return waktu;
  }
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date).replace(/\./g, ':');
}

function getKelompokName(target: AbsensiTarget): string {
  if (target.kategori_target && target.kategori_target.trim() && target.kategori_target !== 'MASTER_PUTRA') {
    return target.kategori_target.trim();
  }
  if (target.unit_nama && target.unit_nama.trim()) {
    return target.unit_nama.trim();
  }
  if (target.unit_kode && target.unit_kode.trim()) {
    return target.unit_kode.trim();
  }
  if (target.tingkat) {
    return `Tingkat ${target.tingkat}`;
  }
  return 'Umum';
}

export function AbsensiHistoryPage() {
  const { user } = useAuth();
  usePageMeta({
    title: 'Histori & Rekap Absensi',
    description: 'Catatan histori dan rekap absensi santri sesuai penugasan aktif petugas SIMANTEB.',
  });

  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Load absensi options (scoped to user's assigned duties, or all for Admin)
  const optionsQuery = useQuery<AbsensiOptionGroup[]>({
    queryKey: ['absensi-options', user?.petugas_id],
    queryFn: async () => (await api.get('/api/absensi-options')).data,
    enabled: Boolean(user),
  });
  const absensiOptions = optionsQuery.data ?? [];

  // Map available Kegiatan based on assigned absensi options
  const availableKegiatan = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of absensiOptions) {
      const kode = JENIS_TO_KODE[opt.jenis] || opt.jenis.toUpperCase();
      if (!map.has(kode)) {
        const label =
          kode === 'SEKOLAH'
            ? 'Kelas Formal'
            : kode === 'KAMAR'
            ? 'Kamar'
            : kode === 'PBS'
            ? "Al-Qur'an Subuh (PBS)"
            : kode === 'PBM'
            ? 'Takhasus Maghrib (PBM)'
            : kode === 'DINIYAH'
            ? 'Kelas Madin'
            : opt.nama;
        map.set(kode, label);
      }
    }
    return Array.from(map.entries()).map(([kode, label]) => ({ kode, label }));
  }, [absensiOptions]);

  // Initial filter state from URL search params or defaults (today WIB)
  const [filters, setFilters] = useState(() => {
    const rawJenis = (searchParams.get('jenis') ?? '').toLowerCase();
    const resolvedJenis = JENIS_TO_KODE[rawJenis] || (rawJenis ? rawJenis.toUpperCase() : '');
    return {
      santri: searchParams.get('santri') ?? '',
      jenis: resolvedJenis,
      kelompok: searchParams.get('kelompok') ?? '',
      roster: searchParams.get('roster') ?? searchParams.get('target_id') ?? '',
      status: searchParams.get('status') ?? '',
      dari: searchParams.get('dari') ?? getTodayWIB(),
      sampai: searchParams.get('sampai') ?? getTodayWIB(),
    };
  });

  // Automatically select single assigned kegiatan for non-admin if none selected yet
  useEffect(() => {
    if (user?.jabatan !== 'Admin' && availableKegiatan.length === 1 && !filters.jenis) {
      setFilters(prev => ({ ...prev, jenis: availableKegiatan[0].kode }));
    }
  }, [user?.jabatan, availableKegiatan, filters.jenis]);

  // Sync state changes back to search params (without push history spam)
  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (filters.santri) nextParams.set('santri', filters.santri);
    if (filters.jenis) nextParams.set('jenis', filters.jenis);
    if (filters.kelompok) nextParams.set('kelompok', filters.kelompok);
    if (filters.roster) nextParams.set('roster', filters.roster);
    if (filters.status) nextParams.set('status', filters.status);
    if (filters.dari) nextParams.set('dari', filters.dari);
    if (filters.sampai) nextParams.set('sampai', filters.sampai);

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [filters, searchParams, setSearchParams]);

  // Available kelompok based on selected jenis
  const availableKelompok = useMemo(() => {
    const groupsToInspect = filters.jenis
      ? absensiOptions.filter(o => (JENIS_TO_KODE[o.jenis] || o.jenis.toUpperCase()) === filters.jenis)
      : absensiOptions;

    const kelompokSet = new Set<string>();
    for (const grp of groupsToInspect) {
      for (const tgt of grp.targets) {
        const k = getKelompokName(tgt);
        if (k) kelompokSet.add(k);
      }
    }
    return Array.from(kelompokSet).sort((a, b) => a.localeCompare(b, 'id'));
  }, [absensiOptions, filters.jenis]);

  // Available rosters based on selected jenis and kelompok
  const availableRosters = useMemo(() => {
    const groupsToInspect = filters.jenis
      ? absensiOptions.filter(o => (JENIS_TO_KODE[o.jenis] || o.jenis.toUpperCase()) === filters.jenis)
      : absensiOptions;

    const targetMap = new Map<number, { target_id: number; nama_target: string; kelompok: string }>();
    for (const grp of groupsToInspect) {
      for (const tgt of grp.targets) {
        const k = getKelompokName(tgt);
        if (!filters.kelompok || k === filters.kelompok) {
          if (!targetMap.has(tgt.target_id)) {
            targetMap.set(tgt.target_id, {
              target_id: tgt.target_id,
              nama_target: tgt.nama_target,
              kelompok: k,
            });
          }
        }
      }
    }
    return Array.from(targetMap.values()).sort((a, b) => a.nama_target.localeCompare(b.nama_target, 'id'));
  }, [absensiOptions, filters.jenis, filters.kelompok]);

  // Build params payload for backend query
  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = {};
    if (filters.santri.trim()) params.santri = filters.santri.trim();
    if (filters.jenis) params.jenis = filters.jenis;
    if (filters.status) params.status = filters.status;
    if (filters.dari) params.dari = filters.dari;
    if (filters.sampai) params.sampai = filters.sampai;

    if (filters.roster) {
      params.target_id = Number(filters.roster);
    } else if (filters.kelompok) {
      const targetIds = availableRosters.map(r => r.target_id);
      if (targetIds.length > 0) {
        params.target_ids = targetIds.join(',');
      }
    }

    return params;
  }, [filters, availableRosters]);

  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const query = useQuery<AttendanceRecord[]>({
    queryKey: ['absensi-history', queryParams, user?.petugas_id],
    queryFn: async () => (await api.get('/api/absensi', { params: queryParams })).data,
    enabled: Boolean(user),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; status: string; menit_terlambat: number | null; keterangan: string }) =>
      api.patch(`/api/absensi/${payload.id}`, payload),
    onSuccess: () => {
      setEditing(null);
      setToast({ message: 'Perubahan absensi tersimpan dan tercatat di audit.', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['absensi-history'] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) =>
      setToast({
        message:
          error.response?.data?.message ??
          'Perubahan belum tersimpan. Periksa batas waktu edit atau penugasan Anda.',
        type: 'error',
      }),
  });

  const records = query.data ?? [];
  const resultLabel = useMemo(
    () => `${records.length} catatan${records.length === 500 ? ' (dibatasi 500 terbaru)' : ''}`,
    [records.length],
  );

  const todayWIB = getTodayWIB();
  const hasActiveFilters = Boolean(
    filters.santri ||
      (filters.jenis && (user?.jabatan === 'Admin' || availableKegiatan.length > 1)) ||
      filters.kelompok ||
      filters.roster ||
      filters.status ||
      filters.dari !== todayWIB ||
      filters.sampai !== todayWIB,
  );

  const resetFilters = () => {
    const defaultJenis =
      user?.jabatan !== 'Admin' && availableKegiatan.length === 1 ? availableKegiatan[0].kode : '';
    setFilters({
      santri: '',
      jenis: defaultJenis,
      kelompok: '',
      roster: '',
      status: '',
      dari: todayWIB,
      sampai: todayWIB,
    });
  };

  const setFilterToday = () => {
    setFilters(prev => ({
      ...prev,
      dari: todayWIB,
      sampai: todayWIB,
    }));
  };

  return (
    <section className="page-shell attendance-history-page">
      {toast && (
        <AppToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <header className="attendance-history-header">
        <h1>Histori &amp; Rekap Absensi</h1>
      </header>

      {/* FILTER PANEL */}
      <section className="panel history-filter-panel">
        {/* Baris 1: Ruang Lingkup Penugasan & Santri */}
        <div className="history-filter-row-1">
          <label>
            Nama santri
            <input
              value={filters.santri}
              onChange={event => setFilters(prev => ({ ...prev, santri: event.target.value }))}
              placeholder="Cari nama santri..."
            />
          </label>

          <label>
            Kegiatan
            <select
              value={filters.jenis}
              onChange={event => {
                const newJenis = event.target.value;
                setFilters(prev => ({
                  ...prev,
                  jenis: newJenis,
                  kelompok: '',
                  roster: '',
                }));
              }}
            >
              {user?.jabatan === 'Admin' || availableKegiatan.length > 1 ? (
                <option value="">Semua kegiatan</option>
              ) : null}
              {availableKegiatan.map(k => (
                <option key={k.kode} value={k.kode}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Kelompok
            <select
              value={filters.kelompok}
              onChange={event => {
                const newKelompok = event.target.value;
                setFilters(prev => ({
                  ...prev,
                  kelompok: newKelompok,
                  roster: '',
                }));
              }}
            >
              <option value="">Semua kelompok</option>
              {availableKelompok.map(kel => (
                <option key={kel} value={kel}>
                  {kel}
                </option>
              ))}
            </select>
          </label>

          <label>
            Roster
            <select
              value={filters.roster}
              onChange={event => setFilters(prev => ({ ...prev, roster: event.target.value }))}
            >
              <option value="">Semua roster</option>
              {availableRosters.map(ros => (
                <option key={ros.target_id} value={ros.target_id}>
                  {ros.nama_target}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Baris 2: Status Kehadiran & Rentang Tanggal */}
        <div className="history-filter-row-2">
          <label>
            Status kehadiran
            <select
              value={filters.status}
              onChange={event => setFilters(prev => ({ ...prev, status: event.target.value }))}
            >
              <option value="">Semua status</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label>
            Dari tanggal
            <input
              type="date"
              value={filters.dari}
              onChange={event => setFilters(prev => ({ ...prev, dari: event.target.value }))}
            />
          </label>

          <label>
            Sampai tanggal
            <input
              type="date"
              value={filters.sampai}
              onChange={event => setFilters(prev => ({ ...prev, sampai: event.target.value }))}
            />
          </label>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minHeight: '38px' }}>
            {(filters.dari !== todayWIB || filters.sampai !== todayWIB) && (
              <button
                type="button"
                className="history-filter-btn-today"
                onClick={setFilterToday}
                title="Atur tanggal filter ke Hari Ini"
              >
                Hari Ini
              </button>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                className="history-filter-btn-reset"
                onClick={resetFilters}
                title="Reset semua filter ke default"
              >
                ✕ Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Summary Tags & Total Records (Bawah Kanan Sejajar) */}
        <div className="history-filter-summary-bar">
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span className="history-filter-summary-label">Lingkup Aktif:</span>
            <div className="history-filter-summary-tags">
              <span className="history-summary-tag">
                {filters.dari === todayWIB && filters.sampai === todayWIB
                  ? 'Hari Ini (WIB)'
                  : filters.dari === filters.sampai
                  ? formatTanggalWIB(filters.dari)
                  : `${formatTanggalWIB(filters.dari)} s.d. ${formatTanggalWIB(filters.sampai)}`}
              </span>
              {filters.jenis && (
                <span className="history-summary-tag">
                  Kegiatan: {availableKegiatan.find(k => k.kode === filters.jenis)?.label || filters.jenis}
                </span>
              )}
              {filters.kelompok && (
                <span className="history-summary-tag">
                  Kelompok: {filters.kelompok}
                </span>
              )}
              {filters.roster && (
                <span className="history-summary-tag">
                  Roster: {availableRosters.find(r => r.target_id === Number(filters.roster))?.nama_target || filters.roster}
                </span>
              )}
              {filters.status && (
                <span className="history-summary-tag">
                  Status: {filters.status}
                </span>
              )}
              {filters.santri && (
                <span className="history-summary-tag">
                  Santri: "{filters.santri}"
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="history-filter-count-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              {query.isLoading ? 'Memuat…' : resultLabel}
            </span>
          </div>
        </div>
      </section>

      {/* UNIFIED MASTER TABLE */}
      <section className="panel history-table-panel">
        {query.isError ? (
          <div className="empty-state">
            Data absensi belum dapat dimuat. Periksa koneksi dan penugasan aktif.
          </div>
        ) : records.length === 0 && !query.isLoading ? (
          <div className="empty-state">
            Belum ada catatan absensi yang sesuai filter dan penugasan aktif Anda.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="master-table history-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Tanggal</th>
                  <th style={{ minWidth: '180px' }}>Santri</th>
                  <th>Kegiatan</th>
                  <th>Jadwal</th>
                  <th style={{ width: '100px' }}>Status</th>
                  <th style={{ minWidth: '160px' }}>Catatan</th>
                  <th style={{ width: '160px' }}>Waktu Input (WIB)</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {records.map(record => {
                  const tanggalFormatted = formatTanggalWIB(record.tanggal);
                  const waktuWIB = formatWaktuInputWIB(record.waktu_input);
                  const nomorIndukPondok = record.no_id_induk || record.nis || '—';
                  return (
                    <tr key={record.absensi_id}>
                      <td className="history-date-cell">
                        <span className="history-date-formatted">{tanggalFormatted}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
                          {record.nama_santri}
                        </div>
                        <small style={{ display: 'block', fontSize: '12px', color: '#64748b', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                          {nomorIndukPondok}
                        </small>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500, color: '#1e293b' }}>{record.nama_kegiatan}</span>
                      </td>
                      <td>
                        <span style={{ color: '#475569' }}>{record.nama_jadwal}</span>
                      </td>
                      <td>
                        <span className={`history-status-pill status-${record.status.toLowerCase()}`}>
                          {record.status}
                        </span>
                      </td>
                      <td>
                        {record.status === 'Terlambat' && record.menit_terlambat ? (
                          <span
                            style={{
                              fontSize: '12px',
                              color: '#7c3aed',
                              fontWeight: 600,
                              display: 'block',
                              marginBottom: record.keterangan ? '2px' : '0',
                            }}
                          >
                            Terlambat {record.menit_terlambat} menit
                          </span>
                        ) : null}
                        {record.keterangan ? (
                          <span
                            style={{
                              fontSize: '12px',
                              color: '#475569',
                              display: 'block',
                              lineHeight: 1.4,
                            }}
                          >
                            {record.keterangan}
                          </span>
                        ) : null}
                        {!record.keterangan && (!record.status || record.status !== 'Terlambat') && (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: '#334155', fontFamily: 'monospace' }}>
                          {waktuWIB}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="history-btn-koreksi"
                          onClick={() => setEditing(record)}
                          aria-label={`Koreksi absensi ${record.nama_santri}`}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                          Koreksi
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* EDIT / KOREKSI MODAL */}
      {editing && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card history-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-edit-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Koreksi terukur</p>
                <h2 id="history-edit-title">Edit absensi {editing.nama_santri}</h2>
                <p>
                  {editing.tanggal} · {editing.nama_kegiatan} · {editing.nama_jadwal}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setEditing(null)}
                aria-label="Tutup edit"
              >
                ×
              </button>
            </div>

            <label>
              Status
              <select
                value={editing.status}
                onChange={event =>
                  setEditing({ ...editing, status: event.target.value as AttendanceRecord['status'] })
                }
              >
                {statusOptions.map(status => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            {editing.status === 'Terlambat' && (
              <label>
                Menit terlambat
                <input
                  type="number"
                  min="0"
                  value={editing.menit_terlambat ?? 0}
                  onChange={event =>
                    setEditing({ ...editing, menit_terlambat: Number(event.target.value) })
                  }
                />
              </label>
            )}

            <label>
              Catatan
              <textarea
                value={editing.keterangan ?? ''}
                onChange={event => setEditing({ ...editing, keterangan: event.target.value })}
                placeholder="Alasan koreksi status atau catatan..."
              />
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEditing(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    id: editing.absensi_id,
                    status: editing.status,
                    menit_terlambat:
                      editing.status === 'Terlambat' ? editing.menit_terlambat ?? null : null,
                    keterangan: editing.keterangan ?? '',
                  })
                }
              >
                {updateMutation.isPending ? 'Menyimpan…' : 'Simpan koreksi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
