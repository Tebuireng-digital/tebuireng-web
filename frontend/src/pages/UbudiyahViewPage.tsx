import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { AppDropdown } from '../components/AppDropdown';
import { ContentSkeleton } from '../components/LoadingSkeleton';
import { usePageMeta } from '../hooks/usePageMeta';

interface NilaiRow {
  aspek: string;
  nilai_angka: number | null;
  nilai_huruf: string;
  predikat: string;
  catatan: string | null;
}

interface RaportData {
  raport_ubudiyah_id: number;
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
  nama_pembina: string;
  nilai: NilaiRow[];
  total_nilai: number;
  rata_rata: number;
  peringkat: number;
  dari: number;
}

interface RoomOption {
  target_id: number;
  nama_target: string;
}

interface RosterSantri {
  santri_id: number;
  nis: string | null;
  nama: string;
  raport_ubudiyah_id: number | null;
}

interface RoomSessionData {
  nama_kamar: string;
  target_id: number;
  bulan: number;
  tahun: number;
  santri: RosterSantri[];
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

export function UbudiyahViewPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { bulan: initBulan, tahun: initTahun } = nowJakarta();

  // Mode state: 'kamar' or 'nama'
  const [mode, setMode] = useState<'kamar' | 'nama'>('kamar');

  // Search Santri State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedSantri, setSelectedSantri] = useState<any | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearchingSantri, setIsSearchingSantri] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Kamar selector state
  const [selectedKamarId, setSelectedKamarId] = useState<number | null>(
    searchParams.get('kamar') ? Number(searchParams.get('kamar')) : null
  );

  // Period selector state
  const [bulan, setBulan] = useState(Number(searchParams.get('bulan')) || initBulan);
  const [tahun, setTahun] = useState(Number(searchParams.get('tahun')) || initTahun);
  
  const [selectedSantriId, setSelectedSantriId] = useState<number | null>(
    searchParams.get('santri_id') ? Number(searchParams.get('santri_id')) : null
  );

  const [downloading, setDownloading] = useState(false);
  const [downloadingBulk, setDownloadingBulk] = useState(false);

  usePageMeta({
    title: 'Lihat Laporan Ubudiyah',
    description: 'Pencarian dan pratinjau lembar Laporan Ubudiyah Yaumiyah santri per kamar atau nama.',
  });

  // 1. Fetch Room Options (assigned to the logged-in staff)
  const { data: rooms = [], isLoading: loadingRooms, isError: roomsError, refetch: refetchRooms } = useQuery<RoomOption[]>({
    queryKey: ['ubudiyah-view-rooms', user?.petugas_id],
    queryFn: async () => (await api.get('/api/ubudiyah/options')).data,
    enabled: !!user,
  });

  // Set default room if rooms exist and no room is selected
  useEffect(() => {
    if (rooms.length > 0 && !selectedKamarId) {
      setSelectedKamarId(rooms[0].target_id);
    }
  }, [rooms, selectedKamarId]);

  // 2. Fetch Room Roster list (when mode = 'kamar')
  const sessionEnabled = mode === 'kamar' && !!selectedKamarId;
  const { data: session, isLoading: loadingSession, isError: sessionError, refetch: refetchSession } = useQuery<RoomSessionData>({
    queryKey: ['ubudiyah-session-view', selectedKamarId, bulan, tahun],
    queryFn: async () => (await api.get('/api/ubudiyah/session', {
      params: { target_id: selectedKamarId, bulan, tahun },
    })).data,
    enabled: sessionEnabled,
  });

