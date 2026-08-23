import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { AppDropdown } from '../components/AppDropdown';
import { ContentSkeleton } from '../components/LoadingSkeleton';
import { usePageMeta } from '../hooks/usePageMeta';

interface Target {
  target_id: number;
  nama_target: string;
  kategori?: string;
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
  nama: string;
  nilai: Record<string, number | null>;
  kepribadian: Record<string, string | null>;
  keputusan: string | null;
  predikat_umum: string | null;
  raport_id: number | null;
}

interface SessionData {
  jenis: string;
  nama_kelompok: string;
  target_id: number;
  bulan: number;
  tahun: number;
  aspek: string[];
  kepribadian_jenis: string[];
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

import { useNavigate } from 'react-router-dom';

export function RaportInputPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { bulan: initBulan, tahun: initTahun } = nowJakarta();

  const [selectedJenis, setSelectedJenis] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [bulan, setBulan] = useState(initBulan);
  const [tahun, setTahun] = useState(initTahun);
  const [downloadingBulk, setDownloadingBulk] = useState(false);
  const [localData, setLocalData] = useState<Record<number, {
    nilai: Record<string, number | null>;
    kepribadian: Record<string, string | null>;
    keputusan: string | null;
    predikat_umum: string | null;
  }>>({});
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
      setSaveResult({ type: 'success', message: data.message || 'Raport berhasil disimpan' });
      void queryClient.invalidateQueries({ queryKey: ['raport-session'] });
    },
    onError: () => {
      setSaveResult({ type: 'error', message: 'Gagal menyimpan raport. Silakan coba kembali.' });
    },
  });

  const updateNilai = (santriId: number, aspek: string, value: string) => {
    const num = value === '' ? null : Math.max(0, Math.min(100, parseInt(value, 10)));
    setLocalData(prev => ({
      ...prev,
      [santriId]: {
        ...prev[santriId],
        nilai: { ...prev[santriId]?.nilai, [aspek]: isNaN(num as number) ? null : num },
      },
    }));
  };

  const updateKepribadian = (santriId: number, jenis: string, value: string) => {
    setLocalData(prev => ({
      ...prev,
      [santriId]: {
        ...prev[santriId],
        kepribadian: { ...prev[santriId]?.kepribadian, [jenis]: value || null },
      },
    }));
  };

  const updateKeputusan = (santriId: number, value: string) => {
    setLocalData(prev => ({
      ...prev,
      [santriId]: { ...prev[santriId], keputusan: value || null },
    }));
  };

  const updatePredikatUmum = (santriId: number, value: string) => {
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

  const currentOption = options.find(o => o.jenis === selectedJenis);

  return (
    <section className="app-container raport-page">
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
              options={options.map(option => ({ value: option.jenis, label: option.nama }))}
              onChange={value => { setSelectedJenis(value); setSelectedTargetId(null); setLastSessionKey(''); }}
            />
          </div>

          <div className="raport-field">
            <AppDropdown
              id="raport-input-kelompok"
              label="Kelompok"
              value={selectedTargetId ? String(selectedTargetId) : ''}
              options={(currentOption?.targets ?? []).map(target => ({ value: String(target.target_id), label: `${target.kategori ? `${target.kategori} — ` : ''}${target.nama_target}` }))}
              placeholder="— Pilih kelompok —"
              disabled={!selectedJenis}
              searchable
              searchPlaceholder="Cari nama kelompok..."
              onChange={value => { setSelectedTargetId(Number(value) || null); setLastSessionKey(''); }}
            />
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
            {session && <span>Kelompok: <strong>{session.nama_kelompok}</strong></span>}
            {session && <span>Jumlah santri: <strong>{session.santri.length}</strong></span>}
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

      {/* Input Table */}
      {session && session.santri.length > 0 && (
        <>
          <div className="raport-table-wrapper">
            <table className="raport-input-table">
              <thead>
                <tr>
                  <th className="raport-th-no" rowSpan={2}>No</th>
                  <th className="raport-th-nama" rowSpan={2}>Nama Santri</th>
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
                  return (
                    <tr key={santri.santri_id} className={idx % 2 === 0 ? '' : 'raport-row-alt'}>
                      <td className="raport-td-no">{idx + 1}</td>
                      <td className="raport-td-nama">
                        <div className="raport-nama-text">{santri.nama}</div>
                        {santri.nis && <div className="raport-nis-text">{santri.nis}</div>}
                      </td>
                      {session.aspek.map(aspek => (
                        <td key={aspek} className="raport-td-input">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className="raport-input-nilai"
                            value={local?.nilai?.[aspek] ?? ''}
                            onChange={e => updateNilai(santri.santri_id, aspek, e.target.value)}
                            placeholder="—"
                          />
                        </td>
                      ))}
                      {session.kepribadian_jenis.map(jenis => (
                        <td key={jenis} className="raport-td-select">
                          <AppDropdown
                            className="app-dropdown-table"
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
                          value={local?.keputusan ?? ''}
                          options={[{ value: 'Naik', label: 'Naik' }, { value: 'Tidak Naik', label: 'Tidak Naik' }]}
                          placeholder="—"
                          ariaLabel={`Keputusan untuk ${santri.nama}`}
                          onChange={value => updateKeputusan(santri.santri_id, value)}
                        />
                      </td>
                      <td className="raport-td-select">
                        <AppDropdown
                          className="app-dropdown-table"
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

          <div className="raport-actions-bar" style={{ gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="secondary-button"
              disabled={downloadingBulk}
              onClick={() => void handleDownloadPdfBulk()}
            >
              {downloadingBulk ? 'Mengunduh…' : 'Download PDF 1 Kelompok'}
            </button>
            <button
              className="primary-button raport-save-btn"
              disabled={saveMutation.isPending}
              onClick={() => { setSaveResult(null); saveMutation.mutate(); }}
            >
              {saveMutation.isPending ? 'Menyimpan…' : `Simpan Raport (${session.santri.length} santri)`}
            </button>
          </div>
        </>
      )}

      {session && session.santri.length === 0 && (
        <div className="empty-state">Belum ada santri pada kelompok ini.</div>
      )}

      {!sessionEnabled && !loadingOptions && options.length > 0 && (
        <div className="empty-state">Pilih jenis pengajian dan kelompok untuk mulai input raport.</div>
      )}

      {!loadingOptions && !optionsError && options.length === 0 && (
        <div className="empty-state">Tidak ada kelompok yang ditugaskan kepada Anda. Hubungi Admin untuk menambahkan penugasan.</div>
      )}
    </section>
  );
}

export default RaportInputPage;
