import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ContentSkeleton } from '../components/LoadingSkeleton';
import { usePageMeta } from '../hooks/usePageMeta';

interface Instrument {
  instrumen_id: number;
  nama_instrumen: string;
}

interface SantriEntry {
  santri_id: number;
  nis: string | null;
  nama: string;
  nilai: Record<number, number | null>;
  catatan: Record<number, string>;
  raport_ubudiyah_id: number | null;
}

interface SessionData {
  nama_kamar: string;
  target_id: number;
  bulan: number;
  tahun: number;
  aspek: Instrument[];
  santri: SantriEntry[];
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
  if (score === null || isNaN(score)) return '';
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
  const { bulan: initBulan, tahun: initTahun } = nowJakarta();

  const [selectedKamarId, setSelectedKamarId] = useState<number | null>(null);
  const [bulan, setBulan] = useState(initBulan);
  const [tahun, setTahun] = useState(initTahun);
  const [downloadingBulk, setDownloadingBulk] = useState(false);
  const [expandedSantriId, setExpandedSantriId] = useState<number | null>(null);

  const [localData, setLocalData] = useState<Record<number, {
    nilai: Record<number, number | null>;
    catatan: Record<number, string>;
  }>>({});

  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  usePageMeta({
    title: 'Input Raport Ubudiyah',
    description: 'Formulir input nilai laporan ibadah harian (Ubudiyah Yaumiyah) santri per kamar.',
  });

  // 1. Fetch Room Options
  const { data: rooms = [], isLoading: loadingRooms, isError: roomsError, refetch: refetchRooms } = useQuery<{ target_id: number; nama_target: string }[]>({
    queryKey: ['ubudiyah-rooms', user?.petugas_id],
    queryFn: async () => (await api.get('/api/ubudiyah/options')).data,
    enabled: !!user,
  });

