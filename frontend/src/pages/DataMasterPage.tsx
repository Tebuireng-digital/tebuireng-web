import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

interface Petugas { petugas_id: number; nama: string; username: string; jabatan: string; status_aktif: boolean }
interface Opsi { jenis: string; nama: string; targets: Array<{ target_id: number; nama_target: string }> }
interface Penugasan { penugasan_id: number; nama_petugas: string; jabatan: string; tipe_target: string; nama_target: string }

const roleForJenis: Record<string, string> = {
  sekolah: 'Wali Kelas', kamar: 'Pembina Kamar', pbs: 'Ustadz', diniyah: 'Ustadz', pbm: 'Ustadz',
};

export function DataMasterPage() {
  const [petugas, setPetugas] = useState<Petugas[]>([]);
  const [opsi, setOpsi] = useState<Opsi[]>([]);
  const [penugasan, setPenugasan] = useState<Penugasan[]>([]);
  const [jenis, setJenis] = useState('sekolah');
  const [petugasId, setPetugasId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [passwordBaru, setPasswordBaru] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [petugasResponse, opsiResponse, penugasanResponse] = await Promise.all([
      api.get('/api/master/petugas'), api.get('/api/absensi-options'), api.get('/api/master/penugasan'),
    ]);
    setPetugas(petugasResponse.data);
    setOpsi(opsiResponse.data);
    setPenugasan(penugasanResponse.data);
  };

  useEffect(() => {
    fetchData().catch(() => setMessage('Data master gagal dimuat.')).finally(() => setLoading(false));
  }, []);

  const selectedOption = opsi.find(item => item.jenis === jenis);
  const eligiblePetugas = useMemo(
    () => petugas.filter(item => item.status_aktif && item.jabatan === roleForJenis[jenis]),
    [petugas, jenis],
  );

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

  if (loading) return <div className="empty-state">Memuat data master...</div>;

  return (
    <div className="master-page">
      <header className="dashboard-header"><h1>Data Master</h1><p>Kelola penugasan pembina untuk setiap kegiatan absensi.</p></header>
      {message && <div className="warning-box" style={{ marginBottom: 16 }}>{message}</div>}
      {passwordBaru && <div className="password-result">Password baru: <strong>{passwordBaru}</strong><button onClick={() => { void navigator.clipboard.writeText(passwordBaru); setPasswordBaru(''); }}>Salin & tutup</button></div>}

      <section className="master-section">
        <h2>Tambah penugasan absensi</h2>
        <form className="assignment-form" onSubmit={saveAssignment}>
          <div><label>Kegiatan</label><select value={jenis} onChange={event => setJenis(event.target.value)}>{opsi.map(item => <option key={item.jenis} value={item.jenis}>{item.nama}</option>)}</select></div>
          <div><label>Petugas ({roleForJenis[jenis]})</label><select value={petugasId} onChange={event => setPetugasId(event.target.value)} required>{eligiblePetugas.map(item => <option key={item.petugas_id} value={item.petugas_id}>{item.nama}</option>)}</select></div>
          <div><label>Kelompok</label><select value={targetId} onChange={event => setTargetId(event.target.value)} required>{selectedOption?.targets.map(target => <option key={target.target_id} value={target.target_id}>{target.nama_target}</option>)}</select></div>
          <button className="primary-button" disabled={!petugasId || !targetId}>Simpan penugasan</button>
        </form>
        {eligiblePetugas.length === 0 && <div className="warning-box">Belum ada petugas aktif dengan jabatan {roleForJenis[jenis]}.</div>}

        <div className="table-scroll"><table className="master-table"><thead><tr><th>Petugas</th><th>Jabatan</th><th>Jenis</th><th>Kelompok</th><th>Aksi</th></tr></thead><tbody>{penugasan.map(item => <tr key={item.penugasan_id}><td>{item.nama_petugas}</td><td>{item.jabatan}</td><td>{item.tipe_target}</td><td>{item.nama_target ?? `ID ${item.penugasan_id}`}</td><td><button className="danger-button" onClick={() => void removeAssignment(item.penugasan_id)}>Hapus</button></td></tr>)}</tbody></table></div>
      </section>

      <section className="master-section">
        <h2>Akun petugas</h2>
        <div className="table-scroll"><table className="master-table"><thead><tr><th>Nama</th><th>Username</th><th>Jabatan</th><th>Aksi</th></tr></thead><tbody>{petugas.map(item => <tr key={item.petugas_id}><td>{item.nama}</td><td>{item.username}</td><td>{item.jabatan}</td><td><button className="danger-button" onClick={() => void resetPassword(item.petugas_id)}>Reset password</button></td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}
