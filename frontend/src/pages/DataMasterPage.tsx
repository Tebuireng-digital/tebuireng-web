import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

interface Petugas { petugas_id: number; nama: string; username: string; jabatan: string; status_aktif: boolean; tanggung_jawab_absensi: string }
interface Opsi { jenis: string; nama: string; targets: Array<{ target_id: number; nama_target: string }> }
interface Penugasan { penugasan_id: number; nama_petugas: string; jabatan: string; tipe_target: string; nama_target: string }
interface Kamar { kamar_id: number; nama: string }
interface ImportReview {
  review_id: number; sumber_sheet: string; baris_sumber: number; nama_sumber: string; kode_kamar_sumber?: string;
  data_tambahan?: string; santri_otomatis_id?: number; nama_santri_otomatis?: string; kamar_santri_otomatis?: string;
  kandidat_santri_id?: number; nama_kandidat?: string; kamar_kandidat?: string; skor_kemiripan?: number; status: string;
}
interface KamarMapping { kode_sumber: string; jumlah_review: number; kamar_id?: number; nama_kamar?: string }
type MasterTab = 'penugasan' | 'review' | 'kamar' | 'akun';
type AccountSortKey = 'nama' | 'username' | 'jabatan' | 'tanggung_jawab_absensi';

const roleForJenis: Record<string, string> = {
  sekolah: 'Wali Kelas', kamar: 'Pembina Kamar', pbs: 'Ustadz', diniyah: 'Ustadz', pbm: 'Ustadz',
};