  // 2. Fetch Session Data
  const sessionEnabled = !!selectedKamarId;
  const { data: session, isLoading: loadingSession, error: sessionError } = useQuery<SessionData>({
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
      data[santri.santri_id] = {
        nilai: { ...santri.nilai },
        catatan: { ...santri.catatan },
      };
    }
    setLocalData(data);
  }, []);

  // Sync session changes to local state
  const [lastSessionKey, setLastSessionKey] = useState('');
  const currentKey = `${selectedKamarId}-${bulan}-${tahun}`;
  if (session && currentKey !== lastSessionKey) {
    initLocalData(session);
    setLastSessionKey(currentKey);
  }

  // 3. Calculate local averages and ranks dynamically
  const calculatedStats = useMemo(() => {
    if (!session) return { averages: {}, ranks: {} };

    const averagesList = session.santri.map(santri => {
      const local = localData[santri.santri_id];
      if (!local) return { santri_id: santri.santri_id, avg: 0, total: 0, count: 0 };

      const scores = Object.values(local.nilai).filter(v => v !== null) as number[];
      const total = scores.reduce((sum, v) => sum + v, 0);
      const count = scores.length;
      const avg = count > 0 ? total / count : 0;

      return { santri_id: santri.santri_id, avg, total, count };
    });

    // Sort descending for ranks
    const sorted = [...averagesList].sort((a, b) => b.avg - a.avg);
    const ranks: Record<number, number> = {};
    sorted.forEach((item, index) => {
      ranks[item.santri_id] = item.count > 0 ? index + 1 : 0;
    });

    const averagesMap: Record<number, { avg: number; total: number; count: number }> = {};
    averagesList.forEach(item => {
      averagesMap[item.santri_id] = { avg: item.avg, total: item.total, count: item.count };
    });

    return { averages: averagesMap, ranks };
  }, [session, localData]);

  // 4. Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('No session');
      const entries = session.santri.map(santri => {
        const local = localData[santri.santri_id];
        return {
          santri_id: santri.santri_id,
          nilai: local?.nilai ?? {},
          catatan: local?.catatan ?? {},
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
      setSaveResult({ type: 'success', message: data.message || 'Laporan Ubudiyah berhasil disimpan' });
      void queryClient.invalidateQueries({ queryKey: ['ubudiyah-session'] });
    },
    onError: (err: any) => {
      setSaveResult({ type: 'error', message: err.response?.data?.message || 'Gagal menyimpan Laporan Ubudiyah.' });
    },
  });

  const updateNilai = (santriId: number, instId: number, value: string) => {
    const num = value === '' ? null : Math.max(0, Math.min(100, parseInt(value, 10)));
    setLocalData(prev => ({
      ...prev,
      [santriId]: {
        ...prev[santriId],
        nilai: { ...prev[santriId]?.nilai, [instId]: isNaN(num as number) ? null : num },
        catatan: { ...prev[santriId]?.catatan },
      },
    }));
  };

  const updateCatatan = (santriId: number, instId: number, value: string) => {
    setLocalData(prev => ({
      ...prev,
      [santriId]: {
        ...prev[santriId],
        nilai: { ...prev[santriId]?.nilai },
        catatan: { ...prev[santriId]?.catatan, [instId]: value },
      },
    }));
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
      link.download = `Laporan_Ubudiyah_Bulk_Kamar_${selectedKamarId}_${bulan}_${tahun}.pdf`;
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
      <div className="page-heading" style={{ marginBottom: '20px' }}>
        <span className="page-eyebrow">Kedisiplinan & Ibadah</span>
        <h1>Input Laporan Ubudiyah</h1>
        <p>Catat evaluasi ibadah harian (Ubudiyah Yaumiyah) santri secara berkala per bulan.</p>
      </div>

      {roomsError && (
        <div className="error-box" role="alert">
          Sesi login tidak valid atau sudah berakhir. Masuk kembali untuk memuat data.
          <button type="button" className="secondary-button" onClick={() => void refetchRooms()}>Coba lagi</button>
        </div>
      )}

      {/* Selectors */}
      <div className="raport-selectors">
        <div className="raport-selector-row">
          <div className="raport-field" style={{ flex: '2 1 200px' }}>
            <label className="ui-text-label" htmlFor="ubudiyah-input-kamar">Kamar</label>
            <select
              id="ubudiyah-input-kamar"
              className="raport-select"
              value={selectedKamarId ?? ''}
              onChange={e => { setSelectedKamarId(Number(e.target.value) || null); setLastSessionKey(''); setExpandedSantriId(null); }}
            >
              <option value="">— Pilih Kamar —</option>
              {rooms.map(r => (
                <option key={r.target_id} value={r.target_id}>{r.nama_target}</option>
              ))}
            </select>
          </div>

          <div className="raport-field">
            <label className="ui-text-label" htmlFor="ubudiyah-input-bulan">Bulan</label>
            <select id="ubudiyah-input-bulan" className="raport-select" value={bulan} onChange={e => { setBulan(Number(e.target.value)); setLastSessionKey(''); }}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{BULAN_NAMA[i + 1]}</option>
              ))}
            </select>
          </div>

          <div className="raport-field">
            <label className="ui-text-label" htmlFor="ubudiyah-input-tahun">Tahun</label>
            <select id="ubudiyah-input-tahun" className="raport-select" value={tahun} onChange={e => { setTahun(Number(e.target.value)); setLastSessionKey(''); }}>
              {Array.from({ length: 5 }, (_, i) => {
                const y = initTahun - 2 + i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>
        </div>

        {sessionEnabled && (
          <div className="raport-info-bar">
            <span>Tahun Pelajaran: <strong>{getTahunPelajaran(bulan, tahun)}</strong></span>
            <span>Semester: <strong>{getSemester(bulan)}</strong></span>
            {session && <span>Kamar: <strong>{session.nama_kamar}</strong></span>}
            {session && <span>Jumlah santri: <strong>{session.santri.length}</strong></span>}
          </div>
        )}
      </div>

      {/* Loading states */}
      {loadingRooms && <ContentSkeleton rows={2} />}
      {loadingSession && sessionEnabled && <ContentSkeleton rows={5} />}
      {sessionError && <div className="error-box">Gagal memuat data. Pastikan Anda memiliki penugasan aktif di Kamar ini.</div>}

      {/* Save Modal */}
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
                    {downloadingBulk ? 'Mengunduh...' : 'Download PDF 1 Kamar'}
                  </button>
                  <button className="secondary-button" onClick={() => navigate(`/raport/lihat?tab=ubudiyah&kamar=${selectedKamarId}&bulan=${bulan}&tahun=${tahun}`)}>
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

      {/* Student Penilaian Accordion / List */}
      {session && session.santri.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div className="empty-state" style={{ padding: '8px 12px', fontSize: '11px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', backgroundColor: 'rgba(15, 110, 86, 0.05)', color: 'var(--tinta)', border: '1px solid var(--garis)', borderRadius: '6px', marginBottom: '16px' }}>
            <span>Petunjuk: Klik pada nama santri untuk membuka & mengisi instrumen ibadah.</span>
            <span>Total Kriteria Aktif: <strong>{session.aspek.length}</strong></span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {session.santri.map((santri, idx) => {
              const local = localData[santri.santri_id];
              const stat = calculatedStats.averages[santri.santri_id] || { avg: 0, total: 0, count: 0 };
              const rank = calculatedStats.ranks[santri.santri_id] || 0;
              const isExpanded = expandedSantriId === santri.santri_id;

              return (
                <div
                  key={santri.santri_id}
                  className="stat-card"
                  style={{
                    borderLeft: isExpanded ? '4px solid var(--aksen)' : '1px solid var(--garis)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    padding: '0'
                  }}
                >
                  {/* Card Header Accordion */}
                  <button
                    type="button"
                    onClick={() => setExpandedSantriId(isExpanded ? null : santri.santri_id)}
                    className="ubudiyah-card-header"
                  >
                    <div className="ubudiyah-card-name-box">
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--tinta)', margin: '0 0 2px 0' }}>
                        {idx + 1}. {santri.nama}
                      </h3>
                      {santri.nis && <small style={{ color: 'var(--tinta-muda)', fontSize: '11px' }}>NIS: {santri.nis}</small>}
                    </div>

                    <div className="ubudiyah-card-stats-wrapper">
                      <div className="ubudiyah-card-stats-box">
                        <div style={{ textAlign: 'right' }}>
                          <span className="stat-label">Rata-rata</span>
                          <strong className="stat-value" style={{ color: stat.count > 0 ? 'var(--aksen)' : 'var(--tinta-muda)' }}>
                            {stat.count > 0 ? stat.avg.toFixed(1) : '—'}
                          </strong>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="stat-label">Peringkat</span>
                          <strong className="stat-value">
                            {rank > 0 ? `${rank}/${session.santri.length}` : '—'}
                          </strong>
                        </div>
                      </div>
                      <span className="ubudiyah-card-arrow" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                        ▼
                      </span>
                    </div>
                  </button>

                  {/* Expanded Content Table */}
                  {isExpanded && (
                    <div style={{ padding: '0 20px 20px 20px', borderTop: '1px dashed var(--garis)', backgroundColor: 'rgba(249, 250, 251, 0.5)' }}>
                      <div className="raport-table-wrapper" style={{ boxShadow: 'none', border: 'none', borderRadius: '0', marginTop: '16px' }}>
                        <table className="raport-input-table ubudiyah-input-table" style={{ borderCollapse: 'collapse', border: '1px solid var(--garis)' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '8%', textAlign: 'center' }}>No</th>
                              <th style={{ width: '37%', textAlign: 'left' }}>Kriteria Penilaian</th>
                              <th style={{ width: '15%', textAlign: 'center' }}>Nilai (0–100)</th>
                              <th style={{ width: '12%', textAlign: 'center' }}>Huruf</th>
                              <th style={{ width: '28%', textAlign: 'left' }}>Catatan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {session.aspek.map((aspek, aIdx) => {
                              const score = local?.nilai?.[aspek.instrumen_id] ?? null;
                              return (
                                <tr key={aspek.instrumen_id}>
                                  <td className="no-cell" style={{ textAlign: 'center' }}>{aIdx + 1}</td>
                                  <td className="aspek-cell" style={{ textAlign: 'left', fontWeight: 500 }}>{aspek.nama_instrumen}</td>
                                  <td data-label="Nilai" style={{ textAlign: 'center', padding: '4px' }}>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={score ?? ''}
                                      onChange={e => updateNilai(santri.santri_id, aspek.instrumen_id, e.target.value)}
                                      onKeyDown={e => {
                                        if (
                                          ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) ||
                                          (e.ctrlKey === true || e.metaKey === true)
                                        ) {
                                          return;
                                        }
                                        if (e.key < '0' || e.key > '9') {
                                          e.preventDefault();
                                        }
                                      }}
                                      placeholder="—"
                                      style={{
                                        width: '65px',
                                        padding: '6px',
                                        textAlign: 'center',
                                        borderRadius: '4px',
                                        border: '1px solid var(--garis)'
                                      }}
                                    />
                                  </td>
                                  <td data-label="Huruf" style={{ textAlign: 'center', fontWeight: 'bold', color: score !== null ? 'var(--aksen)' : 'var(--tinta-muda)' }}>
                                    {getLetterGrade(score)}
                                  </td>
                                  <td data-label="Catatan" style={{ padding: '4px' }}>
                                    <input
                                      type="text"
                                      placeholder="Ketik catatan..."
                                      value={local?.catatan?.[aspek.instrumen_id] ?? ''}
                                      onChange={e => updateCatatan(santri.santri_id, aspek.instrumen_id, e.target.value)}
                                      style={{
                                        width: '100%',
                                        padding: '6px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid var(--garis)'
                                      }}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Card Summary Footer */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: '#F3F4F6',
                          padding: '12px 16px',
                          borderRadius: '6px',
                          marginTop: '16px'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '20px' }}>
                          <span>Jumlah Nilai: <strong>{stat.total}</strong></span>
                          <span>Rata-rata: <strong>{stat.count > 0 ? stat.avg.toFixed(1) : '—'}</strong></span>
                        </div>
                        <div>
                          <span>Predikat Umum: <strong>{stat.count > 0 ? getLetterLabel(stat.avg) : '—'}</strong></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="raport-actions-bar" style={{ gap: '12px', flexWrap: 'wrap', marginTop: '24px' }}>
            <button
              className="secondary-button"
              disabled={downloadingBulk}
              onClick={() => void handleDownloadPdfBulk()}
            >
              {downloadingBulk ? 'Mengunduh…' : 'Download PDF 1 Kamar'}
            </button>
            <button
              className="primary-button raport-save-btn"
              disabled={saveMutation.isPending}
              onClick={() => { setSaveResult(null); saveMutation.mutate(); }}
            >
              {saveMutation.isPending ? 'Menyimpan…' : `Simpan Laporan (${session.santri.length} santri)`}
            </button>
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
        <div className="empty-state">Tidak ada Kamar yang ditugaskan kepada Anda. Hubungi Admin untuk menambahkan penugasan.</div>
      )}
    </section>
  );
}

export default UbudiyahFormPage;
