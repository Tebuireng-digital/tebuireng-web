import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { AppDropdown } from '../components/AppDropdown';
import { ContentSkeleton } from '../components/LoadingSkeleton';
import { usePageMeta } from '../hooks/usePageMeta';

interface Instrument {
  instrumen_id: number;
  nama_instrumen: string;
}

interface SantriEntry {
  santri_id: number;
  nis: string | null;
  no_id_induk?: string | null;
  nama: string;
  nilai: Record<number, number | null>;
  catatan: Record<number, string>;
  raport_ubudiyah_id: number | null;
  status?: 'draft' | 'dikunci';
  is_locked?: boolean;
}

interface LockStatus {
  is_locked: boolean;
  is_partially_locked?: boolean;
  status: 'draft' | 'sebagian_dikunci' | 'dikunci';
  locked_count?: number;
  total_count?: number;
  dikunci_pada: string | null;
  dikunci_oleh_nama: string | null;
  alasan_buka_kunci: string | null;
  can_unlock: boolean;
}

interface SessionData {
  nama_kamar: string;
  target_id: number;
  bulan: number;
  tahun: number;
  aspek: Instrument[];
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

const getTahunPelajaran = (bulan: number, tahun: number) => {
  if (bulan >= 7) {
    return `${tahun}/${tahun + 1}`;
  }
  return `${tahun - 1}/${tahun}`;
};

const getSemester = (bulan: number) => {
  return bulan >= 7 ? 'Ganjil' : 'Genap';
};

const getLetterGrade = (score: number | null): string => {
  if (score === null || isNaN(score)) return '—';
  if (score >= 85) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'E';
};

const getLetterLabel = (score: number | null): string => {
  if (score === null || isNaN(score)) return '—';
  if (score >= 85) return 'Sangat Baik';
  if (score >= 80) return 'Baik';
  if (score >= 75) return 'Baik';
  if (score >= 70) return 'Cukup';
  if (score >= 60) return 'Cukup';
  if (score >= 50) return 'Kurang';
  return 'Sangat Kurang';
};

export function UbudiyahFormPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const kamarParam = searchParams.get('kamar');
  const bulanParam = searchParams.get('bulan');
  const tahunParam = searchParams.get('tahun');
  const { bulan: initBulan, tahun: initTahun } = nowJakarta();

  const [selectedKamarId, setSelectedKamarId] = useState<number | null>(() => kamarParam ? Number(kamarParam) : null);
  const [bulan, setBulan] = useState(() => bulanParam ? Number(bulanParam) : initBulan);
  const [tahun, setTahun] = useState(() => tahunParam ? Number(tahunParam) : initTahun);
  const [downloadingBulk, setDownloadingBulk] = useState(false);
  const [expandedSantriId, setExpandedSantriId] = useState<number | null>(null);

  // View Mode: Matrix (Spreadsheet Grid) or Cards (Accordion)
  const [viewMode, setViewMode] = useState<'matrix' | 'cards'>('matrix');

  // Quick fill confirmation modal
  const [showQuickFillConfirm, setShowQuickFillConfirm] = useState(false);

  const [localData, setLocalData] = useState<Record<number, {
    nilai: Record<number, number | null>;
    catatanSantri: string;
  }>>({});

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showLockConfirmModal, setShowLockConfirmModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const handleBack = async () => {
    if (hasUnsavedChanges && !isLocked && session) {
      setIsAutoSaving(true);
      try {
        const entries = session.santri.map(santri => {
          const local = localData[santri.santri_id];
          const santriNote = (local?.catatanSantri ?? '').trim();
          const filledAspect = session.aspek.find(a => local?.nilai?.[a.instrumen_id] !== null && local?.nilai?.[a.instrumen_id] !== undefined) || session.aspek[0];

          const catatanPayload: Record<number, string> = {};
          session.aspek.forEach(a => {
            if (filledAspect && a.instrumen_id === filledAspect.instrumen_id) {
              catatanPayload[a.instrumen_id] = santriNote;
            } else {
              catatanPayload[a.instrumen_id] = '';
            }
          });

          return {
            santri_id: santri.santri_id,
            nilai: local?.nilai ?? {},
            catatan: catatanPayload,
          };
        });

        await api.post('/api/ubudiyah/bulk', {
          target_id: selectedKamarId,
          bulan,
          tahun,
          tahun_pelajaran: getTahunPelajaran(bulan, tahun),
          semester: getSemester(bulan),
          entries,
        });

        await queryClient.invalidateQueries({ queryKey: ['ubudiyah-kamar-summary'] });
        await queryClient.invalidateQueries({ queryKey: ['ubudiyah-session'] });
      } catch (err) {
        console.error('Gagal auto-save saat kembali', err);
      } finally {
        setIsAutoSaving(false);
      }
    } else {
      await queryClient.invalidateQueries({ queryKey: ['ubudiyah-kamar-summary'] });
    }
    navigate('/ubudiyah');
  };

  usePageMeta({
    title: 'Input Raport Pembinaan',
    description: 'Formulir input nilai laporan ibadah dan pembinaan santri per kamar.',
  });

  // 1. Fetch Room Options
  const { data: rooms = [], isLoading: loadingRooms, isError: roomsError, refetch: refetchRooms } = useQuery<{ target_id: number; nama_target: string }[]>({
    queryKey: ['ubudiyah-rooms', user?.petugas_id],
    queryFn: async () => (await api.get('/api/ubudiyah/options')).data,
    enabled: !!user,
  });