  // 3. Search Santri by Name (when mode = 'nama' and search term is entered)
  useEffect(() => {
    if (searchTerm.trim().length >= 2 && (!selectedSantri || searchTerm !== selectedSantri.nama)) {
      const delayDebounceFn = setTimeout(() => {
        setIsSearchingSantri(true);
        api.get(`/api/santri?q=${encodeURIComponent(searchTerm.trim())}`).then(res => {
          setSearchResults(res.data);
          setShowDropdown(true);
        }).catch(console.error).finally(() => setIsSearchingSantri(false));
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setShowDropdown(false);
    }
  }, [searchTerm, selectedSantri]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync selectedSantri details if santri_id param is passed in URL
  useEffect(() => {
    const paramId = searchParams.get('santri_id');
    if (paramId && Number(paramId) !== selectedSantriId) {
      const numericId = Number(paramId);
      setSelectedSantriId(numericId);
      
      // Try to load santri info to update text field
      api.get(`/api/santri?q=`).then(res => {
        const found = res.data.find((s: any) => s.santri_id === numericId);
        if (found) {
          setSelectedSantri(found);
          setSearchTerm(found.nama);
        }
      }).catch(console.error);
    }
  }, [searchParams]);

  // 4. Fetch Individual Raport Preview
  const raportEnabled = !!selectedSantriId;
  const { data: raport, isLoading: loadingRaport, error: raportError } = useQuery<RaportData>({
    queryKey: ['ubudiyah-view-single', selectedSantriId, bulan, tahun],
    queryFn: async () => (await api.get(`/api/ubudiyah/${selectedSantriId}`, { params: { bulan, tahun } })).data,
    enabled: raportEnabled,
    retry: false,
  });

  const handleSelectSantri = (santri: any) => {
    setSelectedSantri(santri);
    setSearchTerm(santri.nama);
    setSelectedSantriId(santri.santri_id);
    setSearchResults([]);
    setShowDropdown(false);
    setSearchParams({ santri_id: String(santri.santri_id), bulan: String(bulan), tahun: String(tahun) });
  };

  const handleClearSantri = () => {
    setSelectedSantri(null);
    setSearchTerm('');
    setSelectedSantriId(null);
    setSearchResults([]);
    setSearchParams({ bulan: String(bulan), tahun: String(tahun) });
  };

  const handleDownloadPdf = async () => {
    if (!selectedSantriId || !raport) return;
    setDownloading(true);
    try {
      const response = await api.get(`/api/ubudiyah/${selectedSantriId}/pdf`, {
        params: { bulan, tahun },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Laporan_Ubudiyah_${raport.santri.nama.replace(/\s+/g, '_')}_${bulan}_${tahun}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('Gagal mengunduh PDF.');
    } finally {
      setDownloading(false);
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
    <section className="app-container raport-view-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div className="page-heading" style={{ marginBottom: 0 }}>
          <span className="page-eyebrow">Evaluasi Pembinaan</span>
          <h1>Pratinjau Laporan Ubudiyah</h1>
        </div>

        {/* Mode switcher tabs */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--kertas-kartu)', border: '1px solid var(--garis)', padding: '4px', borderRadius: '8px' }}>
          <button
            type="button"
            className={`secondary-button ${mode === 'kamar' ? 'active' : ''}`}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '6px',
              background: mode === 'kamar' ? 'var(--aksen)' : 'transparent',
              color: mode === 'kamar' ? '#fff' : 'var(--tinta)',
              cursor: 'pointer'
            }}
            onClick={() => { setMode('kamar'); setSelectedSantriId(null); setSelectedSantri(null); setSearchTerm(''); }}
          >
            Per Kamar
          </button>
          <button
            type="button"
            className={`secondary-button ${mode === 'nama' ? 'active' : ''}`}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '6px',
              background: mode === 'nama' ? 'var(--aksen)' : 'transparent',
              color: mode === 'nama' ? '#fff' : 'var(--tinta)',
              cursor: 'pointer'
            }}
            onClick={() => { setMode('nama'); setSelectedSantriId(null); setSelectedSantri(null); setSearchTerm(''); }}
          >
            Cari Nama Santri
          </button>
        </div>
      </div>

      {roomsError && (
        <div className="error-box" role="alert">
          Daftar kamar gagal dimuat. Periksa koneksi atau sesi login Anda, lalu coba lagi.
          <button type="button" className="secondary-button" onClick={() => void refetchRooms()}>Coba lagi</button>
        </div>
      )}

      {/* Selectors Panel */}
      <div className="raport-selectors">
        {mode === 'kamar' ? (
          <div className="raport-selector-row">
            <div className="raport-field" style={{ flex: '2 1 200px' }}>
              <AppDropdown
                id="ubudiyah-view-kamar"
                label="Kamar"
                value={selectedKamarId ? String(selectedKamarId) : ''}
                placeholder="— Pilih Kamar —"
                options={rooms.map(room => ({ value: String(room.target_id), label: room.nama_target }))}
                onChange={value => { setSelectedKamarId(Number(value) || null); setSelectedSantriId(null); }}
              />
            </div>

            <div className="raport-field">
              <AppDropdown
                id="ubudiyah-view-kamar-bulan"
                label="Bulan"
                value={String(bulan)}
                options={BULAN_NAMA.slice(1).map((nama, index) => ({ value: String(index + 1), label: nama }))}
                onChange={value => { setBulan(Number(value)); setSelectedSantriId(null); }}
              />
            </div>

            <div className="raport-field">
              <AppDropdown
                id="ubudiyah-view-kamar-tahun"
                label="Tahun"
                value={String(tahun)}
                options={Array.from({ length: 5 }, (_, i) => {
                  const year = initTahun - 2 + i;
                  return { value: String(year), label: String(year) };
                })}
                onChange={value => { setTahun(Number(value)); setSelectedSantriId(null); }}
              />
            </div>
          </div>
        ) : (
          <div className="raport-selector-row">
            <div className="raport-field" style={{ flex: '2 1 250px', position: 'relative' }} ref={dropdownRef}>
              <label className="ui-text-label" htmlFor="ubudiyah-view-search">Nama Santri</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="ubudiyah-view-search"
                  type="text"
                  className="raport-select"
                  placeholder="Ketik nama atau NIS santri..."
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    if (selectedSantri) handleClearSantri();
                  }}
                  style={{ paddingRight: '40px' }}
                />
                {selectedSantri && (
                  <button type="button" onClick={handleClearSantri} className="btn-clear-input" style={{ position: 'absolute', right: '12px', border: 'none', background: 'none', cursor: 'pointer' }}>
                    X
                  </button>
                )}
              </div>
              {isSearchingSantri && <small className="field-hint">Mencari...</small>}

              {showDropdown && searchResults.length > 0 && (
                <div role="listbox" className="student-search-dropdown" style={{ width: '100%' }}>
                  {searchResults.map((s, idx) => (
                    <button
                      key={s.santri_id ?? idx}
                      type="button"
                      role="option"
                      aria-selected={selectedSantri?.santri_id === s.santri_id}
                      className="student-search-result"
                      onClick={() => handleSelectSantri(s)}
                    >
                      <span className="search-result-name">{s.nama}</span>
                      <span className="search-result-meta">NIS: {s.nis || '-'} &bull; {s.nama_kamar || 'Kamar -'} &bull; {s.nama_unit || 'Unit -'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="raport-field">
              <AppDropdown
                id="ubudiyah-view-nama-bulan"
                label="Bulan"
                value={String(bulan)}
                options={BULAN_NAMA.slice(1).map((nama, index) => ({ value: String(index + 1), label: nama }))}
                onChange={value => setBulan(Number(value))}
              />
            </div>

            <div className="raport-field">
              <AppDropdown
                id="ubudiyah-view-nama-tahun"
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

      {/* Roster list when mode = 'kamar' */}
      {mode === 'kamar' && session && (
        <div style={{ background: 'var(--kertas-kartu)', border: '1px solid var(--garis)', borderRadius: '12px', padding: '20px', marginBottom: '20px', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Daftar Santri — {session.nama_kamar}</h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--tinta-pudar)' }}>Periode: {BULAN_NAMA[bulan]} {tahun} ({session.santri.length} santri)</p>
            </div>
            <button
              className="secondary-button"
              disabled={downloadingBulk || session.santri.length === 0}
              onClick={() => void handleDownloadPdfBulk()}
              style={{ padding: '10px 20px', fontSize: '13px' }}
            >
              {downloadingBulk ? 'Mengunduh PDF...' : 'Download PDF 1 Kamar'}
            </button>
          </div>

          <div className="raport-table-wrapper" style={{ boxShadow: 'none', border: '1px solid var(--garis)', borderRadius: '8px' }}>
            <table className="raport-input-table ubudiyah-input-table">
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
                  const sudahDiisi = Boolean(s.raport_ubudiyah_id);
                  const isSelected = selectedSantriId === s.santri_id;
                  return (
                    <tr key={s.santri_id} style={{ background: isSelected ? 'rgba(15, 110, 86, 0.08)' : undefined }}>
                      <td className="no-cell" style={{ textAlign: 'center', fontWeight: 600 }}>{i + 1}</td>
                      <td className="aspek-cell" style={{ textAlign: 'left', paddingLeft: '10px' }}>
                        <div style={{ fontWeight: 600 }}>{s.nama}</div>
                        {s.nis && <div style={{ fontSize: '11px', color: 'var(--tinta-pudar)' }}>{s.nis}</div>}
                      </td>
                      <td data-label="Status Laporan" style={{ textAlign: 'center' }}>
                        {sudahDiisi ? (
                          <span style={{ color: 'var(--status-hadir)', fontWeight: 600, fontSize: '12px' }}>Sudah Diisi</span>
                        ) : (
                          <span style={{ color: 'var(--tinta-pudar)', fontSize: '12px' }}>Belum Diisi</span>
                        )}
                      </td>
                      <td data-label="Aksi" style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="secondary-button"
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            backgroundColor: isSelected ? 'var(--aksen)' : 'var(--kertas-kartu)',
                            color: isSelected ? '#fff' : 'var(--aksen)'
                          }}
                          onClick={() => { setSelectedSantriId(s.santri_id); setSelectedSantri(s); setSearchTerm(s.nama); }}
                        >
                          {isSelected ? 'Terpilih' : 'Lihat Laporan'}
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

      {/* Loading & Empty States */}
      {loadingRooms && mode === 'kamar' && <ContentSkeleton rows={2} />}
      {loadingSession && mode === 'kamar' && <ContentSkeleton rows={3} />}
      {sessionError && mode === 'kamar' && (
        <div className="error-box" role="alert">
          {(sessionError as any)?.response?.status === 503
            ? 'Modul Ubudiyah belum siap. Hubungi Admin untuk menyiapkan database.'
            : 'Data laporan kamar gagal dimuat. Periksa koneksi atau akses kamar Anda, lalu coba lagi.'}
          <button type="button" className="secondary-button" onClick={() => void refetchSession()}>Coba lagi</button>
        </div>
      )}
      {!loadingSession && !sessionError && mode === 'kamar' && session && session.santri.length === 0 && (
        <div className="empty-state" role="status">Belum ada santri aktif pada kamar dan periode ini.</div>
      )}
      {loadingRaport && raportEnabled && <ContentSkeleton rows={6} />}

      {!selectedSantriId && mode === 'nama' && (
        <div className="empty-state" style={{ marginTop: '20px' }}>Cari dan pilih nama santri di atas untuk memuat pratinjau Laporan Ubudiyah.</div>
      )}

      {!selectedSantriId && mode === 'kamar' && session && (
        <div className="empty-state" style={{ marginTop: '20px' }}>Klik tombol "Lihat Laporan" pada daftar santri kamar di atas untuk memuat pratinjau raport.</div>
      )}

      {raportError && selectedSantriId && (
        <div className="empty-state" style={{ marginTop: '20px' }}>Laporan Ubudiyah Yaumiyah belum diisi untuk santri ini pada periode {BULAN_NAMA[bulan]} {tahun}.</div>
      )}

      {/* Raport Sheet Preview Card */}
      {raport && !loadingRaport && (
        <div style={{ marginTop: '24px' }}>
          <div className="raport-actions-bar" style={{ marginBottom: '16px', justifyContent: 'flex-end' }}>
            <button
              className="primary-button"
              disabled={downloading}
              onClick={() => void handleDownloadPdf()}
            >
              {downloading ? 'Mengunduh PDF...' : 'Download PDF Santri Ini'}
            </button>
          </div>

          {/* Paper Document Layout */}
          <div className="raport-document" style={{
            background: 'var(--kertas)',
            border: '1px solid var(--garis)',
            boxShadow: 'var(--bayangan-lembut)',
            padding: '30px 40px',
            borderRadius: '8px',
            fontFamily: 'Arial, sans-serif',
            color: '#000'
          }}>
            {/* Kop Surat */}
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '3px double #000', paddingBottom: '12px', marginBottom: '20px' }}>
              <img src="/simanteb-logo-transparent.png" alt="Logo SIMANTEB" style={{ height: '70px', width: '70px', marginRight: '20px' }} />
              <div style={{ textAlign: 'center', flex: 1 }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0', letterSpacing: '1px' }}>MAJELIS ILMI PONDOK PUTRA</h3>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '4px 0', letterSpacing: '2px' }}>PESANTREN TEBUIRENG JOMBANG</h2>
                <small style={{ fontSize: '10px', color: '#555' }}>Jl. Irian Jaya 10 Tebuireng Cukir Diwek Jombang 61471</small>
              </div>
            </div>

            {/* Document Title */}
            <h2 style={{ textAlign: 'center', fontSize: '15px', fontWeight: 'bold', textDecoration: 'underline', marginBottom: '20px' }}>
              LAPORAN UBUDIYAH YAUMIYAH
            </h2>

            {/* Student Info Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '24px', fontSize: '12px' }}>
              <div style={{ flex: '1 1 200px' }}>
                <table style={{ width: '100%' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '40%', padding: '3px 0' }}>Tahun Pelajaran</td>
                      <td style={{ width: '5%' }}>:</td>
                      <td style={{ fontWeight: 600 }}>{raport.tahun_pelajaran}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0' }}>Nomor Induk (NIS)</td>
                      <td>:</td>
                      <td>{raport.santri.nis || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0' }}>Nama Santri</td>
                      <td>:</td>
                      <td style={{ fontWeight: 700 }}>{raport.santri.nama}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <table style={{ width: '100%' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '40%', padding: '3px 0' }}>Semester</td>
                      <td style={{ width: '5%' }}>:</td>
                      <td style={{ fontWeight: 600 }}>{raport.semester}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0' }}>Kelas Formal</td>
                      <td>:</td>
                      <td>{raport.santri.tingkat ? `${raport.santri.tingkat} ${raport.santri.nama_kelas ?? ''}` : '-'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0' }}>Kamar</td>
                      <td>:</td>
                      <td>{raport.santri.nama_kamar || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Main Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F3F4F6' }}>
                  <th style={{ border: '1px solid #000', padding: '8px 6px', width: '6%', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }} rowSpan={2}>No</th>
                  <th style={{ border: '1px solid #000', padding: '8px 10px', width: '38%', textAlign: 'left', fontSize: '11px', fontWeight: 'bold' }} rowSpan={2}>Instrumen Penilaian</th>
                  <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }} colSpan={2}>Nilai</th>
                  <th style={{ border: '1px solid #000', padding: '8px 10px', width: '38%', textAlign: 'left', fontSize: '11px', fontWeight: 'bold' }} rowSpan={2}>Catatan</th>
                </tr>
                <tr style={{ backgroundColor: '#F3F4F6' }}>
                  <th style={{ border: '1px solid #000', padding: '6px', width: '9%', textAlign: 'center', fontSize: '10px', fontWeight: 'bold' }}>Angka</th>
                  <th style={{ border: '1px solid #000', padding: '6px', width: '9%', textAlign: 'center', fontSize: '10px', fontWeight: 'bold' }}>Huruf</th>
                </tr>
              </thead>
              <tbody>
                {raport.nilai.map((row, idx) => (
                  <tr key={row.aspek} style={{ fontSize: '11px' }}>
                    <td style={{ border: '1px solid #000', padding: '8px 6px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '8px 10px', textAlign: 'left', fontWeight: 500 }}>{row.aspek}</td>
                    <td style={{ border: '1px solid #000', padding: '8px 6px', textAlign: 'center', fontWeight: 'bold' }}>{row.nilai_angka ?? '—'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px 6px', textAlign: 'center', fontWeight: 'bold', color: 'var(--aksen)' }}>{row.nilai_huruf}</td>
                    <td style={{ border: '1px solid #000', padding: '8px 10px', textAlign: 'left', color: '#333' }}>{row.catatan || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total, Average, Ranking Card */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '11px' }}>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '8px 10px', width: '22%', fontWeight: 500 }}>Total Nilai</td>
                  <td style={{ border: '1px solid #000', padding: '8px 10px', width: '18%', fontWeight: 700 }}>{raport.total_nilai}</td>
                  <td style={{ border: '1px solid #000', padding: '8px 10px', width: '22%', fontWeight: 500 }}>Peringkat ke -</td>
                  <td style={{ border: '1px solid #000', padding: '8px 10px', width: '18%', fontWeight: 700 }}>{raport.peringkat || '—'}</td>
                  <td style={{ border: '1px solid #000', padding: '8px 10px', width: '20%' }} rowSpan={2}></td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '8px 10px', fontWeight: 500 }}>Rata-rata</td>
                  <td style={{ border: '1px solid #000', padding: '8px 10px', fontWeight: 700 }}>{raport.rata_rata}</td>
                  <td style={{ border: '1px solid #000', padding: '8px 10px', fontWeight: 500 }}>Dari</td>
                  <td style={{ border: '1px solid #000', padding: '8px 10px', fontWeight: 700 }}>{raport.dari || '—'} santri</td>
                </tr>
              </tbody>
            </table>

            {/* Predikat scale guide */}
            <div style={{ fontSize: '10px', fontStyle: 'italic', marginBottom: '28px', color: '#555' }}>
              <strong>Keterangan Predikat Nilai:</strong> A (85-100: Sangat Baik) &bull; B+ (80-84: Baik) &bull; B (75-79: Baik) &bull; C+ (70-74: Cukup) &bull; C (60-69: Cukup) &bull; D (50-59: Kurang) &bull; E (0-49: Sangat Kurang).
            </div>

            {/* Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', textAlign: 'center', marginTop: '20px' }}>
              <div style={{ width: '45%' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '60px' }}>Pembina Kamar</p>
                <p style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{raport.nama_pembina}</p>
              </div>
              <div style={{ width: '45%' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '60px' }}>Orang Tua / Wali</p>
                <p>_________________________</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default UbudiyahViewPage;
