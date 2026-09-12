import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { AppDropdown } from '../components/AppDropdown';
import { AppToast } from '../components/AppToast';
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

interface RaportNilaiItem {
  aspek: string;
  nilai_angka: number | null;
  predikat: string | null;
  rata_rata_kelompok: number | null;
}

interface KepribadianItem {
  jenis: string;
  nilai: string | null;
  keterangan: string | null;
}

interface RaportSection {
  kelompok: string | null;
  nilai: RaportNilaiItem[];
  total_nilai: number;
  rata_rata: number | null;
  peringkat: number | null;
  dari: number | null;
  keputusan: string | null;
}

interface RaportData {
  raport_id: number;
  santri: {
    santri_id: number;
    nis: string | null;
    nama: string;
    nama_kamar: string | null;
    nama_kelas: string | null;
    tingkat: string | null;
  };
  bulan: number;
  tahun: number;
  tahun_pelajaran: string;
  semester: string;
  al_quran: RaportSection;
  takhassus: RaportSection;
  kepribadian: KepribadianItem[];
  predikat_umum: string | null;
}

interface SantriOption {
  santri_id: number;
  nis: string | null;
  no_id_induk?: string | null;
  nama: string;
}

interface SessionSantri {
  santri_id: number;
  nis: string | null;
  no_id_induk?: string | null;
  nama: string;
  nilai: Record<string, number | null>;
  keputusan: string | null;
  raport_id: number | null;
}

interface SessionData {
  jenis: string;
  nama_kelompok: string;
  target_id: number;
  bulan: number;
  tahun: number;
  aspek: string[];
  santri: SessionSantri[];
}

