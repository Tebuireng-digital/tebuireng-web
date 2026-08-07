import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

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

const jakartaDateTime = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
};

export function CatatGerbangPage() {
  const [activeList, setActiveList] = useState<PerizinanRecord[]>([]);
  const [inactiveList, setInactiveList] = useState<PerizinanRecord[]>([]);
  const [jenisList, setJenisList] = useState<JenisIzin[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SantriResult[]>([]);
  const [selectedSantri, setSelectedSantri] = useState<SantriResult | null>(null);
  const [jenisId, setJenisId] = useState('');
  const [keperluan, setKeperluan] = useState('');
  const [tanggalMulai, setTanggalMulai] = useState(jakartaDateTime());
  const [rencanaKembali, setRencanaKembali] = useState(jakartaDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Filter perizinan tidak aktif
  const [inactiveSearch, setInactiveSearch] = useState('');
  const [inactiveStatusFilter, setInactiveStatusFilter] = useState('');

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
    fetchData().catch(() => setMessage('Data perizinan tidak dapat dimuat.')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedSantri || search.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api.get('/api/santri', { params: { q: search.trim() } })
        .then(response => setResults(response.data))
        .catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, selectedSantri]);

  const filteredInactiveList = useMemo(() => {
    const q = inactiveSearch.trim().toLowerCase();
    return inactiveList.filter(item => {
      const matchSearch = !q || [item.nama_santri, item.nis ?? '', item.keperluan]
        .some(val => val.toLowerCase().includes(q));
      const matchStatus = !inactiveStatusFilter || item.status.toLowerCase() === inactiveStatusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [inactiveList, inactiveSearch, inactiveStatusFilter]);

  const createIzin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSantri) return;
    setSaving(true);
    setMessage('');
    try {
      await api.post('/api/perizinan', {
        santri_id: selectedSantri.santri_id,
        jenis_izin_id: Number(jenisId),
        keperluan,
        tanggal_mulai: tanggalMulai,
        rencana_kembali: rencanaKembali,
      });
      setMessage('Izin tersimpan dan status absensi otomatis diperbarui menjadi Izin.');
      setSelectedSantri(null);
      setSearch('');
      setKeperluan('');
      await fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.message ?? 'Perizinan gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleGerbang = async (id: number, type: 'keluar' | 'masuk') => {
    try {
      await api.patch(`/api/perizinan/${id}/gerbang`, {
        [type === 'keluar' ? 'waktu_keluar_aktual' : 'waktu_masuk_aktual']: jakartaDateTime(),
      });
      setMessage(type === 'keluar' ? 'Waktu keluar tercatat.' : 'Waktu kembali tercatat.');
      await fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.message ?? 'Data gerbang gagal disimpan.');
    }
  };

  const handleDownloadPdf = async (perizinanId: number, namaSantri: string) => {
    try {
      const response = await api.get(`/api/perizinan/${perizinanId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Surat_Izin_Pulang_${namaSantri.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Gagal mengunduh PDF:', error);
      setMessage('Gagal mengunduh file PDF.');
    }
  };

  if (loading) return <div className="empty-state">Memuat perizinan...</div>;

  return (
    <div className="permit-page">
      <header className="dashboard-header">
        <h1>Perizinan & Gerbang</h1>
        <p>Kelola perizinan santri, pencatatan gerbang keluar/kembali, serta riwayat perizinan selesai.</p>
      </header>

      {message && <div className="warning-box" style={{ marginBottom: 20 }}>{message}</div>}

      <form className="permit-form" onSubmit={createIzin}>
        <h2>Buat izin santri baru</h2>
        <label>Santri *</label>
        <div className="search-field">
          <input
            value={search}
            onChange={event => { setSearch(event.target.value); setSelectedSantri(null); }}
            placeholder="Cari nama santri atau NIS..."
            required
          />
          {results.length > 0 && (
            <div className="search-results">
              {results.map(santri => (
                <button type="button" key={santri.santri_id} onClick={() => { setSelectedSantri(santri); setSearch(santri.nama); setResults([]); }}>
                  <strong>{santri.nama}</strong><small>{santri.nis ?? 'Tanpa NIS'} · {santri.nama_kamar ?? 'Kamar belum terdata'}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-grid">
          <div><label>Jenis izin</label><select value={jenisId} onChange={event => setJenisId(event.target.value)} required>{jenisList.map(jenis => <option key={jenis.jenis_izin_id} value={jenis.jenis_izin_id}>{jenis.nama}</option>)}</select></div>
          <div><label>Keperluan</label><input value={keperluan} onChange={event => setKeperluan(event.target.value)} required maxLength={255} placeholder="Alasan izin / keperluan" /></div>
          <div><label>Mulai izin</label><input type="datetime-local" value={tanggalMulai} onChange={event => setTanggalMulai(event.target.value)} required /></div>
          <div><label>Rencana kembali</label><input type="datetime-local" value={rencanaKembali} min={tanggalMulai} onChange={event => setRencanaKembali(event.target.value)} required /></div>
        </div>
        <button className="primary-button" disabled={saving || !selectedSantri}>{saving ? 'Menyimpan...' : 'Buat dan setujui izin'}</button>
      </form>

      {/* DAFTAR IZIN AKTIF */}
      <section className="permit-list" style={{ marginBottom: 36 }}>
        <h2>Daftar Izin Aktif ({activeList.length})</h2>
        {activeList.length === 0 ? (
          <div className="empty-state">Tidak ada santri yang sedang memiliki izin aktif saat ini.</div>
        ) : (
          activeList.map(item => (
            <article key={item.perizinan_id} className="permit-card">
              <div>
                <strong>{item.nama_santri}</strong>
                <p>{item.keperluan} · Rencana kembali: {item.rencana_kembali}</p>
                <span className="schedule-label" style={{ marginTop: 4, display: 'inline-block' }}>
                  Status: {item.status}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="download-pdf-btn"
                  onClick={() => handleDownloadPdf(item.perizinan_id, item.nama_santri)}
                >
                  📄 PDF
                </button>
                <button
                  className="primary-button"
                  onClick={() => void handleGerbang(item.perizinan_id, item.status === 'Disetujui' ? 'keluar' : 'masuk')}
                >
                  {item.status === 'Disetujui' ? 'Catat keluar' : 'Catat kembali'}
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {/* DAFTAR PERIZINAN TIDAK AKTIF (RIWAYAT SELESAI / KADALUARSA) */}
      <section className="master-section">
        <div className="section-heading">
          <div>
            <h2>Daftar Perizinan Tidak Aktif / Riwayat Selesai</h2>
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
          Menampilkan {filteredInactiveList.length} dari {inactiveList.length} riwayat perizinan tidak aktif.
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
              {filteredInactiveList.map((item, idx) => {
                const isSelesai = item.status === 'Selesai';
                const isKadaluarsa = item.status === 'Kadaluarsa';
                const badgeColor = isSelesai ? '#10b981' : isKadaluarsa ? '#ef4444' : '#64748b';
                const badgeBg = isSelesai ? '#ecfdf5' : isKadaluarsa ? '#fef2f2' : '#f1f5f9';

                return (
                  <tr key={item.perizinan_id}>
                    <td>{idx + 1}</td>
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
                      <button
                        type="button"
                        className="download-pdf-btn"
                        style={{ padding: '4px 8px', borderRadius: '8px', fontSize: '11px' }}
                        onClick={() => handleDownloadPdf(item.perizinan_id, item.nama_santri)}
                      >
                        📄 PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredInactiveList.length === 0 && (
            <div className="empty-state">Tidak ada riwayat perizinan tidak aktif yang sesuai.</div>
          )}
        </div>
      </section>
    </div>
  );
}