  const isAdmin = user?.jabatan === 'Admin';
  const isPembina = !isAdmin;
  const isKamarDisabled = isPembina && rooms.length <= 1;
  const allowedRoomIds = useMemo(() => new Set(rooms.map(r => r.target_id)), [rooms]);

  // Set default room or snap to assigned room for non-admin
  useEffect(() => {
    if (rooms.length > 0) {
      if (!selectedKamarId || (!isAdmin && !allowedRoomIds.has(selectedKamarId))) {
        setSelectedKamarId(rooms[0].target_id);
        setLastSessionKey('');
        setExpandedSantriId(null);
      }
    }
  }, [rooms, selectedKamarId, isAdmin, allowedRoomIds]);

  // 2. Fetch Session Data
  const sessionEnabled = !!selectedKamarId;
  const { data: session, isLoading: loadingSession, error: sessionError, refetch: refetchSession } = useQuery<SessionData>({
    queryKey: ['ubudiyah-session', selectedKamarId, bulan, tahun],
    queryFn: async () => (await api.get('/api/ubudiyah/session', {
      params: { target_id: selectedKamarId, bulan, tahun },
    })).data,
    enabled: sessionEnabled,
  });

  // Init local state when session loads
  const initLocalData = useCallback((s: SessionData) => {
    const data: typeof localData = {};
    for (const santri of s.santri) {
      const existingNote = Object.values(santri.catatan || {}).find(c => typeof c === 'string' && c.trim().length > 0) || '';
      data[santri.santri_id] = {
        nilai: { ...santri.nilai },
        catatanSantri: existingNote,
      };
    }
    setLocalData(data);
    setHasUnsavedChanges(false);
  }, []);

  // Sync session changes to local state
  const [lastSessionKey, setLastSessionKey] = useState('');
  const currentKey = `${selectedKamarId}-${bulan}-${tahun}`;
  if (session && currentKey !== lastSessionKey) {
    initLocalData(session);
    setLastSessionKey(currentKey);
  }

  // 3. Accurate Stats & Calculation Logic
  const calculatedStats = useMemo(() => {
    if (!session) {
      return {
        stats: {} as Record<number, {
          filledCount: number;
          totalAspek: number;
          isComplete: boolean;
          avg: number | null;
          total: number;
          letterGrade: string;
          predicate: string;
        }>,
        completedCount: 0,
        overallRoomAvg: 0,
        readyToLockSantri: [] as SantriEntry[],
        incompleteSantriList: [] as SantriEntry[],
        lockedSantriCount: 0,
      };
    }

    const totalAspek = session.aspek.length;
    const stats: Record<number, {
      filledCount: number;
      totalAspek: number;
      isComplete: boolean;
      avg: number | null;
      total: number;
      letterGrade: string;
      predicate: string;
    }> = {};

    session.santri.forEach(santri => {
      const local = localData[santri.santri_id];
      if (!local) {
        stats[santri.santri_id] = {
          filledCount: 0,
          totalAspek,
          isComplete: false,
          avg: null,
          total: 0,
          letterGrade: '—',
          predicate: '—',
        };
        return;
      }

      const scores = session.aspek
        .map(a => local.nilai[a.instrumen_id])
        .filter(v => v !== null && v !== undefined && !isNaN(v as number)) as number[];

      const filledCount = scores.length;
      const isComplete = totalAspek > 0 && filledCount === totalAspek;
      const total = scores.reduce((sum, v) => sum + v, 0);
      const avg = isComplete ? total / totalAspek : null;
      const letterGrade = avg !== null ? getLetterGrade(avg) : '—';
      const predicate = avg !== null ? getLetterLabel(avg) : '—';

      stats[santri.santri_id] = {
        filledCount,
        totalAspek,
        isComplete,
        avg,
        total,
        letterGrade,
        predicate,
      };
    });

    const completedSantri = session.santri
      .filter(s => stats[s.santri_id]?.isComplete && stats[s.santri_id]?.avg !== null);

    const completedCount = completedSantri.length;
    const overallRoomAvg = completedCount > 0
      ? completedSantri.reduce((sum, s) => sum + (stats[s.santri_id]?.avg ?? 0), 0) / completedCount
      : 0;

    const readyToLockSantri = session.santri.filter(s => !s.is_locked && stats[s.santri_id]?.isComplete);
    const incompleteSantriList = session.santri.filter(s => !s.is_locked && !stats[s.santri_id]?.isComplete);
    const lockedSantriCount = session.santri.filter(s => s.is_locked).length;

    return { stats, completedCount, overallRoomAvg, readyToLockSantri, incompleteSantriList, lockedSantriCount };
  }, [session, localData]);