export function DataMasterPage() {
  const { tab } = useParams<{ tab?: string }>();
  const [petugas, setPetugas] = useState<Petugas[]>([]);
  const [opsi, setOpsi] = useState<Opsi[]>([]);
  const [penugasan, setPenugasan] = useState<Penugasan[]>([]);
  const [kamar, setKamar] = useState<Kamar[]>([]);
  const [reviews, setReviews] = useState<ImportReview[]>([]);
  const [mappings, setMappings] = useState<KamarMapping[]>([]);
  const [jenis, setJenis] = useState('sekolah');
  const [petugasId, setPetugasId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [passwordBaru, setPasswordBaru] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('perlu_tinjau');
  const [mappingChoices, setMappingChoices] = useState<Record<string, string>>({});
  const [namaKamarBaru, setNamaKamarBaru] = useState('');
  const [kodeKamarBaru, setKodeKamarBaru] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [accountRole, setAccountRole] = useState('');
  const [accountStatus, setAccountStatus] = useState('');
  const [accountAssignment, setAccountAssignment] = useState('');
  const [accountSort, setAccountSort] = useState<AccountSortKey>('nama');
  const [accountSortDirection, setAccountSortDirection] = useState<'asc' | 'desc'>('asc');
  const activeTab: MasterTab = ['penugasan', 'review', 'kamar', 'akun'].includes(tab ?? '')
    ? tab as MasterTab
    : 'penugasan';

  const fetchData = async () => {
    const [petugasResponse, opsiResponse, penugasanResponse, kamarResponse] = await Promise.all([
      api.get('/api/master/petugas'), api.get('/api/absensi-options'), api.get('/api/master/penugasan'), api.get('/api/master/kamar'),
    ]);
    setPetugas(petugasResponse.data);
    setOpsi(opsiResponse.data);
    setPenugasan(penugasanResponse.data);
    setKamar(kamarResponse.data);
  };

  const fetchReviews = async () => {
    const [reviewsResponse, mappingsResponse] = await Promise.all([
      api.get('/api/master/import-reviews', { params: reviewStatus ? { status: reviewStatus } : {} }),
      api.get('/api/master/kamar-mappings'),
    ]);
    setReviews(reviewsResponse.data);
    setMappings(mappingsResponse.data);
  };

  useEffect(() => {
    fetchData().catch(() => setMessage('Data master gagal dimuat.')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchReviews().catch(() => {
      // Tabel ini memang kosong hingga Admin menekan sinkronkan untuk pertama kali.
      setReviews([]); setMappings([]);
    });
  }, [reviewStatus]);

  const selectedOption = opsi.find(item => item.jenis === jenis);
  const eligiblePetugas = useMemo(
    () => petugas.filter(item => item.status_aktif && item.jabatan === roleForJenis[jenis]),
    [petugas, jenis],
  );
  const accountRoles = useMemo(
    () => [...new Set(petugas.map(item => item.jabatan))].sort((left, right) => left.localeCompare(right, 'id')),
    [petugas],
  );
  const visibleAccounts = useMemo(() => {
    const search = accountSearch.trim().toLocaleLowerCase('id');
    return petugas
      .filter(item => !search || [item.nama, item.username, item.jabatan, item.tanggung_jawab_absensi]
        .some(value => value.toLocaleLowerCase('id').includes(search)))
      .filter(item => !accountRole || item.jabatan === accountRole)
      .filter(item => !accountStatus || (accountStatus === 'aktif' ? item.status_aktif : !item.status_aktif))
      .filter(item => !accountAssignment
        || (accountAssignment === 'ditugaskan'
          ? item.tanggung_jawab_absensi !== '-'
          : item.tanggung_jawab_absensi === '-'))
      .sort((left, right) => {
        const comparison = left[accountSort].localeCompare(right[accountSort], 'id', {
          numeric: true,
          sensitivity: 'base',
        });
        return accountSortDirection === 'asc' ? comparison : -comparison;
      });
  }, [petugas, accountSearch, accountRole, accountStatus, accountAssignment, accountSort, accountSortDirection]);

  const toggleAccountSort = (key: AccountSortKey) => {
    if (accountSort === key) {
      setAccountSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    setAccountSort(key);
    setAccountSortDirection('asc');
  };

  const accountSortIndicator = (key: AccountSortKey) => accountSort === key
    ? (accountSortDirection === 'asc' ? ' ↑' : ' ↓')
    : '';

  useEffect(() => {
    setPetugasId(eligiblePetugas[0] ? String(eligiblePetugas[0].petugas_id) : '');
    setTargetId(selectedOption?.targets[0] ? String(selectedOption.targets[0].target_id) : '');
  }, [jenis, petugas, opsi]);

  const saveAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.post('/api/master/penugasan', { petugas_id: Number(petugasId), jenis, target_id: Number(targetId) });
      setMessage('Penugasan berhasil disimpan.');
      await fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.message ?? 'Penugasan gagal disimpan.');
    }
  };

  const removeAssignment = async (id: number) => {
    if (!window.confirm('Hapus penugasan ini?')) return;
    await api.delete(`/api/master/penugasan/${id}`);
    setMessage('Penugasan dihapus.');
    await fetchData();
  };

  const resetPassword = async (id: number) => {
    if (!window.confirm('Reset password petugas ini?')) return;
    try {
      const response = await api.post(`/api/petugas/${id}/reset-password`);
      setPasswordBaru(response.data.new_password);
    } catch (error: any) {
      setMessage(error.response?.data?.message ?? 'Password gagal direset.');
    }
  };

  const syncReviews = async () => {
    setReviewLoading(true);
    try {
      const response = await api.post('/api/master/import-reviews/sync');
      setMessage(`${response.data.message} ${response.data.total_sumber} baris sumber diperiksa.`);
      await fetchReviews();
    } catch (error: any) {
      setMessage(error.response?.data?.message ?? 'Sinkronisasi review impor gagal.');
    } finally { setReviewLoading(false); }
  };

  const mergeReview = async (review: ImportReview) => {
    if (!review.kandidat_santri_id || !window.confirm(`Gabungkan “${review.nama_sumber}” ke kandidat “${review.nama_kandidat}”? Data induk kandidat dipertahankan.`)) return;
    try {
      const response = await api.post(`/api/master/import-reviews/${review.review_id}/merge`, { kandidat_santri_id: review.kandidat_santri_id });
      setMessage(response.data.message); await fetchReviews();
    } catch (error: any) { setMessage(error.response?.data?.message ?? 'Penggabungan gagal.'); }
  };

  const markSeparate = async (review: ImportReview) => {
    if (!window.confirm(`Tandai “${review.nama_sumber}” dan kandidatnya sebagai dua santri berbeda?`)) return;
    try {
      const response = await api.post(`/api/master/import-reviews/${review.review_id}/separate`);
      setMessage(response.data.message); await fetchReviews();
    } catch (error: any) { setMessage(error.response?.data?.message ?? 'Keputusan gagal disimpan.'); }
  };

  const saveMapping = async (mapping: KamarMapping) => {
    const kamarId = Number(mappingChoices[mapping.kode_sumber] || mapping.kamar_id);
    if (!kamarId) { setMessage('Pilih kamar tujuan terlebih dahulu.'); return; }
    if (!window.confirm(`Simpan kode ${mapping.kode_sumber} sebagai kamar tujuan terpilih?`)) return;
    try {
      const response = await api.post('/api/master/kamar-mappings', { kode_sumber: mapping.kode_sumber, kamar_id: kamarId });
      setMessage(`${response.data.message} ${response.data.santri_diperbarui} data santri dilengkapi.`); await fetchReviews();
    } catch (error: any) { setMessage(error.response?.data?.message ?? 'Mapping kamar gagal disimpan.'); }
  };

  const createKamarAndMapping = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!namaKamarBaru.trim()) { setMessage('Nama kamar resmi wajib diisi.'); return; }
    try {
      const response = await api.post('/api/master/kamar', { nama: namaKamarBaru, kode_sumber: kodeKamarBaru || null });
      setMessage(`${response.data.message} ${response.data.santri_diperbarui ?? 0} data santri dilengkapi.`);
      setNamaKamarBaru(''); setKodeKamarBaru('');
      await Promise.all([fetchData(), fetchReviews()]);
    } catch (error: any) { setMessage(error.response?.data?.message ?? 'Kamar atau mapping gagal disimpan.'); }
  };

  if (loading) return <div className="empty-state">Memuat data master...</div>;

  return (
    <div className="master-page">
      <header className="dashboard-header"><h1>Data Master</h1><p>Kelola penugasan pembina untuk setiap kegiatan absensi.</p></header>
      {message && <div className="warning-box" style={{ marginBottom: 16 }}>{message}</div>}
      {passwordBaru && <div className="password-result">Password baru: <strong>{passwordBaru}</strong><button onClick={() => { void navigator.clipboard.writeText(passwordBaru); setPasswordBaru(''); }}>Salin & tutup</button></div>}

      {activeTab === 'penugasan' && <section className="master-section">
        <h2>Tambah penugasan absensi</h2>
        <form className="assignment-form" onSubmit={saveAssignment}>
          <div><label>Kegiatan</label><select value={jenis} onChange={event => setJenis(event.target.value)}>{opsi.map(item => <option key={item.jenis} value={item.jenis}>{item.nama}</option>)}</select></div>
          <div><label>Petugas ({roleForJenis[jenis]})</label><select value={petugasId} onChange={event => setPetugasId(event.target.value)} required>{eligiblePetugas.map(item => <option key={item.petugas_id} value={item.petugas_id}>{item.nama}</option>)}</select></div>
          <div><label>{jenis === 'sekolah' ? 'Kelas formal' : 'Kelompok'}</label><select value={targetId} onChange={event => setTargetId(event.target.value)} required>{selectedOption?.targets.map(target => <option key={target.target_id} value={target.target_id}>{target.nama_target}</option>)}</select></div>
          <button className="primary-button" disabled={!petugasId || !targetId}>Simpan penugasan</button>
        </form>
        {jenis === 'sekolah' && <div className="warning-box">Setiap kelas formal hanya dapat memiliki satu petugas absensi aktif agar penyimpanan tidak saling menimpa.</div>}
        {eligiblePetugas.length === 0 && <div className="warning-box">Belum ada petugas aktif dengan jabatan {roleForJenis[jenis]}.</div>}

        <div className="table-scroll"><table className="master-table"><thead><tr><th>Petugas</th><th>Jabatan</th><th>Jenis</th><th>Kelompok</th><th>Aksi</th></tr></thead><tbody>{penugasan.map(item => <tr key={item.penugasan_id}><td>{item.nama_petugas}</td><td>{item.jabatan}</td><td>{item.tipe_target}</td><td>{item.nama_target ?? `ID ${item.penugasan_id}`}</td><td><button className="danger-button" onClick={() => void removeAssignment(item.penugasan_id)}>Hapus</button></td></tr>)}</tbody></table></div>
      </section>}

      {activeTab === 'review' && <section className="master-section">
        <div className="section-heading"><div><h2>Review impor santri</h2><p>Konfirmasi kandidat nama yang mirip. Keputusan disimpan agar tidak berubah saat sinkronisasi ulang.</p></div><button className="primary-button" onClick={() => void syncReviews()} disabled={reviewLoading}>{reviewLoading ? 'Menyinkronkan...' : 'Sinkronkan 971 data review'}</button></div>
        <div className="assignment-form compact-form"><div><label>Status review</label><select value={reviewStatus} onChange={event => setReviewStatus(event.target.value)}><option value="perlu_tinjau">Perlu tinjau</option><option value="perlu_mapping_kamar">Perlu mapping kamar</option><option value="terpisah">Sudah diputuskan terpisah</option><option value="digabung">Sudah digabung</option></select></div></div>
        {!reviews.length ? <div className="empty-state">Belum ada review pada status ini. Tekan “Sinkronkan 971 data review” untuk memuat data impor awal.</div> : <div className="table-scroll"><table className="master-table review-table"><thead><tr><th>Sumber</th><th>Santri dari impor</th><th>Kode kamar</th><th>Kandidat data induk</th><th>Skor</th><th>Aksi</th></tr></thead><tbody>{reviews.map(item => <tr key={item.review_id}><td>{item.sumber_sheet}<small>Baris {item.baris_sumber}</small></td><td><strong>{item.nama_sumber}</strong><small>{item.nama_santri_otomatis ? `ID otomatis ${item.santri_otomatis_id}${item.kamar_santri_otomatis ? ` · ${item.kamar_santri_otomatis}` : ''}` : 'Belum ditemukan di data otomatis'}</small></td><td>{item.kode_kamar_sumber || '—'}</td><td>{item.nama_kandidat ? <><strong>{item.nama_kandidat}</strong><small>{item.kamar_kandidat || 'Kamar kosong'}</small></> : 'Tidak ada kandidat yang cukup mirip'}</td><td>{item.skor_kemiripan ? `${item.skor_kemiripan}%` : '—'}</td><td className="review-actions">{item.status === 'perlu_tinjau' && item.kandidat_santri_id && <><button className="primary-button" onClick={() => void mergeReview(item)}>Gabungkan</button><button className="secondary-button" onClick={() => void markSeparate(item)}>Tetap terpisah</button></>}{item.status === 'perlu_tinjau' && !item.kandidat_santri_id && <span>Perlu data tambahan</span>}{item.status !== 'perlu_tinjau' && <span>{item.status.replaceAll('_', ' ')}</span>}</td></tr>)}</tbody></table></div>}
      </section>}

      {activeTab === 'kamar' && <section className="master-section">
        <h2>Mapping kode kamar</h2><p>Hubungkan singkatan dari file sumber ke kamar resmi. Mapping akan digunakan pada impor berikutnya dan melengkapi santri otomatis yang kamarnya masih kosong.</p>
        <form className="kamar-create-form" onSubmit={createKamarAndMapping}>
          <div><label>Kode dari workbook (opsional)</label><input value={kodeKamarBaru} onChange={event => setKodeKamarBaru(event.target.value)} placeholder="Contoh: KK 201 atau 104.0" /></div>
          <div><label>Nama kamar resmi</label><input value={namaKamarBaru} onChange={event => setNamaKamarBaru(event.target.value)} placeholder="Contoh: Kamar Kiai 201" required /></div>
          <button className="primary-button">Tambah kamar & mapping</button>
        </form>
        {!mappings.length ? <div className="empty-state">Mapping akan tampil setelah review impor disinkronkan.</div> : <div className="table-scroll"><table className="master-table"><thead><tr><th>Kode dari sumber</th><th>Jumlah review</th><th>Kamar saat ini</th><th>Ubah / konfirmasi kamar</th><th>Aksi</th></tr></thead><tbody>{mappings.map(item => <tr key={item.kode_sumber}><td><strong>{item.kode_sumber}</strong></td><td>{item.jumlah_review}</td><td>{item.nama_kamar || <span className="warning-text">Belum dipetakan</span>}</td><td><select value={mappingChoices[item.kode_sumber] ?? String(item.kamar_id ?? '')} onChange={event => setMappingChoices(current => ({ ...current, [item.kode_sumber]: event.target.value }))}><option value="">Pilih kamar resmi</option>{kamar.map(room => <option key={room.kamar_id} value={room.kamar_id}>{room.nama}</option>)}</select></td><td><button className="primary-button" onClick={() => void saveMapping(item)}>Simpan mapping</button></td></tr>)}</tbody></table></div>}
      </section>}

      {activeTab === 'akun' && <section className="master-section">
        <h2>Akun petugas</h2>
        <div className="account-table-controls">
          <div className="account-search-control"><label htmlFor="account-search">Cari akun</label><input id="account-search" value={accountSearch} onChange={event => setAccountSearch(event.target.value)} placeholder="Nama, username, kelas..." /></div>
          <div><label htmlFor="account-role">Jabatan</label><select id="account-role" value={accountRole} onChange={event => setAccountRole(event.target.value)}><option value="">Semua jabatan</option>{accountRoles.map(role => <option key={role} value={role}>{role}</option>)}</select></div>
          <div><label htmlFor="account-assignment">Penugasan</label><select id="account-assignment" value={accountAssignment} onChange={event => setAccountAssignment(event.target.value)}><option value="">Semua</option><option value="ditugaskan">Ada penugasan</option><option value="belum">Belum ditugaskan</option></select></div>
          <div><label htmlFor="account-status">Status akun</label><select id="account-status" value={accountStatus} onChange={event => setAccountStatus(event.target.value)}><option value="">Semua status</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select></div>
        </div>
        <p className="account-result-count">Menampilkan {visibleAccounts.length} dari {petugas.length} akun.</p>
        <div className="table-scroll"><table className="master-table account-table"><thead><tr><th><button className="table-sort-button" onClick={() => toggleAccountSort('nama')}>Nama{accountSortIndicator('nama')}</button></th><th><button className="table-sort-button" onClick={() => toggleAccountSort('username')}>Username{accountSortIndicator('username')}</button></th><th><button className="table-sort-button" onClick={() => toggleAccountSort('jabatan')}>Jabatan{accountSortIndicator('jabatan')}</button></th><th><button className="table-sort-button" onClick={() => toggleAccountSort('tanggung_jawab_absensi')}>Tanggung Jawab Absensi{accountSortIndicator('tanggung_jawab_absensi')}</button></th><th>Aksi</th></tr></thead><tbody>{visibleAccounts.map(item => <tr key={item.petugas_id}><td>{item.nama}</td><td>{item.username}</td><td>{item.jabatan}</td><td>{item.tanggung_jawab_absensi || '-'}</td><td><button className="danger-button" onClick={() => void resetPassword(item.petugas_id)}>Reset password</button></td></tr>)}</tbody></table>{visibleAccounts.length === 0 && <div className="empty-state">Tidak ada akun yang sesuai dengan filter.</div>}</div>
      </section>}
    </div>
  );
}