interface ArchiveDocument {
  document_id: number;
  tahun_pelajaran: string;
  semester: string;
  versi: number;
  diterbitkan_pada: string;
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

function NilaiTable({ title, section, label }: { title: string; section: RaportSection; label: string }) {
  return (
    <div className="raport-view-section">
      <div className="raport-view-section-header">
        <strong>{title}</strong>
        <span>Kelompok &nbsp;: &nbsp;<strong>{section.kelompok ?? '-'}</strong></span>
      </div>
      <table className="raport-view-table">
        <thead>
          <tr>
            <th style={{ width: '6%' }}>No</th>
            <th style={{ width: '28%' }}>Aspek Penilaian</th>
            <th style={{ width: '14%' }}>Angka</th>
            <th style={{ width: '28%' }}>Predikat</th>
            <th style={{ width: '18%' }}>Rata-rata<br />kelompok</th>
          </tr>
        </thead>
        <tbody>
          {section.nilai.map((item, i) => (
            <tr key={item.aspek}>
              <td style={{ textAlign: 'center' }}>{i + 1}</td>
              <td>{item.aspek}</td>
              <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.nilai_angka ?? '-'}</td>
              <td style={{ textAlign: 'center' }}>{item.predikat ?? '-'}</td>
              <td style={{ textAlign: 'center' }}>{item.rata_rata_kelompok ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="raport-view-summary">
        <div className="raport-summary-row">
          <span>Total nilai</span>
          <strong>{section.total_nilai}</strong>
          <span>Peringkat ke -</span>
          <strong>{section.peringkat ?? '-'}</strong>
        </div>
        <div className="raport-summary-row">
          <span>Rata-rata</span>
          <strong>{section.rata_rata ?? '-'}</strong>
          <span>Dari</span>
          <strong>{section.dari ?? '-'} santri</strong>
        </div>
      </div>
      <div className="raport-view-keputusan">
        <strong>Keputusan</strong> — Berdasarkan hasil yang dicapai dan keputusan rapat dewan guru pengajian {label}, santri dinyatakan : <strong className="raport-keputusan-value">{section.keputusan ?? '-'}</strong>
      </div>
    </div>
  );
}

export function RaportViewPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { bulan: initBulan, tahun: initTahun } = nowJakarta();

  const urlJenis = searchParams.get('jenis') || '';
  const urlKelompok = Number(searchParams.get('kelompok')) || null;
  const urlBulan = Number(searchParams.get('bulan')) || initBulan;
  const urlTahun = Number(searchParams.get('tahun')) || initTahun;

  const [mode, setMode] = useState<'kelompok' | 'nama'>(urlKelompok ? 'kelompok' : 'kelompok');
  const [selectedJenis, setSelectedJenis] = useState(urlJenis);
  const [selectedKategori, setSelectedKategori] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(urlKelompok);
  const [searchName, setSearchName] = useState('');
  const [selectedSantriId, setSelectedSantriId] = useState<number | null>(null);
  const [bulan, setBulan] = useState(urlBulan);
  const [tahun, setTahun] = useState(urlTahun);
  const [downloading, setDownloading] = useState(false);
  const [downloadingBulk, setDownloadingBulk] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: 'info' | 'error' | 'success' } | null>(null);

  const showToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  usePageMeta({
    title: 'Lihat Raport Pengajian',
    description: 'Lihat dan unduh raport pengajian Al-Qur\'an dan Takhassus per santri atau per kelompok.',
  });

  // Options
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

  const isJenisDisabled = isNonAdmin && options.length <= 1;
  const isKategoriDisabled = !selectedJenis || (isNonAdmin && availableKategori.length <= 1);
  const isRosterDisabled = !activeKategori || (isNonAdmin && availableRosters.length <= 1);

  // Auto-selection and snap for non-admin
  useEffect(() => {
    if (options.length === 0) return;

    let curJenis = selectedJenis;
    if (!curJenis || !options.some(o => o.jenis === curJenis)) {
      curJenis = options[0].jenis;
      setSelectedJenis(curJenis);
      setSelectedKategori('');
      setSelectedTargetId(null);
    }

    const opt = options.find(o => o.jenis === curJenis);
    if (!opt) return;

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

    const rosters = opt.targets.filter(t => !curKat || t.kategori === curKat);
    if (rosters.length > 0) {
      if (!selectedTargetId || (!isAdmin && !allowedTargetIds.has(selectedTargetId)) || !rosters.some(r => r.target_id === selectedTargetId)) {
        setSelectedTargetId(rosters[0].target_id);
      }
    }
  }, [options, selectedJenis, selectedKategori, selectedTargetId, isAdmin, allowedTargetIds]);

  // Session data when mode = 'kelompok'
  const sessionEnabled = mode === 'kelompok' && !!selectedJenis && !!selectedTargetId;
  const { data: session, isLoading: loadingSession } = useQuery<SessionData>({
    queryKey: ['raport-session-view', selectedJenis, selectedTargetId, bulan, tahun],
    queryFn: async () => (await api.get('/api/raport-pengajian/session', {
      params: { jenis: selectedJenis, target_id: selectedTargetId, bulan, tahun },
    })).data,
    enabled: sessionEnabled,
  });

  // Search santri by name when mode = 'nama'
  const { data: santriList = [] } = useQuery<SantriOption[]>({
    queryKey: ['santri-list-raport', searchName],
    queryFn: async () => (await api.get('/api/santri', { params: { search: searchName } })).data,
    enabled: mode === 'nama' && searchName.length >= 2,
  });

  // Fetch individual raport
  const raportEnabled = !!selectedSantriId;
  const { data: raport, isLoading: loadingRaport, error } = useQuery<RaportData>({
    queryKey: ['raport-view', selectedSantriId, bulan, tahun],
    queryFn: async () => (await api.get(`/api/raport-pengajian/${selectedSantriId}`, {
      params: { bulan, tahun },
    })).data,
    enabled: raportEnabled,
    retry: false,
  });

  useEffect(() => {
    if (error && selectedSantriId) {
      const is403 = (error as any)?.response?.status === 403;
      showToast(
        is403
          ? 'Santri berada di luar penugasan Anda.'
          : `Raport belum diisi untuk santri ini pada periode ${BULAN_NAMA[bulan]} ${tahun}.`,
        is403 ? 'error' : 'info'
      );
    }
  }, [error, selectedSantriId, bulan, tahun]);

  const { data: archives = [] } = useQuery<ArchiveDocument[]>({
    queryKey: ['raport-archives', selectedSantriId],
    queryFn: async () => (await api.get(`/api/raport-pengajian/${selectedSantriId}/history`)).data,
    enabled: !!selectedSantriId,
  });

  const handleDownloadPdf = async (sId?: number) => {
    const idToUse = sId || selectedSantriId;
    if (!idToUse) return;
    setDownloading(true);
    try {
      const response = await api.get(`/api/raport-pengajian/${idToUse}/pdf`, {
        params: { bulan, tahun },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Raport_Pengajian_${bulan}_${tahun}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('Gagal mengunduh PDF raport.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedSantriId) return;
    setPublishing(true);
    try {
      await api.post(`/api/raport-pengajian/${selectedSantriId}/publish`, { bulan, tahun });
      alert('Raport diterbitkan sebagai arsip versi baru.');
    } catch (cause) {
      const message = (cause as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Raport belum dapat diterbitkan.';
      alert(message);
    } finally { setPublishing(false); }
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
      alert('Gagal mengunduh PDF bulk. Pastikan setidaknya 1 santri sudah diisi nilainya.');
    } finally {
      setDownloadingBulk(false);
    }
  };

  return (
    <section className="app-container raport-page">
      <div style={{ marginBottom: '14px' }}>
        <Link
          to="/raport"
          className="santri-back-link"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#0f766e',
            textDecoration: 'none',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Kembali ke Raport Pengajian</span>
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 className="ui-text-title">Lihat Raport Pengajian</h1>

        {/* Mode switch */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--kertas-kartu)', border: '1px solid var(--garis)', padding: '4px', borderRadius: '8px' }}>
          <button
            className={`secondary-button ${mode === 'kelompok' ? 'active' : ''}`}
            style={{ padding: '8px 16px', fontSize: '13px', border: 'none', background: mode === 'kelompok' ? 'var(--aksen)' : 'transparent', color: mode === 'kelompok' ? '#fff' : 'var(--tinta)' }}
            onClick={() => { setMode('kelompok'); setSelectedSantriId(null); }}
          >
            Per Kelompok
          </button>
          <button
            className={`secondary-button ${mode === 'nama' ? 'active' : ''}`}
            style={{ padding: '8px 16px', fontSize: '13px', border: 'none', background: mode === 'nama' ? 'var(--aksen)' : 'transparent', color: mode === 'nama' ? '#fff' : 'var(--tinta)' }}
            onClick={() => { setMode('nama'); setSelectedSantriId(null); }}
          >
            Cari Nama Santri
          </button>
        </div>
      </div>

      {optionsError && (
        <div className="error-box" role="alert">
          Sesi login tidak valid atau sudah berakhir. Masuk kembali untuk memuat data Raport.
          <button type="button" className="secondary-button" onClick={() => void refetchOptions()}>Coba lagi</button>
        </div>
      )}

      <div className="raport-selectors" aria-busy={loadingOptions}>
        {loadingOptions ? <ContentSkeleton rows={3} /> : mode === 'kelompok' ? (
          <div className="raport-selector-row">
            <div className="raport-field">
              <AppDropdown
                id="raport-view-jenis"
                label="Jenis Pengajian"
                value={selectedJenis}
                placeholder="— Pilih jenis —"
                disabled={isJenisDisabled}
                options={options.map(option => ({ value: option.jenis, label: option.nama }))}
                onChange={value => {
                  setSelectedJenis(value);
                  setSelectedKategori('');
                  setSelectedTargetId(null);
                  setSelectedSantriId(null);
                }}
              />
            </div>

            <div className="raport-field">
              <AppDropdown
                id="raport-view-kelompok"
                label="Kelompok"
                value={activeKategori}
                options={availableKategori.map(cat => ({ value: cat, label: cat }))}
                placeholder="— Pilih kelompok —"
                disabled={isKategoriDisabled}
                onChange={value => {
                  setSelectedKategori(value);
                  setSelectedTargetId(null);
                  setSelectedSantriId(null);
                }}
              />
            </div>

            <div className="raport-field">
              <AppDropdown
                id="raport-view-roster"
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
                  setSelectedSantriId(null);
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
                id="raport-view-kelompok-bulan"
                label="Bulan"
                value={String(bulan)}
                options={BULAN_NAMA.slice(1).map((nama, index) => ({ value: String(index + 1), label: nama }))}
                onChange={value => setBulan(Number(value))}
              />
            </div>

            <div className="raport-field">
              <AppDropdown
                id="raport-view-kelompok-tahun"
                label="Tahun"
                value={String(tahun)}
                options={Array.from({ length: 5 }, (_, i) => {
                  const year = initTahun - 2 + i;
                  return { value: String(year), label: String(year) };
                })}
                onChange={value => setTahun(Number(value))}
              />
            </div>
          </div>
        ) : (
          <div className="raport-selector-row">
            <div className="raport-field raport-field-wide">
              <label className="ui-text-label" htmlFor="raport-view-nama">Cari Nama Santri</label>
              <input
                id="raport-view-nama"
                type="text"
                className="raport-select"
                placeholder="Ketik nama santri (min. 2 huruf)..."
                value={searchName}
                onChange={e => { setSearchName(e.target.value); if (e.target.value.length < 2) setSelectedSantriId(null); }}
              />
              {santriList.length > 0 && searchName.length >= 2 && !selectedSantriId && (
                <div className="raport-search-dropdown">
                  {santriList.slice(0, 20).map(s => (
                    <button
                      key={s.santri_id}
                      className="raport-search-item"
                      onClick={() => { setSelectedSantriId(s.santri_id); setSearchName(s.nama); }}
                    >
                      <strong>{s.nama}</strong>
                      {s.nis && <span className="raport-search-nis">{s.nis}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="raport-field">
              <AppDropdown
                id="raport-view-nama-bulan"
                label="Bulan"
                value={String(bulan)}
                options={BULAN_NAMA.slice(1).map((nama, index) => ({ value: String(index + 1), label: nama }))}
                onChange={value => setBulan(Number(value))}
              />
            </div>

            <div className="raport-field">
              <AppDropdown
                id="raport-view-nama-tahun"
                label="Tahun"
                value={String(tahun)}
                options={Array.from({ length: 5 }, (_, i) => {
                  const year = initTahun - 2 + i;
                  return { value: String(year), label: String(year) };
                })}
                onChange={value => setTahun(Number(value))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Roster list when mode = 'kelompok' */}
      {mode === 'kelompok' && session && (
        <div style={{ background: 'var(--kertas-kartu)', border: '1px solid var(--garis)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Daftar Santri — {session.nama_kelompok}</h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--tinta-pudar)' }}>Periode: {BULAN_NAMA[bulan]} {tahun} ({session.santri.length} santri)</p>
            </div>
            <button
              className="primary-button"
              disabled={downloadingBulk}
              onClick={() => void handleDownloadPdfBulk()}
              style={{ padding: '10px 20px', fontSize: '13px' }}
            >
              {downloadingBulk ? 'Mengunduh PDF...' : 'Download PDF 1 Kelompok'}
            </button>
          </div>

          <div className="raport-table-wrapper" style={{ boxShadow: 'none', border: '1px solid var(--garis)', borderRadius: '8px', maxHeight: 'none', overflowY: 'visible' }}>
            <table className="raport-input-table ubudiyah-input-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>No</th>
                  <th style={{ textAlign: 'center' }}>Nama Santri</th>
                  <th>Status Raport</th>
                  <th style={{ width: '180px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {session.santri.map((s, i) => {
                  const sudahDiisi = Boolean(s.raport_id);
                  const isSelected = selectedSantriId === s.santri_id;
                  return (
                    <tr key={s.santri_id} style={{ background: isSelected ? 'rgba(15, 110, 86, 0.08)' : undefined }}>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{i + 1}</td>
                      <td style={{ textAlign: 'left', paddingLeft: '10px' }}>
                        <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{s.nama}</div>
                        {s.no_id_induk ? (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            NIP: {s.no_id_induk}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            NIP: —
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {sudahDiisi ? (
                          <span style={{ color: 'var(--status-hadir)', fontWeight: 600, fontSize: '12px' }}>Sudah Diisi</span>
                        ) : (
                          <span style={{ color: 'var(--tinta-pudar)', fontSize: '12px' }}>Belum Diisi</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="secondary-button"
                          style={{
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            backgroundColor: isSelected ? '#0f766e' : '#ffffff',
                            color: isSelected ? '#ffffff' : '#0f766e',
                            borderColor: '#0f766e',
                          }}
                          onClick={() => {
                            setSelectedSantriId(s.santri_id);
                            if (!sudahDiisi) {
                              showToast(`Raport belum diisi untuk santri ini pada periode ${BULAN_NAMA[bulan]} ${tahun}.`, 'info');
                            }
                          }}
                        >
                          {isSelected ? 'Terpilih' : 'Lihat Raport'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading states */}
      {loadingSession && mode === 'kelompok' && <ContentSkeleton rows={3} />}
      {loadingRaport && raportEnabled && <ContentSkeleton rows={6} />}
      {!selectedSantriId && mode === 'nama' && <div className="empty-state">Cari dan pilih nama santri untuk melihat detail raport.</div>}

      {/* Raport View Card */}
      {raport && (
        <div className="raport-view-card">
          {/* Header info */}
          <div className="raport-view-header">
            <h2 className="raport-view-title">RAPORT PENGAJIAN</h2>
            <div className="raport-view-meta">
              <div className="raport-meta-row">
                <span>Nama Santri</span><strong>{raport.santri.nama}</strong>
              </div>
              <div className="raport-meta-row">
                <span>NIS</span><strong>{raport.santri.nis ?? '-'}</strong>
              </div>
              <div className="raport-meta-row">
                <span>Kelas Formal</span><strong>{raport.santri.tingkat ? `${raport.santri.tingkat} ${raport.santri.nama_kelas ?? ''}` : '-'}</strong>
              </div>
              <div className="raport-meta-row">
                <span>Kamar</span><strong>{raport.santri.nama_kamar ?? '-'}</strong>
              </div>
              <div className="raport-meta-row">
                <span>Periode</span><strong>{BULAN_NAMA[raport.bulan]} {raport.tahun}</strong>
              </div>
              <div className="raport-meta-row">
                <span>Tahun Pelajaran</span><strong>{raport.tahun_pelajaran}</strong>
              </div>
              <div className="raport-meta-row">
                <span>Semester</span><strong>{raport.semester}</strong>
              </div>
            </div>
          </div>

          {/* Al-Qur'an */}
          <NilaiTable title="A. Pengajian Al Qur'an" section={raport.al_quran} label="Al Qur'an" />

          {/* Takhassus */}
          <NilaiTable title="B. Pengajian Takhassus" section={raport.takhassus} label="Takhassus" />

          {/* Predikat Scale */}
          <div className="raport-view-predikat-scale">
            <strong style={{ textDecoration: 'underline', marginBottom: '6px', display: 'block' }}>Predikat Nilai</strong>
            <div className="raport-predikat-grid">
              <span>90 – 100 : Sangat Memuaskan</span>
              <span>60 – 69 : Cukup</span>
              <span>80 – 89 : Memuaskan</span>
              <span>50 – 59 : Kurang</span>
              <span>70 – 79 : Baik</span>
              <span>0 – 49 : Sangat Kurang</span>
            </div>
          </div>

          {/* Kepribadian */}
          <div className="raport-view-section">
            <table className="raport-view-table raport-kepribadian-tbl">
              <thead>
                <tr>
                  <th style={{ width: '6%' }}>No</th>
                  <th style={{ width: '25%' }}>Kepribadian</th>
                  <th style={{ width: '10%' }}>Nilai</th>
                  <th style={{ width: '22%' }}>Keterangan</th>
                  <th style={{ width: '22%' }}>Predikat Umum</th>
                </tr>
              </thead>
              <tbody>
                {raport.kepribadian.map((k, i) => (
                  <tr key={k.jenis}>
                    <td style={{ textAlign: 'center' }}>{i + 1}</td>
                    <td>{k.jenis}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{k.nilai ?? '-'}</td>
                    <td style={{ textAlign: 'center' }}>{k.keterangan ?? '-'}</td>
                    {i === 0 && (
                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '14px' }} rowSpan={raport.kepribadian.length}>
                        {raport.predikat_umum ?? '-'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="raport-view-actions">
            {['Admin', 'Piket Pengajian'].includes(user?.jabatan ?? '') && <button className="secondary-button" disabled={publishing} onClick={() => void handlePublish()}>{publishing ? 'Menerbitkan…' : 'Terbitkan arsip'}</button>}
            <button
              className="primary-button"
              disabled={downloading}
              onClick={() => void handleDownloadPdf()}
            >
              {downloading ? 'Mengunduh…' : 'Download PDF Santri Ini'}
            </button>
          </div>
          <section className="panel" aria-labelledby="raport-archive-title" style={{ marginTop: '18px' }}>
            <div className="panel-heading"><div><h2 id="raport-archive-title">Riwayat penerbitan</h2><p>Setiap penerbitan disimpan sebagai versi arsip terpisah.</p></div></div>
            {archives.length === 0 ? <p className="muted">Belum ada arsip untuk santri ini.</p> : <div className="master-category-list">{archives.map(archive => <div className="master-category-row" key={archive.document_id}><div><strong>{archive.tahun_pelajaran} · {archive.semester} · Versi {archive.versi}</strong><span>Diterbitkan {new Date(archive.diterbitkan_pada).toLocaleString('id-ID')}</span></div><a className="secondary-button" href={`/api/raport-pengajian/${selectedSantriId}/documents/${archive.document_id}/pdf`}>Unduh arsip</a></div>)}</div>}
          </section>
        </div>
      )}

      {/* Toast Notification Standar Kanan Atas */}
      {toast && (
        <AppToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </section>
  );
}

export default RaportViewPage;