  // 4. Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('No session');
      const entries = session.santri.map(santri => {
        const local = localData[santri.santri_id];
        const santriNote = (local?.catatanSantri ?? '').trim();
        const filledAspect = session.aspek.find(a => local?.nilai?.[a.instrumen_id] !== null && local?.nilai?.[a.instrumen_id] !== undefined) || session.aspek[0];

        const catatanPayload: Record<number, string> = {};
        session.aspek.forEach(a => {
          if (filledAspect && a.instrumen_id === filledAspect.instrumen_id) {
            catatanPayload[a.instrumen_id] = santriNote;
          } else {
            catatanPayload[a.instrumen_id] = '';
          }
        });

        return {
          santri_id: santri.santri_id,
          nilai: local?.nilai ?? {},
          catatan: catatanPayload,
        };
      });
      return (await api.post('/api/ubudiyah/bulk', {
        target_id: selectedKamarId,
        bulan,
        tahun,
        tahun_pelajaran: getTahunPelajaran(bulan, tahun),
        semester: getSemester(bulan),
        entries,
      })).data;
    },
    onSuccess: (data) => {
      setHasUnsavedChanges(false);
      setSaveResult({ type: 'success', message: data.message || 'Laporan Raport Pembinaan berhasil disimpan' });
      void queryClient.invalidateQueries({ queryKey: ['ubudiyah-session'] });
      void queryClient.invalidateQueries({ queryKey: ['ubudiyah-kamar-summary'] });
    },
    onError: (err: any) => {
      setSaveResult({ type: 'error', message: err.response?.data?.message || 'Gagal menyimpan Raport Pembinaan.' });
    },
  });

  const isLocked = session?.lock_status?.is_locked ?? false;

  // 5. Lock Mutation (Finalize report)
  const lockMutation = useMutation({
    mutationFn: async () => {
      if (!selectedKamarId) throw new Error('No room selected');
      return (await api.post('/api/ubudiyah/lock', {
        target_id: selectedKamarId,
        bulan,
        tahun,
      })).data;
    },
    onSuccess: (data) => {
      setShowLockConfirmModal(false);
      setHasUnsavedChanges(false);
      setSaveResult({ type: 'success', message: data.message || 'Raport Pembinaan berhasil dikunci.' });
      void queryClient.invalidateQueries({ queryKey: ['ubudiyah-session'] });
      void queryClient.invalidateQueries({ queryKey: ['ubudiyah-kamar-summary'] });
    },
    onError: (err: any) => {
      setShowLockConfirmModal(false);
      setSaveResult({ type: 'error', message: err.response?.data?.message || 'Gagal mengunci Raport Pembinaan.' });
    },
  });

  // 6. Unlock Mutation (Revert to draft for revision)
  const unlockMutation = useMutation({
    mutationFn: async (alasan: string) => {
      if (!selectedKamarId) throw new Error('No room selected');
      return (await api.post('/api/ubudiyah/unlock', {
        target_id: selectedKamarId,
        bulan,
        tahun,
        alasan,
      })).data;
    },
    onSuccess: (data) => {
      setShowUnlockModal(false);
      setUnlockReason('');
      setSaveResult({ type: 'success', message: data.message || 'Kunci Raport berhasil dibuka kembali.' });
      void queryClient.invalidateQueries({ queryKey: ['ubudiyah-session'] });
      void queryClient.invalidateQueries({ queryKey: ['ubudiyah-kamar-summary'] });
    },
    onError: (err: any) => {
      setShowUnlockModal(false);
      setSaveResult({ type: 'error', message: err.response?.data?.message || 'Gagal membuka kunci Raport.' });
    },
  });

  const updateNilai = (santriId: number, instId: number, value: string) => {
    let num: number | null = null;
    if (value !== '') {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        num = Math.max(0, Math.min(100, parsed));
      }
    }

    setHasUnsavedChanges(true);
    setLocalData(prev => ({
      ...prev,
      [santriId]: {
        ...prev[santriId],
        nilai: { ...prev[santriId]?.nilai, [instId]: num },
        catatanSantri: prev[santriId]?.catatanSantri ?? '',
      },
    }));
  };

  const updateCatatanSantri = (santriId: number, value: string) => {
    setHasUnsavedChanges(true);
    setLocalData(prev => ({
      ...prev,
      [santriId]: {
        ...prev[santriId],
        nilai: { ...prev[santriId]?.nilai },
        catatanSantri: value,
      },
    }));
  };

  // Quick Fill: Set standard 80 for single santri
  const handleQuickFillSantri = (santriId: number, defaultScore = 80) => {
    if (!session) return;
    setHasUnsavedChanges(true);
    setLocalData(prev => {
      const existing = prev[santriId] || { nilai: {}, catatanSantri: '' };
      const nextNilai = { ...existing.nilai };
      session.aspek.forEach(aspek => {
        if (nextNilai[aspek.instrumen_id] === null || nextNilai[aspek.instrumen_id] === undefined) {
          nextNilai[aspek.instrumen_id] = defaultScore;
        }
      });
      return {
        ...prev,
        [santriId]: {
          nilai: nextNilai,
          catatanSantri: existing.catatanSantri ?? '',
        },
      };
    });
  };

  // Quick Fill: Set standard 80 for all uncompleted santri in the room
  const handleQuickFillAllEmpty = (defaultScore = 80) => {
    if (!session) return;
    setHasUnsavedChanges(true);
    setLocalData(prev => {
      const next = { ...prev };
      session.santri.forEach(santri => {
        const existing = next[santri.santri_id] || { nilai: {}, catatanSantri: '' };
        const nextNilai = { ...existing.nilai };
        session.aspek.forEach(aspek => {
          if (nextNilai[aspek.instrumen_id] === null || nextNilai[aspek.instrumen_id] === undefined) {
            nextNilai[aspek.instrumen_id] = defaultScore;
          }
        });
        next[santri.santri_id] = {
          nilai: nextNilai,
          catatanSantri: existing.catatanSantri ?? '',
        };
      });
      return next;
    });
    setShowQuickFillConfirm(false);
  };

  // Keyboard navigation for spreadsheet matrix table
  const handleMatrixKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    santriIdx: number,
    aspekIdx: number
  ) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextEl = document.getElementById(`matrix-cell-${santriIdx + 1}-${aspekIdx}`);
      nextEl?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevEl = document.getElementById(`matrix-cell-${santriIdx - 1}-${aspekIdx}`);
      prevEl?.focus();
    }
  };

  const handleDownloadPdfBulk = async () => {
    if (!selectedKamarId) return;
    setDownloadingBulk(true);
    try {
      const response = await api.get(`/api/ubudiyah/kamar/${selectedKamarId}/pdf`, {
        params: { bulan, tahun },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Laporan_Pembinaan_Bulk_Kamar_${selectedKamarId}_${bulan}_${tahun}.pdf`;
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
    <section
      className="app-container raport-page"
      style={{
        borderRadius: '20px',
        border: '1px solid #cbd5e1',
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
        padding: '20px',
      }}
    >
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
          <span>{isAutoSaving ? 'Menyimpan draft & kembali...' : 'Kembali ke Raport Pembinaan'}</span>
        </button>
      </div>

      <h1 className="sr-only">Input Raport Pembinaan</h1>
      {roomsError && (
        <div className="error-box" role="alert">
          Sesi login tidak valid atau sudah berakhir. Masuk kembali untuk memuat data.
          <button type="button" className="secondary-button" onClick={() => void refetchRooms()}>Coba lagi</button>
        </div>
      )}

      {/* Parameter Selectors */}
      <div className="raport-selectors" style={{ borderRadius: '20px' }}>
        <div className="raport-selector-row">
          <div className="raport-field" style={{ flex: '2 1 200px' }}>
            <AppDropdown
              id="ubudiyah-input-kamar"
              label="Kamar"
              value={selectedKamarId ? String(selectedKamarId) : ''}
              placeholder="— Pilih Kamar —"
              disabled={isKamarDisabled}
              options={rooms.map(room => ({ value: String(room.target_id), label: room.nama_target }))}
              onChange={value => {
                setSelectedKamarId(Number(value) || null);
                setLastSessionKey('');
                setExpandedSantriId(null);
              }}
            />
            {isKamarDisabled && rooms.length > 0 && (
              <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                Kamar binaan Anda ({rooms[0]?.nama_target})
              </small>
            )}
          </div>

          <div className="raport-field">
            <AppDropdown
              id="ubudiyah-input-bulan"
              label="Bulan"
              value={String(bulan)}
              options={BULAN_NAMA.slice(1).map((nama, index) => ({ value: String(index + 1), label: nama }))}
              onChange={value => { setBulan(Number(value)); setLastSessionKey(''); }}
            />
          </div>

          <div className="raport-field">
            <AppDropdown
              id="ubudiyah-input-tahun"
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
            {session && <span>Kamar: <strong>{session.nama_kamar}</strong></span>}
            {session && <span>Jumlah santri: <strong>{session.santri.length}</strong></span>}
            {session && (
              <span>Lengkap: <strong>{calculatedStats.completedCount}/{session.santri.length}</strong></span>
            )}
            {session?.lock_status?.is_locked && (
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
                Terkunci (Final)
              </span>
            )}
          </div>
        )}

        {session?.lock_status?.is_locked && (
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
              <strong style={{ color: '#0f172a' }}>Laporan ini telah dikunci (Final).</strong>
              {session.lock_status.dikunci_oleh_nama && (
                <span style={{ color: '#64748b', marginLeft: '6px' }}>
                  Dikunci oleh <strong>{session.lock_status.dikunci_oleh_nama}</strong>
                  {session.lock_status.dikunci_pada ? ` pada ${new Date(session.lock_status.dikunci_pada).toLocaleString('id-ID')}` : ''}.
                </span>
              )}
            </div>
            {session.lock_status.can_unlock && (
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

      {/* Loading states */}
      {loadingRooms && <ContentSkeleton rows={2} />}
      {loadingSession && sessionEnabled && <ContentSkeleton rows={5} />}
      {sessionError && (
        <div className="error-box" role="alert">
          {(sessionError as any)?.response?.status === 503
            ? 'Modul Raport Pembinaan belum siap. Hubungi Admin untuk menyiapkan database.'
            : 'Data kamar gagal dimuat. Periksa koneksi atau penugasan kamar Anda, lalu coba lagi.'}
          <button type="button" className="secondary-button" onClick={() => void refetchSession()}>Coba lagi</button>
        </div>
      )}

      {/* Save Modal */}
      {saveResult && (
        <div className="save-modal-backdrop" role="presentation">
          <div aria-modal="true" className={`save-modal ${saveResult.type}`} role="dialog">
            <div className="save-modal-icon" aria-hidden="true">
              {saveResult.type === 'success' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : '!'}
            </div>
            <h2>{saveResult.type === 'success' ? 'Berhasil' : 'Gagal'}</h2>
            <p>{saveResult.message}</p>
            <div className="save-modal-actions" style={{ flexDirection: 'column', gap: '8px' }}>
              {saveResult.type === 'success' && (
                <>
                  <button type="button" className="pdf-download-btn" disabled={downloadingBulk} onClick={() => void handleDownloadPdfBulk()}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>{downloadingBulk ? 'Mengunduh...' : 'Download PDF 1 Kamar'}</span>
                  </button>
                  <button className="secondary-button" onClick={() => navigate(`/ubudiyah/lihat?kamar=${selectedKamarId}&bulan=${bulan}&tahun=${tahun}`)}>
                    Lihat Hasil Laporan Kamar
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

      {/* Quick Fill Confirmation Modal */}
      {showQuickFillConfirm && (
        <div className="save-modal-backdrop" role="presentation">
          <div aria-modal="true" className="save-modal" role="dialog" style={{ maxWidth: '440px', textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Isi Cepat Nilai Standar</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
              Fitur ini akan mengisi nilai <strong>80 (Baik)</strong> ke semua kolom kriteria santri yang masih kosong. Kolom yang sudah Anda isi tidak akan tertimpa.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="secondary-button" onClick={() => setShowQuickFillConfirm(false)}>
                Batal
              </button>
              <button type="button" className="primary-button" onClick={() => handleQuickFillAllEmpty(80)}>
                Terapkan Nilai 80
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lock Confirmation Modal */}
      {showLockConfirmModal && (
        <div className="save-modal-backdrop" role="presentation">
          <div aria-modal="true" className="save-modal" role="dialog" style={{ maxWidth: '520px', textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#0f172a' }}>Kunci Raport Pembinaan</h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
              Anda akan mengunci nilai Raport Pembinaan untuk <strong>{session?.nama_kamar}</strong> periode <strong>{BULAN_NAMA[bulan]} {tahun}</strong>.
            </p>

            <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '14px', fontSize: '12.5px', color: '#334155', lineHeight: '1.5' }}>
              <div style={{ marginBottom: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <span>Siap Dikunci: <strong style={{ color: '#15803d' }}>{calculatedStats.readyToLockSantri.length} santri</strong></span>
                {calculatedStats.lockedSantriCount > 0 && (
                  <span>Sudah Terkunci: <strong style={{ color: '#0369a1' }}>{calculatedStats.lockedSantriCount} santri</strong></span>
                )}
                {calculatedStats.incompleteSantriList.length > 0 && (
                  <span>Belum Lengkap (Susulan): <strong style={{ color: '#b45309' }}>{calculatedStats.incompleteSantriList.length} santri</strong></span>
                )}
              </div>

              {calculatedStats.incompleteSantriList.length > 0 ? (
                <div style={{ marginTop: '8px', padding: '8px 10px', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fef3c7', fontSize: '12px', color: '#92400e' }}>
                  <strong>Santri belum lengkap:</strong> {calculatedStats.incompleteSantriList.map(s => s.nama).slice(0, 5).join(', ')}{calculatedStats.incompleteSantriList.length > 5 ? ` dan ${calculatedStats.incompleteSantriList.length - 5} lainnya` : ''}.
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
                disabled={lockMutation.isPending || calculatedStats.readyToLockSantri.length === 0}
                onClick={() => lockMutation.mutate()}
                style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
              >
                {lockMutation.isPending ? 'Mengunci…' : `Ya, Kunci ${calculatedStats.readyToLockSantri.length} Santri Lengkap`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Reason Modal */}
      {showUnlockModal && (
        <div className="save-modal-backdrop" role="presentation">
          <div aria-modal="true" className="save-modal" role="dialog" style={{ maxWidth: '480px', textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#0f172a' }}>Buka Kunci Raport Pembinaan</h3>
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
                placeholder="Tuliskan alasan spesifik pembukaan kunci, misalnya: revisi nilai tahsin santri Ahmad..."
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



      {/* Main Form Content */}
      {session && session.santri.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          {/* Quick Toolbar & View Switcher */}
          <div className="quick-fill-bar">
            <div className="quick-fill-actions">
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tinta)' }}>Aksi Cepat:</span>
              <button
                type="button"
                className="quick-fill-btn"
                disabled={isLocked}
                onClick={() => setShowQuickFillConfirm(true)}
                title={isLocked ? 'Raport terkunci' : 'Isi nilai 80 ke semua kolom kriteria yang masih kosong'}
              >
                Isi Standar (80) untuk Semua Kolom Kosong
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {hasUnsavedChanges && (
                <span className="progress-pill partial" style={{ fontSize: '11px' }}>
                  Perubahan belum disimpan
                </span>
              )}
              <div className="raport-view-switcher" role="tablist" aria-label="Pilihan tampilan input">
                <button
                  type="button"
                  className={`raport-view-btn ${viewMode === 'matrix' ? 'active' : ''}`}
                  onClick={() => setViewMode('matrix')}
                  role="tab"
                  aria-selected={viewMode === 'matrix'}
                >
                  Tabel Matriks
                </button>
                <button
                  type="button"
                  className={`raport-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setViewMode('cards')}
                  role="tab"
                  aria-selected={viewMode === 'cards'}
                >
                  Kartu Santri
                </button>
              </div>
            </div>
          </div>

          {/* =========================================================
              VIEW 1: SPREADSHEET MATRIX (RECOMMENDED & FASTEST)
             ========================================================= */}
          {viewMode === 'matrix' && (
            <div className="raport-matrix-wrapper" style={{ borderRadius: '20px' }}>
              <table className="raport-matrix-table" aria-label="Tabel Penilaian Raport Pembinaan">
                <thead>
                  <tr>
                    <th className="col-sticky-no" style={{ width: '48px', minWidth: '48px', maxWidth: '48px', fontSize: '13px', textAlign: 'center' }}>No</th>
                    <th className="col-sticky-name" style={{ minWidth: '240px', maxWidth: '300px', fontSize: '13px', textAlign: 'center' }}>Nama Santri</th>
                    {session.aspek.map(aspek => (
                      <th
                        key={aspek.instrumen_id}
                        style={{ minWidth: '120px', maxWidth: '160px', padding: '12px 10px' }}
                        title={aspek.nama_instrumen}
                      >
                        <div style={{ whiteSpace: 'normal', lineHeight: '1.35', fontSize: '13px', fontWeight: 600 }}>
                          {aspek.nama_instrumen}
                        </div>
                      </th>
                    ))}
                    <th style={{ width: '90px', fontSize: '13px' }}>Status</th>
                    <th style={{ width: '85px', fontSize: '13px' }}>Rata-rata</th>
                    <th style={{ minWidth: '220px', maxWidth: '300px', textAlign: 'left', fontSize: '13px' }}>Catatan Pembina</th>
                    <th style={{ width: '70px', fontSize: '13px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {session.santri.map((santri, sIdx) => {
                    const local = localData[santri.santri_id];
                    const stat = calculatedStats.stats[santri.santri_id];
                    const isSantriLocked = isLocked || (santri.is_locked ?? false);

                    return (
                      <tr
                        key={santri.santri_id}
                        className={isSantriLocked ? 'row-locked' : (stat?.isComplete ? 'row-completed' : '')}
                      >
                        <td className="col-sticky-no" style={{ fontSize: '13px', textAlign: 'center' }}>
                          {sIdx + 1}
                        </td>
                        <td className="col-sticky-name" style={{ textAlign: 'left' }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: '#0f172a',
                              fontSize: '13.5px',
                              lineHeight: '1.35',
                              textAlign: 'left',
                              whiteSpace: 'normal',
                              wordBreak: 'break-word',
                            }}
                          >
                            {santri.nama}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '3px' }}>
                            {santri.no_id_induk ? (
                              <span style={{ color: '#64748b', fontSize: '11px', lineHeight: '1.3', whiteSpace: 'nowrap' }}>
                                NIP: {santri.no_id_induk}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '11px', lineHeight: '1.3', whiteSpace: 'nowrap' }}>
                                NIP: —
                              </span>
                            )}
                            {isSantriLocked ? (
                              <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontWeight: 700 }}>Terkunci</span>
                            ) : stat?.isComplete ? (
                              <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>Lengkap</span>
                            ) : (
                              <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>Draft / Susulan</span>
                            )}
                          </div>
                        </td>

                        {/* Aspek Score Inputs */}
                        {session.aspek.map((aspek, aIdx) => {
                          const score = local?.nilai?.[aspek.instrumen_id];
                          const hasValue = score !== null && score !== undefined;
                          const isInvalid = hasValue && (score < 0 || score > 100);

                          return (
                            <td key={aspek.instrumen_id} style={{ textAlign: 'center' }}>
                              <input
                                id={`matrix-cell-${sIdx}-${aIdx}`}
                                type="number"
                                min={0}
                                max={100}
                                disabled={isSantriLocked}
                                className={`matrix-score-input no-spin-input ${hasValue ? 'is-filled' : ''} ${isInvalid ? 'is-invalid' : ''}`}
                                value={hasValue ? score : ''}
                                onChange={e => updateNilai(santri.santri_id, aspek.instrumen_id, e.target.value)}
                                onKeyDown={e => handleMatrixKeyDown(e, sIdx, aIdx)}
                                onWheel={e => e.currentTarget.blur()}
                                placeholder="—"
                                aria-label={`Nilai ${aspek.nama_instrumen} untuk ${santri.nama}`}
                              />
                            </td>
                          );
                        })}

                        {/* Status Progress */}
                        <td style={{ textAlign: 'center' }}>
                          {isSantriLocked ? (
                            <span className="progress-pill complete" style={{ background: '#dcfce7', color: '#166534' }}>Terkunci</span>
                          ) : stat?.isComplete ? (
                            <span className="progress-pill complete">Lengkap</span>
                          ) : (stat?.filledCount ?? 0) > 0 ? (
                            <span className="progress-pill partial">{stat?.filledCount}/{stat?.totalAspek}</span>
                          ) : (
                            <span className="progress-pill neutral">0/{stat?.totalAspek}</span>
                          )}
                        </td>

                        {/* Rata-rata */}
                        <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '13.5px' }}>
                          {stat?.isComplete && stat.avg !== null ? (
                            <span style={{ color: '#0f6e56' }} title={`Predikat: ${stat.predicate}`}>
                              {stat.avg.toFixed(1)} ({stat.letterGrade})
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>

                        {/* Catatan Pembina (Single note per santri directly on row) */}
                        <td style={{ textAlign: 'left' }}>
                          <input
                            type="text"
                            className="matrix-note-input"
                            disabled={isSantriLocked}
                            placeholder={isSantriLocked ? '—' : 'Catatan santri...'}
                            value={local?.catatanSantri ?? ''}
                            onChange={e => updateCatatanSantri(santri.santri_id, e.target.value)}
                            aria-label={`Catatan pembinaan untuk ${santri.nama}`}
                          />
                        </td>

                        {/* Quick Action */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="matrix-btn-action"
                            disabled={isSantriLocked}
                            onClick={() => handleQuickFillSantri(santri.santri_id, 80)}
                            title={isSantriLocked ? 'Raport terkunci' : 'Isi nilai 80 pada kriteria santri ini yang masih kosong'}
                          >
                            +80
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* =========================================================
              VIEW 2: ACCORDION CARD FOCUS (MOBILE / INDIVIDUAL VIEW)
             ========================================================= */}
          {viewMode === 'cards' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
              {session.santri.map((santri, idx) => {
                const local = localData[santri.santri_id];
                const stat = calculatedStats.stats[santri.santri_id];
                const isExpanded = expandedSantriId === santri.santri_id;

                return (
                  <div
                    key={santri.santri_id}
                    className="stat-card"
                    style={{
                      border: isExpanded ? '1px solid var(--aksen)' : '1px solid #cbd5e1',
                      borderRadius: '12px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                      overflow: 'hidden',
                      padding: '0',
                    }}
                  >
                    {/* Accordion Trigger */}
                    <button
                      type="button"
                      onClick={() => setExpandedSantriId(isExpanded ? null : santri.santri_id)}
                      className="ubudiyah-card-header"
                    >
                      <div className="ubudiyah-card-name-box">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--tinta)', margin: 0 }}>
                            {idx + 1}. {santri.nama}
                          </h3>
                          {stat?.isComplete ? (
                            <span className="progress-pill complete">Lengkap</span>
                          ) : (stat?.filledCount ?? 0) > 0 ? (
                            <span className="progress-pill partial">{stat?.filledCount}/{stat?.totalAspek}</span>
                          ) : (
                            <span className="progress-pill neutral">Belum Diisi</span>
                          )}
                        </div>
                        {santri.no_id_induk ? (
                          <small style={{ color: 'var(--tinta-muda)', fontSize: '11px' }}>NIP: {santri.no_id_induk}</small>
                        ) : (
                          <small style={{ color: '#94a3b8', fontSize: '11px' }}>NIP: —</small>
                        )}
                      </div>

                      <div className="ubudiyah-card-stats-wrapper">
                        <div className="ubudiyah-card-stats-box">
                          <div style={{ textAlign: 'right' }}>
                            <span className="stat-label">Rata-rata</span>
                            <strong
                              className="stat-value"
                              style={{ color: stat?.isComplete ? 'var(--aksen)' : 'var(--tinta-muda)' }}
                            >
                              {stat?.isComplete && stat.avg !== null ? stat.avg.toFixed(1) : '—'}
                            </strong>
                          </div>
                        </div>
                        <span
                          className="ubudiyah-card-arrow"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            transform: isExpanded ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </span>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div
                        style={{
                          padding: '0 20px 20px 20px',
                          borderTop: '1px dashed var(--garis)',
                          backgroundColor: 'rgba(249, 250, 251, 0.5)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                          <button
                            type="button"
                            className="quick-fill-btn"
                            disabled={isLocked}
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                            onClick={() => handleQuickFillSantri(santri.santri_id, 80)}
                          >
                            Isi Standar (80) untuk Santri Ini
                          </button>
                        </div>

                        <div
                          className="raport-table-wrapper"
                          style={{ boxShadow: 'none', border: 'none', borderRadius: '0', marginTop: '10px' }}
                        >
                          <table
                            className="raport-input-table ubudiyah-input-table"
                            style={{ borderCollapse: 'collapse', border: '1px solid #cbd5e1' }}
                          >
                            <thead>
                              <tr>
                                <th style={{ width: '8%', textAlign: 'center' }}>No</th>
                                <th style={{ width: '56%', textAlign: 'left' }}>Kriteria Penilaian</th>
                                <th style={{ width: '20%', textAlign: 'center' }}>Nilai (0–100)</th>
                                <th style={{ width: '16%', textAlign: 'center' }}>Huruf</th>
                              </tr>
                            </thead>
                            <tbody>
                              {session.aspek.map((aspek, aIdx) => {
                                const score = local?.nilai?.[aspek.instrumen_id] ?? null;
                                return (
                                  <tr key={aspek.instrumen_id}>
                                    <td className="no-cell" style={{ textAlign: 'center' }}>
                                      {aIdx + 1}
                                    </td>
                                    <td className="aspek-cell" style={{ textAlign: 'left', fontWeight: 500 }}>
                                      {aspek.nama_instrumen}
                                    </td>
                                    <td data-label="Nilai" style={{ textAlign: 'center', padding: '4px' }}>
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        disabled={isLocked}
                                        value={score ?? ''}
                                        onChange={e =>
                                          updateNilai(santri.santri_id, aspek.instrumen_id, e.target.value)
                                        }
                                        onWheel={e => e.currentTarget.blur()}
                                        placeholder="—"
                                        className="no-spin-input"
                                        style={{
                                          width: '65px',
                                          padding: '6px',
                                          textAlign: 'center',
                                          borderRadius: '4px',
                                          border: '1px solid #cbd5e1',
                                          backgroundColor: isLocked ? '#f8fafc' : undefined,
                                        }}
                                      />
                                    </td>
                                    <td
                                      data-label="Huruf"
                                      style={{
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        color: score !== null ? 'var(--aksen)' : 'var(--tinta-muda)',
                                      }}
                                    >
                                      {getLetterGrade(score)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Single note per santri */}
                        <div style={{ marginTop: '12px', marginBottom: '8px' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                            Catatan Pembina untuk {santri.nama} (Opsional):
                          </label>
                          <input
                            type="text"
                            className="matrix-note-input"
                            disabled={isLocked}
                            style={{ width: '100%', maxWidth: '100%' }}
                            placeholder={isLocked ? '—' : 'Tulis evaluasi atau apresiasi untuk santri ini...'}
                            value={local?.catatanSantri ?? ''}
                            onChange={e => updateCatatanSantri(santri.santri_id, e.target.value)}
                          />
                        </div>

                        {/* Card Summary Footer & Next Action */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#F3F4F6',
                            padding: '12px 16px',
                            borderRadius: '6px',
                            marginTop: '16px',
                            flexWrap: 'wrap',
                            gap: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', gap: '18px', fontSize: '12px' }}>
                            <span>
                              Terisi: <strong>{stat?.filledCount}/{stat?.totalAspek} kriteria</strong>
                            </span>
                            <span>
                              Rata-rata: <strong>{stat?.isComplete && stat.avg !== null ? stat.avg.toFixed(1) : '—'}</strong>
                            </span>
                            <span>
                              Predikat: <strong>{stat?.isComplete ? stat.predicate : '—'}</strong>
                            </span>
                          </div>

                          {idx < session.santri.length - 1 && (
                            <button
                              type="button"
                              className="matrix-btn-action"
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                              onClick={() => setExpandedSantriId(session.santri[idx + 1].santri_id)}
                            >
                              Lanjut ke Santri Berikutnya
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* =========================================================
              STICKY BOTTOM ACTION BAR
             ========================================================= */}
          <div className="raport-sticky-bar">
            <div className="sticky-bar-progress">
              <div>
                <span className="sticky-bar-progress-text">
                  Kemajuan Pengisian: <strong>{calculatedStats.completedCount}</strong> dari{' '}
                  <strong>{session.santri.length}</strong> santri lengkap
                </span>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  {calculatedStats.completedCount === session.santri.length ? (
                    <span style={{ color: '#166534', fontWeight: 600 }}>Seluruh santri telah lengkap dinilai</span>
                  ) : (
                    <span>
                      {session.santri.length - calculatedStats.completedCount} santri masih perlu dilengkapi
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
                <span>{downloadingBulk ? 'Mengunduh…' : 'Download PDF 1 Kamar'}</span>
              </button>

              {isLocked ? (
                session.lock_status?.can_unlock && (
                  <button
                    type="button"
                    className="secondary-button"
                    style={{
                      height: '44px',
                      minHeight: '44px',
                      padding: '0 18px',
                      fontSize: '14px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      boxSizing: 'border-box',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                    onClick={() => setShowUnlockModal(true)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '6px' }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                    </svg>
                    Buka Kunci Raport
                  </button>
                )
              ) : (
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
                      opacity: saveMutation.isPending ? 0.7 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={e => { if (!saveMutation.isPending) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                    onMouseLeave={e => { if (!saveMutation.isPending) e.currentTarget.style.backgroundColor = '#2563eb'; }}
                    disabled={saveMutation.isPending}
                    onClick={() => {
                      setSaveResult(null);
                      saveMutation.mutate();
                    }}
                  >
                    {saveMutation.isPending
                      ? 'Menyimpan…'
                      : hasUnsavedChanges
                      ? `Simpan Perubahan (${session.santri.length} Santri)`
                      : `Simpan Raport Pembinaan (${session.santri.length} Santri)`}
                  </button>

                  <button
                    type="button"
                    style={{
                      height: '44px',
                      minHeight: '44px',
                      padding: '0 18px',
                      fontSize: '14px',
                      fontWeight: 600,
                      backgroundColor: calculatedStats.readyToLockSantri.length > 0 && !hasUnsavedChanges ? '#16a34a' : '#94a3b8',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: calculatedStats.readyToLockSantri.length > 0 && !hasUnsavedChanges && !lockMutation.isPending ? 'pointer' : 'not-allowed',
                      opacity: lockMutation.isPending ? 0.7 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      if (calculatedStats.readyToLockSantri.length > 0 && !hasUnsavedChanges && !lockMutation.isPending) {
                        e.currentTarget.style.backgroundColor = '#15803d';
                      }
                    }}
                    onMouseLeave={e => {
                      if (calculatedStats.readyToLockSantri.length > 0 && !hasUnsavedChanges && !lockMutation.isPending) {
                        e.currentTarget.style.backgroundColor = '#16a34a';
                      }
                    }}
                    disabled={calculatedStats.readyToLockSantri.length === 0 || hasUnsavedChanges || lockMutation.isPending}
                    title={
                      hasUnsavedChanges
                        ? 'Simpan perubahan draft terlebih dahulu sebelum mengunci'
                        : calculatedStats.readyToLockSantri.length === 0
                        ? (calculatedStats.lockedSantriCount === session.santri.length ? 'Semua santri sudah terkunci' : 'Belum ada santri baru dengan nilai lengkap untuk dikunci')
                        : 'Kunci nilai santri yang lengkap'
                    }
                    onClick={() => setShowLockConfirmModal(true)}
                  >
                    {lockMutation.isPending ? 'Mengunci...' : (calculatedStats.lockedSantriCount > 0 ? `Kunci Susulan (${calculatedStats.readyToLockSantri.length})` : 'Kunci Raport')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {session && session.santri.length === 0 && (
        <div className="empty-state">Belum ada santri pada Kamar ini.</div>
      )}

      {!sessionEnabled && !loadingRooms && rooms.length > 0 && (
        <div className="empty-state">Pilih Kamar dan periode laporan untuk mulai mengisi penilaian.</div>
      )}

      {!loadingRooms && !roomsError && rooms.length === 0 && (
        <div className="empty-state">
          Tidak ada Kamar yang ditugaskan kepada Anda. Hubungi Admin untuk menambahkan penugasan.
        </div>
      )}
    </section>
  );
}

export default UbudiyahFormPage;
