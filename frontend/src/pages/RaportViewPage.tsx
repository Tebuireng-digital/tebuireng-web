import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
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
  nama: string;
}

interface SessionSantri {
  santri_id: number;
  nis: string | null;
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
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(urlKelompok);
  const [searchName, setSearchName] = useState('');
  const [selectedSantriId, setSelectedSantriId] = useState<number | null>(null);
  const [bulan, setBulan] = useState(urlBulan);
  const [tahun, setTahun] = useState(urlTahun);
  const [downloading, setDownloading] = useState(false);
  const [downloadingBulk, setDownloadingBulk] = useState(false);

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

  const currentOption = options.find(o => o.jenis === selectedJenis);

  return (
    <section className="app-container raport-page">
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

      {/* Selectors Panel */}
      <div className="raport-selectors" aria-busy={loadingOptions}>
        {loadingOptions ? <ContentSkeleton rows={3} /> : mode === 'kelompok' ? (
          <div className="raport-selector-row">
            <div className="raport-field">
              <label className="ui-text-label" htmlFor="raport-view-jenis">Jenis Pengajian</label>
              <select
                id="raport-view-jenis"
                className="raport-select"
                value={selectedJenis}
                onChange={e => { setSelectedJenis(e.target.value); setSelectedTargetId(null); setSelectedSantriId(null); }}
              >
                <option value="">— Pilih jenis —</option>
                {options.map(opt => (
                  <option key={opt.jenis} value={opt.jenis}>{opt.nama}</option>
                ))}
              </select>
            </div>

            <div className="raport-field">
              <label className="ui-text-label" htmlFor="raport-view-kelompok">Kelompok</label>
              <select
                id="raport-view-kelompok"
                className="raport-select"
                value={selectedTargetId ?? ''}
                onChange={e => { setSelectedTargetId(Number(e.target.value) || null); setSelectedSantriId(null); }}
                disabled={!selectedJenis}
              >
                <option value="">— Pilih kelompok —</option>
                {currentOption?.targets.map(t => (
                  <option key={t.target_id} value={t.target_id}>
                    {t.kategori ? `${t.kategori} — ` : ''}{t.nama_target}
                  </option>
                ))}
              </select>
            </div>

            <div className="raport-field">
              <label className="ui-text-label" htmlFor="raport-view-kelompok-bulan">Bulan</label>
              <select id="raport-view-kelompok-bulan" className="raport-select" value={bulan} onChange={e => setBulan(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{BULAN_NAMA[i + 1]}</option>
                ))}
              </select>
            </div>

            <div className="raport-field">
              <label className="ui-text-label" htmlFor="raport-view-kelompok-tahun">Tahun</label>
              <select id="raport-view-kelompok-tahun" className="raport-select" value={tahun} onChange={e => setTahun(Number(e.target.value))}>
                {Array.from({ length: 5 }, (_, i) => {
                  const y = initTahun - 2 + i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
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
              <label className="ui-text-label" htmlFor="raport-view-nama-bulan">Bulan</label>
              <select id="raport-view-nama-bulan" className="raport-select" value={bulan} onChange={e => setBulan(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{BULAN_NAMA[i + 1]}</option>
                ))}
              </select>
            </div>

            <div className="raport-field">
              <label className="ui-text-label" htmlFor="raport-view-nama-tahun">Tahun</label>
              <select id="raport-view-nama-tahun" className="raport-select" value={tahun} onChange={e => setTahun(Number(e.target.value))}>
                {Array.from({ length: 5 }, (_, i) => {
                  const y = initTahun - 2 + i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Roster list when mode = 'kelompok' */}
      {mode === 'kelompok' && session && (
        <div style={{ background: 'var(--kertas-kartu)', border: '1px solid var(--garis)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Daftar Santri — {session.nama_kelompok}</h3>
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

          <div style={{ overflowX: 'auto' }}>
            <table className="raport-input-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>No</th>
                  <th style={{ textAlign: 'left', paddingLeft: '10px' }}>Nama Santri</th>
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
                        <div style={{ fontWeight: 600 }}>{s.nama}</div>
                        {s.nis && <div style={{ fontSize: '11px', color: 'var(--tinta-pudar)' }}>{s.nis}</div>}
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
                          className="secondary-button"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => setSelectedSantriId(s.santri_id)}
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
      {error && raportEnabled && <div className="empty-state">Raport belum diisi untuk santri ini pada periode {BULAN_NAMA[bulan]} {tahun}.</div>}

      {!selectedSantriId && mode === 'nama' && <div className="empty-state">Cari dan pilih nama santri untuk melihat detail raport.</div>}
      {!selectedSantriId && mode === 'kelompok' && session && <div className="empty-state">Klik tombol "Lihat Raport" pada salah satu santri di atas untuk melihat detail lengkapnya.</div>}

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
            <button
              className="primary-button"
              disabled={downloading}
              onClick={() => void handleDownloadPdf()}
            >
              {downloading ? 'Mengunduh…' : 'Download PDF Santri Ini'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default RaportViewPage;
