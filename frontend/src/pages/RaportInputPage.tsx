import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { AppDropdown } from '../components/AppDropdown';
import { ContentSkeleton } from '../components/LoadingSkeleton';
import { usePageMeta } from '../hooks/usePageMeta';

interface Target {
  target_id: number;
  nama_target: string;
  kategori?: string;
  nama_roster?: string;
  santri_count?: number;
}

interface OptionGroup {
  jenis: string;
  nama: string;
  aspek: string[];
  targets: Target[];
}

interface SantriEntry {
  santri_id: number;
  nis: string | null;
  no_id_induk?: string | null;
  nama: string;
  nilai: Record<string, number | null>;
  kepribadian: Record<string, string | null>;
  keputusan: string | null;
  predikat_umum: string | null;
  raport_id: number | null;
  status?: 'draft' | 'dikunci';
  is_locked?: boolean;
}

interface LockStatus {
  is_locked: boolean;
  is_partially_locked?: boolean;
  status: 'draft' | 'sebagian_dikunci' | 'dikunci';
  locked_count?: number;
  total_count?: number;
  dikunci_pada?: string | null;
  dikunci_oleh_nama?: string | null;
  alasan_buka_kunci?: string | null;
  can_unlock?: boolean;
}

interface SessionData {
  jenis: string;
  kategori?: string;
  nama_roster?: string;
  nama_kelompok: string;
  target_id: number;
  bulan: number;
  tahun: number;
  aspek: string[];
  kepribadian_jenis: string[];
  santri: SantriEntry[];
  lock_status?: LockStatus;
}

const BULAN_NAMA = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const nowJakarta = () => {
  const d = new Date();
  const jkt = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  return { bulan: jkt.getMonth() + 1, tahun: jkt.getFullYear() };
};

const getSemester = (bulan: number): 'Ganjil' | 'Genap' => bulan >= 7 ? 'Ganjil' : 'Genap';

const getTahunPelajaran = (bulan: number, tahun: number): string => {
  if (bulan >= 7) return `${tahun}-${tahun + 1}`;
  return `${tahun - 1}-${tahun}`;
};

