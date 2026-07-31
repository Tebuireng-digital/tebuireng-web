import { useEffect, useState } from 'react';
import { api } from '../api';

interface SantriResult { santri_id: number; nama: string; nis: string | null; nama_kamar: string | null }
interface JenisIzin { jenis_izin_id: number; nama: string }
interface IzinAktif {
  perizinan_id: number;
  nama_santri: string;
  nis: string | null;
  keperluan: string;
  status: 'Disetujui' | 'Sedang Berjalan';
  rencana_kembali: string;
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
  const [list, setList] = useState<IzinAktif[]>([]);
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

  const fetchData = async () => {
    const [izinResponse, jenisResponse] = await Promise.all([
      api.get('/api/perizinan?status=Disetujui,Sedang Berjalan'),
      api.get('/api/perizinan-jenis'),
    ]);
    setList(izinResponse.data);
    setJenisList(jenisResponse.data);
    if (!jenisId && jenisResponse.data[0]) setJenisId(String(jenisResponse.data[0].jenis_izin_id));
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

  if (loading) return <div className="empty-state">Memuat perizinan...</div>;

  return (
    <div className="permit-page">
      <header className="dashboard-header">
        <h1>Perizinan & Gerbang</h1>
        <p>Keamanan membuat izin sekaligus menyetujuinya, lalu mencatat waktu keluar dan kembali.</p>
      </header>

      {message && <div className="warning-box" style={{ marginBottom: 20 }}>{message}</div>}

      <form className="permit-form" onSubmit={createIzin}>
        <h2>Buat izin santri</h2>
        <label>Santri</label>
        <div className="search-field">
          <input
            value={search}
            onChange={event => { setSearch(event.target.value); setSelectedSantri(null); }}
            placeholder="Cari nama atau NIS"
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
          <div><label>Keperluan</label><input value={keperluan} onChange={event => setKeperluan(event.target.value)} required maxLength={255} /></div>
          <div><label>Mulai izin</label><input type="datetime-local" value={tanggalMulai} onChange={event => setTanggalMulai(event.target.value)} required /></div>
          <div><label>Rencana kembali</label><input type="datetime-local" value={rencanaKembali} min={tanggalMulai} onChange={event => setRencanaKembali(event.target.value)} required /></div>
        </div>
        <button className="primary-button" disabled={saving || !selectedSantri}>{saving ? 'Menyimpan...' : 'Buat dan setujui izin'}</button>
      </form>

      <section className="permit-list">
        <h2>Izin aktif</h2>
        {list.length === 0 ? <div className="empty-state">Tidak ada santri yang sedang memiliki izin aktif.</div> : list.map(item => (
          <article key={item.perizinan_id} className="permit-card">
            <div><strong>{item.nama_santri}</strong><p>{item.keperluan} · kembali {item.rencana_kembali}</p></div>
            <button className="primary-button" onClick={() => void handleGerbang(item.perizinan_id, item.status === 'Disetujui' ? 'keluar' : 'masuk')}>
              {item.status === 'Disetujui' ? 'Catat keluar' : 'Catat kembali'}
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
