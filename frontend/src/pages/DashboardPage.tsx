import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

interface TargetAbsensi {
  target_id: number;
  nama_target: string;
  tingkat?: string;
  kategori_target?: string;
  nomor_target?: string | null;
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

interface KelompokTampilan extends OpsiAbsensi {
  displayKey: string;
}

const PBS_CATEGORY_ORDER = ['KELOMPOK A', 'KELOMPOK B', 'KELOMPOK C', 'BANDONGAN', 'TAHSIN', 'TAHFIDZ', 'SOROGAN'];

const pbsDisplayCategory = (target: TargetAbsensi) => {
  const sourceCategory = (target.kategori_target ?? '').trim().toUpperCase();
  if (['KELOMPOK A', 'KELOMPOK B', 'KELOMPOK C'].includes(sourceCategory)) {
    return sourceCategory;
  }

  const name = target.nama_target.trim().toUpperCase();
  for (const category of ['BANDONGAN', 'TAHSIN', 'TAHFIDZ', 'SOROGAN']) {
    if (name.startsWith(category)) return category;
  }

  return sourceCategory || 'LAINNYA';
};

const pbsCategories = (targets: TargetAbsensi[]) => [...new Set(targets.map(pbsDisplayCategory))]
  .sort((left, right) => {
    const leftOrder = PBS_CATEGORY_ORDER.indexOf(left);
    const rightOrder = PBS_CATEGORY_ORDER.indexOf(right);
    if (leftOrder !== -1 || rightOrder !== -1) {
      return (leftOrder === -1 ? Number.MAX_SAFE_INTEGER : leftOrder)
        - (rightOrder === -1 ? Number.MAX_SAFE_INTEGER : rightOrder);
    }
    return left.localeCompare(right, 'id');
  });

export function DashboardPage() {
  const { user } = useAuth();
  const { jenis: routeJenis } = useParams<{ jenis?: string }>();
  const [searchParams] = useSearchParams();
  const urlJenis = routeJenis || searchParams.get('jenis') || '';

  const [collapsedRosterGroups, setCollapsedRosterGroups] = useState<Set<string>>(() => new Set());

  const { data = [], isLoading, error } = useQuery<OpsiAbsensi[]>({
    queryKey: ['absensi-options', user?.petugas_id],
    queryFn: async () => (await api.get('/api/absensi-options')).data,
  });

  const { data: pelanggaranData = [] } = useQuery<any[]>({
    queryKey: ['pelanggaran-summary'],
    queryFn: async () => (await api.get('/api/pelanggaran')).data,
    enabled: ['Admin', 'Keamanan', 'Pembina Kamar', 'Pengasuh'].includes(user?.jabatan ?? ''),
  });

  const { data: perizinanData = [] } = useQuery<any[]>({
    queryKey: ['perizinan-summary'],
    queryFn: async () => (await api.get('/api/perizinan')).data,
    enabled: ['Admin', 'Keamanan', 'Pengasuh'].includes(user?.jabatan ?? ''),
  });

  const kelompokTampilan: KelompokTampilan[] = data.map(kegiatan => ({
    ...kegiatan,
    displayKey: kegiatan.jenis,
    nama: kegiatan.jenis === 'sekolah' ? 'Kelas Formal' : kegiatan.nama,
  }));

  const activeJenis = kelompokTampilan.some(item => item.displayKey === urlJenis)
    ? urlJenis
    : (kelompokTampilan[0]?.displayKey ?? '');

  const activeActivity = kelompokTampilan.find(item => item.displayKey === activeJenis);
  const headerTitle = urlJenis && activeActivity
    ? (activeActivity.nama.startsWith('Absensi') ? activeActivity.nama : `Absensi ${activeActivity.nama}`)
    : 'Absensi Santri';

  const displayedKelompok = urlJenis && activeJenis
    ? kelompokTampilan.filter(item => item.displayKey === activeJenis)
    : kelompokTampilan;

  const toggleRosterGroup = (key: string) => {
    setCollapsedRosterGroups(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const targetCards = (kegiatan: KelompokTampilan, targets: TargetAbsensi[]) => (
    <div className="target-grid">
      {targets.map(target => (
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
  );

  const collapsibleTargetGroup = (
    kegiatan: KelompokTampilan,
    key: string,
    label: string,
    targets: TargetAbsensi[],
  ) => {
    const isCollapsed = collapsedRosterGroups.has(key);
    return (
      <section className="roster-category-group" key={key}>
        <button
          aria-expanded={!isCollapsed}
          className="roster-category-toggle"
          onClick={() => toggleRosterGroup(key)}
          type="button"
        >
          <span>{label}</span>
          <span className="roster-category-toggle-meta"><small>{targets.length}</small><span aria-hidden="true">{isCollapsed ? '⌄' : '⌃'}</span></span>
        </button>
        {!isCollapsed && <div className="roster-category-content">{targetCards(kegiatan, targets)}</div>}
      </section>
    );
  };

  const isDashboardView = !urlJenis;

  return (
    <div>
      <header className="dashboard-header">
        <div>
          <span className="page-eyebrow">Assalamu'alaikum, {user?.nama}</span>
          <h1>{isDashboardView ? 'Beranda Utama' : headerTitle}</h1>
          <p>
            {isDashboardView
              ? 'Selamat datang di Sistem Kepesantrenan Pesantren Tebuireng.'
              : 'Pilih kelompok sesuai penugasan Anda untuk mulai mencatat kehadiran.'}
          </p>
        </div>
        <div className="dashboard-mosque" aria-hidden="true"><span></span></div>
      </header>

      {isLoading && <div className="empty-state">Memuat data beranda...</div>}
      {error && <div className="error-box">Data tidak dapat dimuat. Periksa koneksi lalu muat ulang halaman.</div>}

      {!isLoading && !error && data.length === 0 && (
        <div className="empty-state">
          Belum ada penugasan yang diatur untuk akun ini. Hubungi Admin jika butuh akses penugasan.
        </div>
      )}

      {/* OVERVIEW STAT CARDS GRID */}
      {isDashboardView && !isLoading && !error && (
        <div className="dashboard-grid-premium" style={{ marginBottom: 28 }}>
          {user?.jabatan === 'Admin' && (
            <Link to="/data-master/santri" className="stat-card" style={{ textDecoration: 'none' }}>
              <span className="stat-card-value" style={{ color: '#10b981' }}>5.369</span>
              <span className="stat-card-label">Data Santri</span>
              <small style={{ color: '#059669', fontWeight: 600, marginTop: 4 }}>👥 Kelola Santri →</small>
            </Link>
          )}

          {kelompokTampilan.map(kegiatan => (
            <Link
              key={kegiatan.displayKey}
              to={`/absensi-kegiatan/${kegiatan.displayKey}`}
              className={`stat-card${activeJenis === kegiatan.displayKey && !isDashboardView ? ' active-stat-card' : ''}`}
              style={{ textDecoration: 'none' }}
            >
              <span className="stat-card-value">{kegiatan.targets.length}</span>
              <span className="stat-card-label">{kegiatan.nama}</span>
              {kegiatan.jadwal[0] && (
                <small style={{ color: 'var(--aksen-gelap)', fontWeight: 600, marginTop: 4 }}>
                  ⏱️ {kegiatan.jadwal[0].jam_mulai.slice(0, 5)}–{kegiatan.jadwal[0].jam_selesai.slice(0, 5)} →
                </small>
              )}
            </Link>
          ))}

          {['Admin', 'Keamanan', 'Pembina Kamar', 'Pengasuh'].includes(user?.jabatan ?? '') && (
            <Link to="/pelanggaran/semua" className="stat-card" style={{ textDecoration: 'none' }}>
              <span className="stat-card-value" style={{ color: '#ef4444' }}>
                {pelanggaranData.length}
              </span>
              <span className="stat-card-label">Pelanggaran</span>
              <small style={{ color: '#ef4444', fontWeight: 600, marginTop: 4 }}>⚠️ Lihat Rekap →</small>
            </Link>
          )}

          {['Admin', 'Keamanan'].includes(user?.jabatan ?? '') && (
            <Link to="/catat-gerbang" className="stat-card" style={{ textDecoration: 'none' }}>
              <span className="stat-card-value" style={{ color: '#0284c7' }}>
                {perizinanData.length}
              </span>
              <span className="stat-card-label">Perizinan & Gerbang</span>
              <small style={{ color: '#0284c7', fontWeight: 600, marginTop: 4 }}>🚪 Catat Gerbang →</small>
            </Link>
          )}
        </div>
      )}

      {/* DASHBOARD PINTASAN APLIKASI (HANYA DITAMPILKAN DI /dashboard UTAMA) */}
      {isDashboardView && !isLoading && !error && (
        <section className="master-section">
          <h2>Pintasan & Akses Cepat Modul</h2>
          <p style={{ color: '#64748b', marginBottom: 20 }}>Akses langsung ke fitur dan layanan kepesantrenan Tebuireng.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {['Admin', 'Keamanan', 'Pembina Kamar'].includes(user?.jabatan ?? '') && (
              <Link to="/pelanggaran/baru" className="target-card" style={{ textDecoration: 'none', borderLeft: '4px solid #ef4444' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>⚠️ Input Pelanggaran</span>
                <small style={{ color: '#64748b' }}>Catat poin sanksi / pelanggaran santri</small>
              </Link>
            )}
            <Link to="/pelanggaran/semua" className="target-card" style={{ textDecoration: 'none', borderLeft: '4px solid #f59e0b' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>📋 Rekap Pelanggaran</span>
              <small style={{ color: '#64748b' }}>Lihat seluruh daftar riwayat pelanggaran</small>
            </Link>

            {['Admin', 'Keamanan'].includes(user?.jabatan ?? '') && (
              <Link to="/catat-gerbang" className="target-card" style={{ textDecoration: 'none', borderLeft: '4px solid #0284c7' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>🚪 Perizinan & Gerbang</span>
                <small style={{ color: '#64748b' }}>Catat kepulangan dan santri di luar komplek</small>
              </Link>
            )}

            {user?.jabatan === 'Admin' && (
              <Link to="/data-master/santri" className="target-card" style={{ textDecoration: 'none', borderLeft: '4px solid #10b981' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>📦 Data Master Santri</span>
                <small style={{ color: '#64748b' }}>Kelola 5.369 data santri, penugasan & akun</small>
              </Link>
            )}

            {['Admin', 'Pengasuh'].includes(user?.jabatan ?? '') && (
              <Link to="/laporan/detail" className="target-card" style={{ textDecoration: 'none', borderLeft: '4px solid #8b5cf6' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>📊 Laporan Detail</span>
                <small style={{ color: '#64748b' }}>Laporan rekapitulasi kepesantrenan</small>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* RENDER ROSTER ABSENSI TARGETS (HANYA DITAMPILKAN SAAT MEMBUKA SALAH SATU MENU ABSENSI /absensi-kegiatan/:jenis) */}
      {!isDashboardView && (
        <div className="attendance-groups">
          {displayedKelompok.map(kegiatan => (
            <section
              className={`attendance-group${activeJenis === kegiatan.displayKey ? ' mobile-active' : ''}`}
              key={kegiatan.displayKey}
              role="tabpanel"
            >
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
              ) : kegiatan.jenis === 'sekolah' ? (
                <div className="roster-category-groups">
                  {['7', '8', '9'].map(grade => {
                    const targets = kegiatan.targets.filter(target => String(target.tingkat) === grade);
                    if (targets.length === 0) return null;
                    return collapsibleTargetGroup(kegiatan, `sekolah:${grade}`, `Kelas ${grade}`, targets);
                  })}
                </div>
              ) : kegiatan.jenis === 'kamar' ? (
                <div className="roster-category-groups">
                  {[...new Set(kegiatan.targets.map(target => target.kategori_target ?? 'Kamar lainnya'))]
                    .sort((left, right) => left.localeCompare(right, 'id', { numeric: true }))
                    .map(category => collapsibleTargetGroup(
                      kegiatan,
                      `kamar:${category}`,
                      category,
                      kegiatan.targets.filter(target => (target.kategori_target ?? 'Kamar lainnya') === category),
                    ))}
                </div>
              ) : kegiatan.jenis === 'pbs' ? (
                <div className="roster-category-groups">
                  {pbsCategories(kegiatan.targets).map(category => collapsibleTargetGroup(
                    kegiatan,
                    `pbs:${category}`,
                    category,
                    kegiatan.targets.filter(target => pbsDisplayCategory(target) === category),
                  ))}
                </div>
              ) : (
                targetCards(kegiatan, kegiatan.targets)
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