export function RaportInputPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { bulan: initBulan, tahun: initTahun } = nowJakarta();

  const paramJenis = searchParams.get('jenis') || '';
  const paramKelompok = searchParams.get('kelompok') || '';
  const paramTargetId = searchParams.get('target_id') || searchParams.get('roster') || '';
  const paramBulan = searchParams.get('bulan');
  const paramTahun = searchParams.get('tahun');

  const [selectedJenis, setSelectedJenis] = useState(paramJenis);
  const [selectedKategori, setSelectedKategori] = useState(paramKelompok);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(paramTargetId ? Number(paramTargetId) : null);
  const [bulan, setBulan] = useState(paramBulan ? Number(paramBulan) : initBulan);
  const [tahun, setTahun] = useState(paramTahun ? Number(paramTahun) : initTahun);
  const [downloadingBulk, setDownloadingBulk] = useState(false);
  const [localData, setLocalData] = useState<Record<number, {
    nilai: Record<string, number | null>;
    kepribadian: Record<string, string | null>;
    keputusan: string | null;
    predikat_umum: string | null;
  }>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showLockConfirmModal, setShowLockConfirmModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');

  usePageMeta({
    title: 'Input Raport Pengajian',
    description: 'Formulir input nilai raport pengajian Al-Qur\'an dan Takhassus per kelompok santri.',
  });

  // 1. Fetch options
  const { data: options = [], isLoading: loadingOptions, isError: optionsError, refetch: refetchOptions } = useQuery<OptionGroup[]>({
    queryKey: ['raport-options', user?.petugas_id],
    queryFn: async () => (await api.get('/api/raport-pengajian/options')).data,
    enabled: !!user,
  });

  const isAdmin = user?.jabatan === 'Admin';
  const isNonAdmin = !isAdmin;

  const currentOption = options.find(o => o.jenis === selectedJenis);
  const availableKategori = useMemo(() => Array.from(
    new Set((currentOption?.targets ?? []).map(t => t.kategori).filter(Boolean))
  ) as string[], [currentOption]);

  const currentTarget = (currentOption?.targets ?? []).find(t => t.target_id === selectedTargetId);
  const activeKategori = selectedKategori || (currentTarget?.kategori ?? '');

  const availableRosters = useMemo(() => (currentOption?.targets ?? []).filter(
    t => !activeKategori || t.kategori === activeKategori
  ), [currentOption, activeKategori]);

  const allTargets = useMemo(() => options.flatMap(o => o.targets), [options]);
  const allowedTargetIds = useMemo(() => new Set(allTargets.map(t => t.target_id)), [allTargets]);

  // Dropdown disabled conditions
  const isJenisDisabled = isNonAdmin && options.length <= 1;
  const isKategoriDisabled = !selectedJenis || (isNonAdmin && availableKategori.length <= 1);
  const isRosterDisabled = !activeKategori || (isNonAdmin && availableRosters.length <= 1);

  // Auto-selection and snap for non-admin
  useEffect(() => {
    if (options.length === 0) return;

    // 1. Auto-select or validate jenis
    let curJenis = selectedJenis;
    if (!curJenis || !options.some(o => o.jenis === curJenis)) {
      curJenis = options[0].jenis;
      setSelectedJenis(curJenis);
      setSelectedKategori('');
      setSelectedTargetId(null);
    }

    const opt = options.find(o => o.jenis === curJenis);
    if (!opt) return;

    // 2. Auto-select or validate kategori
    const katList = Array.from(new Set(opt.targets.map(t => t.kategori).filter(Boolean))) as string[];
    let curKat = selectedKategori;
    if (selectedTargetId && (!curKat || !katList.includes(curKat))) {
      const matchTarget = opt.targets.find(t => t.target_id === selectedTargetId);
      if (matchTarget?.kategori) {
        curKat = matchTarget.kategori;
        setSelectedKategori(curKat);
      }
    }
    if (katList.length > 0) {
      if (!curKat || !katList.includes(curKat)) {
        curKat = katList[0];
        setSelectedKategori(curKat);
        setSelectedTargetId(null);
      }
    }

    // 3. Auto-select or validate roster target_id
    const rosters = opt.targets.filter(t => !curKat || t.kategori === curKat);
    if (rosters.length > 0) {
      if (!selectedTargetId || (!isAdmin && !allowedTargetIds.has(selectedTargetId)) || !rosters.some(r => r.target_id === selectedTargetId)) {
        setSelectedTargetId(rosters[0].target_id);
      }
    }
  }, [options, selectedJenis, selectedKategori, selectedTargetId, isAdmin, allowedTargetIds]);

  // 2. Fetch session data
  const sessionEnabled = !!selectedJenis && !!selectedTargetId;
  const { data: session, isLoading: loadingSession, error: sessionError } = useQuery<SessionData>({
    queryKey: ['raport-session', selectedJenis, selectedTargetId, bulan, tahun],
    queryFn: async () => (await api.get('/api/raport-pengajian/session', {
      params: { jenis: selectedJenis, target_id: selectedTargetId, bulan, tahun },
    })).data,
    enabled: sessionEnabled,
  });

  // Init local data when session loads
  const initLocalData = useCallback((s: SessionData) => {
    const data: typeof localData = {};
    for (const santri of s.santri) {
      data[santri.santri_id] = {
        nilai: { ...santri.nilai },
        kepribadian: { ...santri.kepribadian },
        keputusan: santri.keputusan,
        predikat_umum: santri.predikat_umum,
      };
    }
    setLocalData(data);
    setHasUnsavedChanges(false);
  }, []);

  // Re-init when session changes
  const [lastSessionKey, setLastSessionKey] = useState('');
  const currentKey = `${selectedJenis}-${selectedTargetId}-${bulan}-${tahun}`;
  if (session && currentKey !== lastSessionKey) {
    initLocalData(session);
    setLastSessionKey(currentKey);
  }

  // 3. Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('No session');
      const entries = session.santri.map(santri => {
        const local = localData[santri.santri_id];
        return {
          santri_id: santri.santri_id,
          nilai: local?.nilai ?? {},
          kepribadian: local?.kepribadian ?? {},
          keputusan: local?.keputusan ?? null,
          predikat_umum: local?.predikat_umum ?? null,
        };
      });
      return (await api.post('/api/raport-pengajian/bulk', {
        jenis: selectedJenis,
        target_id: selectedTargetId,
        bulan,
        tahun,
        tahun_pelajaran: getTahunPelajaran(bulan, tahun),
        semester: getSemester(bulan),
        entries,
      })).data;
    },
    onSuccess: (data) => {
      setHasUnsavedChanges(false);
      setSaveResult({ type: 'success', message: data.message || 'Raport berhasil disimpan' });
      void queryClient.invalidateQueries({ queryKey: ['raport-session'] });
      void queryClient.invalidateQueries({ queryKey: ['raport-pengajian-summary'] });
    },
    onError: () => {
      setSaveResult({ type: 'error', message: 'Gagal menyimpan raport. Silakan coba kembali.' });
    },
  });

  const isLocked = session?.lock_status?.is_locked ?? false;

  const handleBack = async () => {
    if (hasUnsavedChanges && !isLocked && session) {
      setIsAutoSaving(true);
      try {
        const entries = session.santri.map(santri => {
          const local = localData[santri.santri_id];
          return {
            santri_id: santri.santri_id,
            nilai: local?.nilai ?? {},
            kepribadian: local?.kepribadian ?? {},
            keputusan: local?.keputusan ?? null,
            predikat_umum: local?.predikat_umum ?? null,
          };
        });

        await api.post('/api/raport-pengajian/bulk', {
          jenis: selectedJenis,
          target_id: selectedTargetId,
          bulan,
          tahun,
          tahun_pelajaran: getTahunPelajaran(bulan, tahun),
          semester: getSemester(bulan),
          entries,
        });

        await queryClient.invalidateQueries({ queryKey: ['raport-pengajian-summary'] });
        await queryClient.invalidateQueries({ queryKey: ['raport-session'] });
      } catch (e) {
        console.error('Gagal auto-save draft saat kembali:', e);
      } finally {
        setIsAutoSaving(false);
      }
    } else {
      await queryClient.invalidateQueries({ queryKey: ['raport-pengajian-summary'] });
    }
    navigate('/raport');
  };

  const completedCount = useMemo(() => {
    if (!session) return 0;
    return session.santri.filter(santri => {
      const local = localData[santri.santri_id];
      if (!local) return false;
      return session.aspek.length > 0 && session.aspek.every(a => local.nilai?.[a] !== null && local.nilai?.[a] !== undefined && String(local.nilai?.[a]).trim() !== '');
    }).length;
  }, [session, localData]);

  const readyToLockSantri = useMemo(() => {
    if (!session) return [];
    return session.santri.filter(santri => {
      if (santri.is_locked) return false;
      const local = localData[santri.santri_id];
      if (!local) return false;
      return session.aspek.length > 0 && session.aspek.every(a => local.nilai?.[a] !== null && local.nilai?.[a] !== undefined && String(local.nilai?.[a]).trim() !== '');
    });
  }, [session, localData]);

  const incompleteSantriList = useMemo(() => {
    if (!session) return [];
    return session.santri.filter(santri => {
      if (santri.is_locked) return false;
      const local = localData[santri.santri_id];
      if (!local) return true;
      return !(session.aspek.length > 0 && session.aspek.every(a => local.nilai?.[a] !== null && local.nilai?.[a] !== undefined && String(local.nilai?.[a]).trim() !== ''));
    });
  }, [session, localData]);

  const lockedSantriCount = useMemo(() => {
    if (!session) return 0;
    return session.santri.filter(santri => santri.is_locked).length;
  }, [session]);

  const lockMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJenis || !selectedTargetId) throw new Error('Parameter tidak lengkap');
      return (await api.post('/api/raport-pengajian/lock', {
        jenis: selectedJenis,
        target_id: selectedTargetId,
        bulan,
        tahun,
      })).data;
    },
    onSuccess: (data) => {
      setShowLockConfirmModal(false);
      setSaveResult({ type: 'success', message: data.message || 'Raport pengajian berhasil dikunci.' });
      void queryClient.invalidateQueries({ queryKey: ['raport-session'] });
      void queryClient.invalidateQueries({ queryKey: ['raport-pengajian-summary'] });
    },
    onError: (err: any) => {
      setShowLockConfirmModal(false);
      setSaveResult({ type: 'error', message: err.response?.data?.message || 'Gagal mengunci raport pengajian.' });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async (alasan: string) => {
      if (!selectedJenis || !selectedTargetId) throw new Error('Parameter tidak lengkap');
      return (await api.post('/api/raport-pengajian/unlock', {
        jenis: selectedJenis,
        target_id: selectedTargetId,
        bulan,
        tahun,
        alasan,
      })).data;
    },
    onSuccess: (data) => {
      setShowUnlockModal(false);
      setUnlockReason('');
      setSaveResult({ type: 'success', message: data.message || 'Kunci raport berhasil dibuka kembali.' });
      void queryClient.invalidateQueries({ queryKey: ['raport-session'] });
      void queryClient.invalidateQueries({ queryKey: ['raport-pengajian-summary'] });
    },
    onError: (err: any) => {
      setShowUnlockModal(false);
      setSaveResult({ type: 'error', message: err.response?.data?.message || 'Gagal membuka kunci raport pengajian.' });
    },
  });

  const updateNilai = (santriId: number, aspek: string, value: string) => {
    const num = value === '' ? null : Math.max(0, Math.min(100, parseInt(value, 10)));
    setHasUnsavedChanges(true);
    setLocalData(prev => ({
      ...prev,
      [santriId]: {
        ...prev[santriId],
        nilai: { ...prev[santriId]?.nilai, [aspek]: isNaN(num as number) ? null : num },
      },
    }));
  };

  const updateKepribadian = (santriId: number, jenis: string, value: string) => {
    setHasUnsavedChanges(true);
    setLocalData(prev => ({
      ...prev,
      [santriId]: {
        ...prev[santriId],
        kepribadian: { ...prev[santriId]?.kepribadian, [jenis]: value || null },
      },
    }));
  };

  const updateKeputusan = (santriId: number, value: string) => {
    setHasUnsavedChanges(true);
    setLocalData(prev => ({
      ...prev,
      [santriId]: { ...prev[santriId], keputusan: value || null },
    }));
  };

  const updatePredikatUmum = (santriId: number, value: string) => {
    setHasUnsavedChanges(true);
    setLocalData(prev => ({
      ...prev,
      [santriId]: { ...prev[santriId], predikat_umum: value || null },
    }));
  };

  const handleDownloadPdfBulk = async () => {
    if (!selectedJenis || !selectedTargetId) return;
    setDownloadingBulk(true);
    try {
      const response = await api.get(`/api/raport-pengajian/kelompok/${selectedJenis}/${selectedTargetId}/pdf`, {
        params: { bulan, tahun },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Raport_Bulk_${selectedJenis}_${bulan}_${tahun}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('Gagal mengunduh PDF bulk. Pastikan setidaknya 1 santri sudah diisi nilai.');
    } finally {
      setDownloadingBulk(false);
    }
  };

  return (
    <section className="app-container raport-page">
      <div style={{ marginBottom: '14px' }}>
        <button
          type="button"
          className="santri-back-link"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#0f766e',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          disabled={isAutoSaving}
          onClick={handleBack}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>{isAutoSaving ? 'Menyimpan draft & kembali...' : 'Kembali ke Raport Pengajian'}</span>
        </button>
      </div>

      <h1 className="ui-text-title" style={{ marginBottom: '20px' }}>Input Raport Pengajian</h1>

      {optionsError && (
        <div className="error-box" role="alert">
          Sesi login tidak valid atau sudah berakhir. Masuk kembali untuk memuat data Raport.
          <button type="button" className="secondary-button" onClick={() => void refetchOptions()}>Coba lagi</button>
        </div>
      )}

      {/* Parameter selectors */}
      <div className="raport-selectors">
        <div className="raport-selector-row">
          <div className="raport-field">
            <AppDropdown
              id="raport-input-jenis"
              label="Jenis Pengajian"
              value={selectedJenis}
              placeholder="— Pilih jenis —"
              disabled={isJenisDisabled}
              options={options.map(option => ({ value: option.jenis, label: option.nama }))}
              onChange={value => {
                setSelectedJenis(value);
                setSelectedKategori('');
                setSelectedTargetId(null);
                setLastSessionKey('');
              }}
            />
          </div>

          <div className="raport-field">
            <AppDropdown
              id="raport-input-kelompok"
              label="Kelompok"
              value={activeKategori}
              options={availableKategori.map(cat => ({ value: cat, label: cat }))}
              placeholder="— Pilih kelompok —"
              disabled={isKategoriDisabled}
              onChange={value => {
                setSelectedKategori(value);
                setSelectedTargetId(null);
                setLastSessionKey('');
              }}
            />
          </div>

          <div className="raport-field">
            <AppDropdown
              id="raport-input-roster"
              label="Roster"
              value={selectedTargetId ? String(selectedTargetId) : ''}
              options={availableRosters.map(target => ({
                value: String(target.target_id),
                label: `${target.nama_roster || target.nama_target}${typeof target.santri_count === 'number' ? ` (${target.santri_count} santri)` : ''}`,
              }))}
              placeholder="— Pilih roster —"
              disabled={isRosterDisabled}
              searchable
              searchPlaceholder="Cari nama roster..."
              onChange={value => {
                setSelectedTargetId(Number(value) || null);
                setLastSessionKey('');
              }}
            />
            {isRosterDisabled && availableRosters.length > 0 && isNonAdmin && (
              <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                Roster tugas Anda ({availableRosters[0]?.nama_roster || availableRosters[0]?.nama_target})
              </small>
            )}
          </div>

          <div className="raport-field">
            <AppDropdown
              id="raport-input-bulan"
              label="Bulan"
              value={String(bulan)}
              options={BULAN_NAMA.slice(1).map((nama, index) => ({ value: String(index + 1), label: nama }))}
              onChange={value => { setBulan(Number(value)); setLastSessionKey(''); }}
            />
          </div>

          <div className="raport-field">
            <AppDropdown
              id="raport-input-tahun"
              label="Tahun"
              value={String(tahun)}
              options={Array.from({ length: 5 }, (_, i) => {
                const year = initTahun - 2 + i;
                return { value: String(year), label: String(year) };
              })}
              onChange={value => { setTahun(Number(value)); setLastSessionKey(''); }}
            />
          </div>
        </div>

        {sessionEnabled && (
          <div className="raport-info-bar">
            <span>Tahun Pelajaran: <strong>{getTahunPelajaran(bulan, tahun)}</strong></span>
            <span>Semester: <strong>{getSemester(bulan)}</strong></span>
            {activeKategori && <span>Kelompok: <strong>{activeKategori}</strong></span>}
            {session && <span>Roster: <strong>{session.nama_roster || session.nama_kelompok}</strong></span>}
            {session && <span>Jumlah santri: <strong>{session.santri.length}</strong></span>}
            {session && (
              <span>Lengkap: <strong>{completedCount}/{session.santri.length}</strong></span>
            )}
            {session?.lock_status?.is_locked ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Terkunci Penuh
              </span>
            ) : (session?.lock_status?.is_partially_locked || lockedSantriCount > 0) ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Terkunci Sebagian ({lockedSantriCount}/{session?.santri?.length ?? 0})
              </span>
            ) : null}
          </div>
        )}

        {(session?.lock_status?.is_locked || session?.lock_status?.is_partially_locked || lockedSantriCount > 0) && (
          <div
            style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '12.5px',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <strong style={{ color: '#0f172a' }}>
                {session?.lock_status?.is_locked
                  ? 'Seluruh santri pada raport ini telah dikunci (Final).'
                  : `Sebagian santri telah dikunci (${lockedSantriCount} dari ${session?.santri?.length ?? 0} santri). Santri yang belum lengkap tetap berstatus draft (susulan).`}
              </strong>
              {session?.lock_status?.dikunci_oleh_nama && (
                <span style={{ color: '#64748b', marginLeft: '6px' }}>
                  Dikunci oleh <strong>{session.lock_status.dikunci_oleh_nama}</strong>
                  {session.lock_status.dikunci_pada ? ` pada ${new Date(session.lock_status.dikunci_pada).toLocaleString('id-ID')}` : ''}.
                </span>
              )}
            </div>
            {session?.lock_status?.can_unlock && (
              <button
                type="button"
                className="secondary-button"
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={() => setShowUnlockModal(true)}
              >
                Buka Kunci Raport
              </button>
            )}
          </div>
        )}

        {!session?.lock_status?.is_locked && session?.lock_status?.alasan_buka_kunci && (
          <div
            style={{
              marginTop: '12px',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fef3c7',
              fontSize: '12px',
              color: '#92400e',
            }}
          >
            <strong>Riwayat Pembukaan Kunci:</strong> &ldquo;{session.lock_status.alasan_buka_kunci}&rdquo;
          </div>
        )}
      </div>

      {/* Loading / Error states */}
      {loadingOptions && <ContentSkeleton rows={3} />}
      {loadingSession && sessionEnabled && <ContentSkeleton rows={5} />}
      {sessionError && <div className="error-box">Gagal memuat data. Pastikan Anda memiliki penugasan pada kelompok ini.</div>}

      {/* Save result modal */}
      {saveResult && (
        <div className="save-modal-backdrop" role="presentation">
          <div aria-modal="true" className={`save-modal ${saveResult.type}`} role="dialog">
            <div className="save-modal-icon" aria-hidden="true">{saveResult.type === 'success' ? 'V' : '!'}</div>
            <h2>{saveResult.type === 'success' ? 'Berhasil' : 'Gagal'}</h2>
            <p>{saveResult.message}</p>
            <div className="save-modal-actions" style={{ flexDirection: 'column', gap: '8px' }}>
              {saveResult.type === 'success' && (
                <>
                  <button className="secondary-button" disabled={downloadingBulk} onClick={() => void handleDownloadPdfBulk()}>
                    {downloadingBulk ? 'Mengunduh...' : 'Download PDF 1 Kelompok'}
                  </button>
                  <button className="secondary-button" onClick={() => navigate(`/raport/lihat?jenis=${selectedJenis}&kelompok=${selectedTargetId}&bulan=${bulan}&tahun=${tahun}`)}>
                    Lihat Hasil Raport Kelompok
                  </button>
                </>
              )}
              {saveResult.type === 'error' && (
                <button className="secondary-button" onClick={() => { setSaveResult(null); saveMutation.mutate(); }}>Coba lagi</button>
              )}
              <button className="primary-button" onClick={() => setSaveResult(null)}>
                {saveResult.type === 'success' ? 'Selesai' : 'Tutup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lock Confirmation Modal */}
      {showLockConfirmModal && (
        <div className="save-modal-backdrop" role="presentation">
          <div aria-modal="true" className="save-modal" role="dialog" style={{ maxWidth: '520px', textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#0f172a' }}>Kunci Raport Pengajian</h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
              Anda akan mengunci nilai Raport Pengajian untuk <strong>{session?.nama_roster || session?.nama_kelompok}</strong> periode <strong>{BULAN_NAMA[bulan]} {tahun}</strong>.
            </p>

            <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '14px', fontSize: '12.5px', color: '#334155', lineHeight: '1.5' }}>
              <div style={{ marginBottom: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <span>Siap Dikunci: <strong style={{ color: '#15803d' }}>{readyToLockSantri.length} santri</strong></span>
                {lockedSantriCount > 0 && (
                  <span>Sudah Terkunci: <strong style={{ color: '#0369a1' }}>{lockedSantriCount} santri</strong></span>
                )}
                {incompleteSantriList.length > 0 && (
                  <span>Belum Lengkap (Susulan): <strong style={{ color: '#b45309' }}>{incompleteSantriList.length} santri</strong></span>
                )}
              </div>

              {incompleteSantriList.length > 0 ? (
                <div style={{ marginTop: '8px', padding: '8px 10px', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fef3c7', fontSize: '12px', color: '#92400e' }}>
                  <strong>Santri belum lengkap:</strong> {incompleteSantriList.map(s => s.nama).slice(0, 5).join(', ')}{incompleteSantriList.length > 5 ? ` dan ${incompleteSantriList.length - 5} lainnya` : ''}.
                  <div style={{ marginTop: '4px' }}>
                    Santri yang lengkap akan langsung <strong>terbit ke wali santri</strong>. Santri yang belum lengkap tetap berstatus <strong>Draft</strong> dan dapat disusulkan nilainya nanti.
                  </div>
                </div>
              ) : (
                <div style={{ color: '#166534' }}>
                  Seluruh santri memiliki nilai lengkap. Setelah dikunci, seluruh nilai bersifat <strong>final</strong> dan otomatis terbit ke Portal Wali Santri.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="secondary-button" disabled={lockMutation.isPending} onClick={() => setShowLockConfirmModal(false)}>
                Batal
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={lockMutation.isPending || readyToLockSantri.length === 0}
                onClick={() => lockMutation.mutate()}
                style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
              >
                {lockMutation.isPending ? 'Mengunci…' : `Ya, Kunci ${readyToLockSantri.length} Santri Lengkap`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Reason Modal */}
      {showUnlockModal && (
        <div className="save-modal-backdrop" role="presentation">
          <div aria-modal="true" className="save-modal" role="dialog" style={{ maxWidth: '480px', textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#0f172a' }}>Buka Kunci Raport Pengajian</h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
              Membuka kunci akan mengembalikan status raport menjadi <strong>Draft</strong> sehingga nilai santri dapat diperbarui kembali.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="unlock-reason" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Alasan Pembukaan Kunci (Wajib):
              </label>
              <textarea
                id="unlock-reason"
                className="matrix-note-input"
                style={{ width: '100%', minHeight: '80px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                placeholder="Tuliskan alasan spesifik pembukaan kunci..."
                value={unlockReason}
                onChange={e => setUnlockReason(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="secondary-button" disabled={unlockMutation.isPending} onClick={() => setShowUnlockModal(false)}>
                Batal
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={unlockMutation.isPending || !unlockReason.trim()}
                onClick={() => unlockMutation.mutate(unlockReason.trim())}
              >
                {unlockMutation.isPending ? 'Membuka…' : 'Buka Kunci'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Table */}
      {session && session.santri.length > 0 && (
        <>
          <div className="raport-table-wrapper" style={{ borderRadius: '20px' }}>
            <table className="raport-input-table">
              <thead>
                <tr>
                  <th className="raport-th-no col-sticky-no" rowSpan={2}>No</th>
                  <th className="raport-th-nama col-sticky-name" rowSpan={2}>Nama Santri</th>
                  <th colSpan={session.aspek.length}>Nilai Aspek Penilaian (0–100)</th>
                  <th colSpan={session.kepribadian_jenis.length}>Kepribadian</th>
                  <th className="raport-th-keputusan" rowSpan={2}>Keputusan</th>
                  <th className="raport-th-predikat" rowSpan={2}>Predikat Umum</th>
                </tr>
                <tr>
                  {session.aspek.map(a => <th key={a} className="raport-th-aspek">{a}</th>)}
                  {session.kepribadian_jenis.map(k => <th key={k} className="raport-th-kepribadian">{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {session.santri.map((santri, idx) => {
                  const local = localData[santri.santri_id];
                  const isSantriLocked = isLocked || (santri.is_locked ?? false);
                  const isComplete = session.aspek.length > 0 && session.aspek.every(a => local?.nilai?.[a] !== null && local?.nilai?.[a] !== undefined && String(local?.nilai?.[a]).trim() !== '');
                  return (
                    <tr key={santri.santri_id} className={isSantriLocked ? 'row-locked' : (isComplete ? 'row-completed' : (idx % 2 === 0 ? '' : 'raport-row-alt'))}>
                      <td className="raport-td-no col-sticky-no" style={{ fontSize: '13px', textAlign: 'center' }}>{idx + 1}</td>
                      <td className="raport-td-nama col-sticky-name" style={{ textAlign: 'left' }}>
                        <div className="raport-nama-text" style={{ wordBreak: 'break-word' }}>{santri.nama}</div>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                          {santri.no_id_induk ? (
                            <span className="raport-nis-text">NIP: {santri.no_id_induk}</span>
                          ) : (
                            <span className="raport-nis-text" style={{ color: '#94a3b8' }}>NIP: —</span>
                          )}
                          {isSantriLocked ? (
                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontWeight: 700 }}>Terkunci</span>
                          ) : isComplete ? (
                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>Lengkap</span>
                          ) : (
                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>Draft / Susulan</span>
                          )}
                        </div>
                      </td>
                      {session.aspek.map(aspek => (
                        <td key={aspek} className="raport-td-input">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            disabled={isSantriLocked}
                            className="raport-input-nilai no-spin-input"
                            value={local?.nilai?.[aspek] ?? ''}
                            onChange={e => updateNilai(santri.santri_id, aspek, e.target.value)}
                            onWheel={e => e.currentTarget.blur()}
                            placeholder="—"
                            aria-label={`Nilai ${aspek} untuk ${santri.nama}`}
                          />
                        </td>
                      ))}
                      {session.kepribadian_jenis.map(jenis => (
                        <td key={jenis} className="raport-td-select">
                          <AppDropdown
                            className="app-dropdown-table"
                            disabled={isSantriLocked}
                            value={local?.kepribadian?.[jenis] ?? ''}
                            options={['A', 'B', 'C', 'D', 'E'].map(value => ({ value, label: value }))}
                            placeholder="—"
                            ariaLabel={`Nilai kepribadian ${jenis} untuk ${santri.nama}`}
                            onChange={value => updateKepribadian(santri.santri_id, jenis, value)}
                          />
                        </td>
                      ))}
                      <td className="raport-td-select">
                        <AppDropdown
                          className="app-dropdown-table"
                          disabled={isSantriLocked}
                          value={local?.keputusan ?? ''}
                          options={[{ value: 'Naik', label: 'Naik' }, { value: 'Tidak Naik', label: 'Tidak Naik' }]}
                          placeholder="—"
                          ariaLabel={`Keputusan untuk ${santri.nama}`}
                          onChange={value => updateKeputusan(santri.santri_id, value)}
                        />
                      </td>
                      <td className="raport-td-select raport-td-predikat">
                        <AppDropdown
                          className="app-dropdown-table app-dropdown-predikat"
                          disabled={isSantriLocked}
                          value={local?.predikat_umum ?? ''}
                          options={['Sangat Memuaskan', 'Memuaskan', 'Baik', 'Cukup', 'Kurang', 'Sangat Kurang'].map(value => ({ value, label: value }))}
                          placeholder="—"
                          ariaLabel={`Predikat umum untuk ${santri.nama}`}
                          onChange={value => updatePredikatUmum(santri.santri_id, value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* =========================================================
              STICKY BOTTOM ACTION BAR (PERSIS RAPORT PEMBINAAN)
             ========================================================= */}
          <div className="raport-sticky-bar">
            <div className="sticky-bar-progress">
              <div>
                <span className="sticky-bar-progress-text">
                  Kemajuan Pengisian: <strong>{completedCount}</strong> dari{' '}
                  <strong>{session.santri.length}</strong> santri lengkap
                </span>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  {completedCount === session.santri.length ? (
                    <span style={{ color: '#166534', fontWeight: 600 }}>Seluruh santri telah lengkap dinilai</span>
                  ) : (
                    <span>
                      {session.santri.length - completedCount} santri masih perlu dilengkapi
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="sticky-bar-actions">
              <button
                type="button"
                className="pdf-download-btn"
                style={{
                  height: '44px',
                  minHeight: '44px',
                  padding: '0 18px',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                }}
                disabled={downloadingBulk}
                onClick={() => void handleDownloadPdfBulk()}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>{downloadingBulk ? 'Mengunduh…' : 'Download PDF 1 Kelompok'}</span>
              </button>

              <div className="raport-action-group">
                {session?.lock_status?.can_unlock && (isLocked || (session.lock_status?.is_partially_locked ?? false) || lockedSantriCount > 0) && (
                  <button
                    type="button"
                    style={{
                      height: '44px',
                      minHeight: '44px',
                      padding: '0 18px',
                      fontSize: '14px',
                      fontWeight: 600,
                      backgroundColor: '#ffffff',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      cursor: unlockMutation.isPending ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                      transition: 'background-color 0.15s ease',
                    }}
                    disabled={unlockMutation.isPending}
                    onClick={() => setShowUnlockModal(true)}
                  >
                    {unlockMutation.isPending ? 'Membuka…' : 'Buka Kunci Raport'}
                  </button>
                )}

                {!isLocked && (
                  <>
                    <button
                      type="button"
                      style={{
                        height: '44px',
                        minHeight: '44px',
                        padding: '0 18px',
                        fontSize: '14px',
                        fontWeight: 600,
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: saveMutation.isPending ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        if (!saveMutation.isPending) e.currentTarget.style.backgroundColor = '#1d4ed8';
                      }}
                      onMouseLeave={e => {
                        if (!saveMutation.isPending) e.currentTarget.style.backgroundColor = '#2563eb';
                      }}
                      disabled={saveMutation.isPending}
                      onClick={() => saveMutation.mutate()}
                    >
                      {saveMutation.isPending
                        ? 'Menyimpan…'
                        : hasUnsavedChanges
                        ? `Simpan Perubahan (${session.santri.length} Santri)`
                        : `Simpan Raport (${session.santri.length} Santri)`}
                    </button>

                    <button
                      type="button"
                      style={{
                        height: '44px',
                        minHeight: '44px',
                        padding: '0 18px',
                        fontSize: '14px',
                        fontWeight: 600,
                        backgroundColor: readyToLockSantri.length > 0 && !hasUnsavedChanges ? '#16a34a' : '#94a3b8',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: readyToLockSantri.length > 0 && !hasUnsavedChanges && !lockMutation.isPending ? 'pointer' : 'not-allowed',
                        opacity: lockMutation.isPending ? 0.7 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        if (readyToLockSantri.length > 0 && !hasUnsavedChanges && !lockMutation.isPending) {
                          e.currentTarget.style.backgroundColor = '#15803d';
                        }
                      }}
                      onMouseLeave={e => {
                        if (readyToLockSantri.length > 0 && !hasUnsavedChanges && !lockMutation.isPending) {
                          e.currentTarget.style.backgroundColor = '#16a34a';
                        }
                      }}
                      disabled={readyToLockSantri.length === 0 || hasUnsavedChanges || lockMutation.isPending}
                      title={
                        hasUnsavedChanges
                          ? 'Simpan perubahan terlebih dahulu sebelum mengunci'
                          : readyToLockSantri.length === 0
                          ? (lockedSantriCount === session.santri.length ? 'Semua santri sudah terkunci' : 'Belum ada santri baru dengan nilai lengkap untuk dikunci')
                          : 'Kunci nilai santri yang lengkap'
                      }
                      onClick={() => setShowLockConfirmModal(true)}
                    >
                      {lockMutation.isPending ? 'Mengunci...' : (lockedSantriCount > 0 ? `Kunci Susulan (${readyToLockSantri.length})` : 'Kunci Raport')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {session && session.santri.length === 0 && (
        <div className="empty-state">Belum ada santri pada roster ini.</div>
      )}

      {!sessionEnabled && !loadingOptions && options.length > 0 && (
        <div className="empty-state">
          {!selectedJenis
            ? 'Pilih jenis pengajian untuk mulai input raport.'
            : !activeKategori
            ? 'Pilih kelompok untuk menampilkan pilihan roster.'
            : 'Pilih roster pengajian untuk melihat daftar santri.'}
        </div>
      )}

      {!loadingOptions && !optionsError && options.length === 0 && (
        <div className="empty-state">Tidak ada kelompok yang ditugaskan kepada Anda. Hubungi Admin untuk menambahkan penugasan.</div>
      )}
    </section>
  );
}

export default RaportInputPage;
