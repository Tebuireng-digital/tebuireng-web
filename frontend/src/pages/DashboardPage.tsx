import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

interface TargetAbsensi {
  target_id: number;
  nama_target: string;
}

interface JadwalAbsensi {
  jadwal_id: number;
  nama_jadwal: string;
  jam_mulai: string;
  jam_selesai: string;
}

interface OpsiAbsensi {
  jenis: string;
  nama: string;
  sumber: string;
  targets: TargetAbsensi[];
  jadwal: JadwalAbsensi[];
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data = [], isLoading, error } = useQuery<OpsiAbsensi[]>({
    queryKey: ['absensi-options', user?.petugas_id],
    queryFn: async () => (await api.get('/api/absensi-options')).data,
  });

  return (
    <div>
      <header className="dashboard-header">
        <h1>Absensi Santri</h1>
        <p>Pilih kelompok sesuai penugasan Anda. Daftar yang tampil berasal dari data master.</p>
      </header>

      {isLoading && <div className="empty-state">Memuat penugasan absensi...</div>}
      {error && <div className="error-box">Penugasan tidak dapat dimuat. Periksa koneksi lalu muat ulang halaman.</div>}

      {!isLoading && !error && data.length === 0 && (
        <div className="empty-state">
          Belum ada kelompok absensi yang ditugaskan kepada akun ini. Hubungi Admin untuk mengatur penugasan.
        </div>
      )}

      <div className="attendance-groups">
        {data.map(kegiatan => (
          <section className="attendance-group" key={kegiatan.jenis}>
            <div className="attendance-group-heading">
              <div>
                <h2>{kegiatan.nama}</h2>
                <p>{kegiatan.sumber}</p>
              </div>
              {kegiatan.jadwal[0] && (
                <span className="schedule-label">
                  {kegiatan.jadwal[0].jam_mulai.slice(0, 5)}–{kegiatan.jadwal[0].jam_selesai.slice(0, 5)}
                </span>
              )}
            </div>

            {kegiatan.jadwal.length === 0 ? (
              <div className="warning-box">Jadwal belum diatur oleh Admin.</div>
            ) : (
              <div className="target-grid">
                {kegiatan.targets.map(target => (
                  <Link
                    className="target-card"
                    key={target.target_id}
                    to={`/absensi/${kegiatan.jenis}/${target.target_id}?jadwal=${kegiatan.jadwal[0].jadwal_id}`}
                  >
                    <span>{target.nama_target}</span>
                    <small>{kegiatan.jadwal[0].nama_jadwal}</small>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
