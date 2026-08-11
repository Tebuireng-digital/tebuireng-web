import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { ContentSkeleton, ValuePulse } from '../components/LoadingSkeleton';

interface TargetAbsensi {
  target_id: number;
  nama_target: string;
  tingkat?: string;
  unit_kode?: string;
  unit_nama?: string;
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

type DashboardIconName = 'users' | 'alumni' | 'warning' | 'gate' | 'assignment' | 'account' | 'arrow';

function DashboardIcon({ name }: { name: DashboardIconName }) {
  const paths: Record<DashboardIconName, ReactNode> = {
    users: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7" r="3" /><path d="M16 4.5a3 3 0 0 1 0 5.8M18 14.5a4 4 0 0 1 4 4V20" /></>,
    alumni: <><path d="m3 9 9-5 9 5-9 5-9-5Z" /><path d="M7 11.5V16c2.7 2.1 7.3 2.1 10 0v-4.5M21 10v6" /></>,
    warning: <><path d="M12 3 2.8 19h18.4L12 3Z" /><path d="M12 9v4M12 16.5h.01" /></>,
    gate: <><path d="M4 20V8l8-4 8 4v12M8 20V10h8v10M8 14h8" /></>,
    assignment: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4" /></>,
    account: <><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0 1 14 0M18 4h3v3" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  };

  return <svg className="dashboard-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}



export function DashboardPage() {
  const { user } = useAuth();
  const { jenis: routeJenis } = useParams<{ jenis?: string }>();
  const [searchParams] = useSearchParams();
  const urlJenis = routeJenis || searchParams.get('jenis') || '';

  const [expandedRosterGroup, setExpandedRosterGroup] = useState<string | null>(null);

  const { data = [], isLoading, error } = useQuery<OpsiAbsensi[]>({
    queryKey: ['absensi-options', user?.petugas_id],
    queryFn: async () => (await api.get('/api/absensi-options')).data,
  });

  const { data: santriCount, isLoading: isSantriLoading, isError: isSantriError } = useQuery<{ total: number }>({
    queryKey: ['santri-summary'],
    queryFn: async () => (await api.get('/api/master/santri/count')).data,
    enabled: user?.jabatan === 'Admin',
  });

  const { data: alumniStats, isLoading: isAlumniLoading, isError: isAlumniError } = useQuery<{ total: number }>({
    queryKey: ['alumni-summary'],
    queryFn: async () => (await api.get('/api/master/alumni/stats')).data,
    enabled: user?.jabatan === 'Admin',
  });

  const kelompokTampilan: KelompokTampilan[] = data.map(kegiatan => ({
    ...kegiatan,
    displayKey: kegiatan.jenis,
    nama: kegiatan.jenis === 'sekolah' ? 'Kelas Formal' : kegiatan.nama,
  }));

  const activeJenis = kelompokTampilan.some(item => item.displayKey === urlJenis)
    ? urlJenis
    : (kelompokTampilan[0]?.displayKey ?? '');

  useEffect(() => {
    const kegiatan = kelompokTampilan.find(item => item.displayKey === activeJenis);
    if (!kegiatan) {
      setExpandedRosterGroup(null);
      return;
    }

    let firstGroupKey = `${kegiatan.jenis}:all`;
    if (kegiatan.jenis === 'sekolah') {
      const schoolUnits = [...new Set(kegiatan.targets.map(target => (target.unit_nama || target.unit_kode || (target.tingkat ? `Tingkat ${target.tingkat}` : 'Kelas Formal')).trim()))]
        .sort((left, right) => left.localeCompare(right, 'id', { numeric: true }));
      const firstUnit = schoolUnits[0];
      if (firstUnit) firstGroupKey = `sekolah:${firstUnit}`;
    } else if (kegiatan.jenis === 'kamar') {
      const firstCategory = [...new Set(kegiatan.targets.map(target => target.kategori_target ?? 'Kamar lainnya'))]
        .sort((left, right) => left.localeCompare(right, 'id', { numeric: true }))[0];
      if (firstCategory) firstGroupKey = `kamar:${firstCategory}`;
    } else if (kegiatan.jenis === 'pbs') {
      const firstCategory = pbsCategories(kegiatan.targets)[0];
      if (firstCategory) firstGroupKey = `pbs:${firstCategory}`;
    }

    setExpandedRosterGroup(firstGroupKey);
  }, [activeJenis, data]);

  const activeActivity = kelompokTampilan.find(item => item.displayKey === activeJenis);
  const headerTitle = urlJenis && activeActivity
    ? (activeActivity.nama.startsWith('Absensi') ? activeActivity.nama : `Absensi ${activeActivity.nama}`)
    : 'Absensi Santri';

  const displayedKelompok = urlJenis && activeJenis
    ? kelompokTampilan.filter(item => item.displayKey === activeJenis)
    : kelompokTampilan;

  const toggleRosterGroup = (key: string) => {
    setExpandedRosterGroup(current => current === key ? null : key);
  };

  const targetCards = (kegiatan: KelompokTampilan, targets: TargetAbsensi[]) => {
    const sortedTargets = [...targets].sort((left, right) =>
      left.nama_target.localeCompare(right.nama_target, 'id', { numeric: true, sensitivity: 'base' })
    );
    return (
      <div className="target-grid">
        {sortedTargets.map(target => (
          <Link
            className="target-card"
            key={target.target_id}
            aria-label={`Buka absensi ${target.nama_target}`}
            to={`/absensi/${kegiatan.jenis}/${target.target_id}?jadwal=${kegiatan.jadwal[0].jadwal_id}`}
          >
            <span className="target-card-label">{target.nama_target}</span>
            <span className="target-card-action" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    );
  };

  const collapsibleTargetGroup = (
    kegiatan: KelompokTampilan,
    key: string,
    label: string,
    targets: TargetAbsensi[],
  ) => {
    const isExpanded = expandedRosterGroup === key;
    const contentId = `roster-content-${key.replace(/[^a-z0-9]+/gi, '-')}`;
    return (
      <section className="roster-category-group" key={key}>
        <button
          aria-controls={contentId}
          aria-expanded={isExpanded}
          className={`roster-category-toggle${isExpanded ? ' is-expanded' : ''}`}
          onClick={() => toggleRosterGroup(key)}
          type="button"
        >
          <span className="roster-category-label">{label}</span>
          <span className="roster-category-toggle-meta">
            <span className="roster-count-mono">{targets.length} kelompok</span>
            <span className="roster-chevron-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </span>
        </button>
        {isExpanded && <div className="roster-category-content" id={contentId}>{targetCards(kegiatan, targets)}</div>}
      </section>
    );
  };

  const isDashboardView = !urlJenis;

  usePageMeta({
    title: isDashboardView ? (user?.jabatan === 'Admin' ? 'Pusat Administrasi' : 'Beranda Utama') : headerTitle,
    description: isDashboardView
      ? 'Kelola data santri, alumni, dan operasional pesantren dari satu tempat.'
      : `Pencatatan dan pengelolaan ${headerTitle} Pondok Pesantren Tebuireng.`,
  });

  return (
    <div>
      <header className="dashboard-header">
        <div>
          <span className="page-eyebrow">Assalamu'alaikum, {user?.nama}</span>
          <h1>{isDashboardView ? (user?.jabatan === 'Admin' ? 'Pusat Administrasi' : 'Beranda Utama') : headerTitle}</h1>
          <p>
            {isDashboardView
              ? 'Kelola data santri, alumni, dan operasional pesantren dari satu tempat.'
            : 'Pilih kelompok sesuai penugasan Anda untuk mulai mencatat kehadiran.'}
          </p>
        </div>
        <div className="dashboard-mosque" aria-hidden="true"><span></span></div>
      </header>

      {isLoading && <ContentSkeleton rows={4} />}
      {error && <div className="error-box">Data tidak dapat dimuat. Periksa koneksi lalu muat ulang halaman.</div>}

      {!isLoading && !error && data.length === 0 && (
        <div className="empty-state">
          Belum ada penugasan yang diatur untuk akun ini. Hubungi Admin jika butuh akses penugasan.
        </div>
      )}



      {/* RINGKASAN DATA — hanya tampil di Beranda */}
      {isDashboardView && user?.jabatan === 'Admin' && !isLoading && !error && (
        <section className="dashboard-data-summary" aria-labelledby="dashboard-summary-title">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-section-kicker">Data pondok</span>
              <h2 id="dashboard-summary-title">Jumlah terkelola</h2>
            </div>
          </div>
          <div className="dashboard-data-summary-grid">
            <Link to="/data-master/santri" className="dashboard-data-item santri">
              <span className="dashboard-data-item-icon"><DashboardIcon name="users" /></span>
              <span className="dashboard-data-item-copy">
                <span className="dashboard-data-item-label">Data Santri</span>
                <strong className="dashboard-data-item-value">
                  {isSantriLoading ? <ValuePulse width={48} /> : isSantriError ? '—' : santriCount?.total.toLocaleString('id') ?? '—'}
                </strong>
              </span>
              <span className="dashboard-data-item-arrow"><DashboardIcon name="arrow" /></span>
            </Link>
            <Link to="/data-master/alumni" className="dashboard-data-item alumni">
              <span className="dashboard-data-item-icon"><DashboardIcon name="alumni" /></span>
              <span className="dashboard-data-item-copy">
                <span className="dashboard-data-item-label">Data Alumni</span>
                <strong className="dashboard-data-item-value">
                  {isAlumniLoading ? <ValuePulse width={48} /> : isAlumniError ? '—' : alumniStats?.total.toLocaleString('id') ?? '—'}
                </strong>
              </span>
              <span className="dashboard-data-item-arrow"><DashboardIcon name="arrow" /></span>
            </Link>
          </div>
        </section>
      )}

      {/* SHORTCUT OPERASIONAL — hanya tampil di Beranda */}
      {isDashboardView && !isLoading && !error && (
        <section className="dashboard-shortcuts" aria-labelledby="dashboard-shortcuts-title">
          <div className="dashboard-section-heading">
            <div>
              <h2 id="dashboard-shortcuts-title">Modul administrasi</h2>
            </div>
          </div>
          <div className="dashboard-shortcut-grid">
            {['Admin', 'Keamanan', 'Pembina Kamar', 'Pengasuh'].includes(user?.jabatan ?? '') && (
              <Link to="/pelanggaran/semua" className="dashboard-shortcut warning">
                <span className="dashboard-shortcut-icon"><DashboardIcon name="warning" /></span>
                <span className="dashboard-shortcut-copy">
                  <span className="dashboard-shortcut-title">Daftar Pelanggaran</span>
                  <span className="dashboard-shortcut-description">Tinjau catatan pelanggaran santri</span>
                </span>
                <span className="dashboard-shortcut-arrow"><DashboardIcon name="arrow" /></span>
              </Link>
            )}
            {['Admin', 'Keamanan', 'Pengasuh'].includes(user?.jabatan ?? '') && (
              <Link to="/perizinan/semua" className="dashboard-shortcut gate">
                <span className="dashboard-shortcut-icon"><DashboardIcon name="gate" /></span>
                <span className="dashboard-shortcut-copy">
                  <span className="dashboard-shortcut-title">Daftar Perizinan</span>
                  <span className="dashboard-shortcut-description">Pantau izin keluar dan status gerbang</span>
                </span>
                <span className="dashboard-shortcut-arrow"><DashboardIcon name="arrow" /></span>
              </Link>
            )}
            {user?.jabatan === 'Admin' && (
              <Link to="/data-master/penugasan" className="dashboard-shortcut assignment">
                <span className="dashboard-shortcut-icon"><DashboardIcon name="assignment" /></span>
                <span className="dashboard-shortcut-copy">
                  <span className="dashboard-shortcut-title">Penugasan Absensi</span>
                  <span className="dashboard-shortcut-description">Atur tanggung jawab kelompok petugas</span>
                </span>
                <span className="dashboard-shortcut-arrow"><DashboardIcon name="arrow" /></span>
              </Link>
            )}
            {user?.jabatan === 'Admin' && (
              <Link to="/data-master/akun" className="dashboard-shortcut account">
                <span className="dashboard-shortcut-icon"><DashboardIcon name="account" /></span>
                <span className="dashboard-shortcut-copy">
                  <span className="dashboard-shortcut-title">Akun Petugas</span>
                  <span className="dashboard-shortcut-description">Kelola akun dan akses operasional</span>
                </span>
                <span className="dashboard-shortcut-arrow"><DashboardIcon name="arrow" /></span>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ROSTER ABSENSI TARGETS — hanya tampil saat membuka menu absensi */}
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
                  <h2>
                    {kegiatan.jadwal[0]
                      ? `Waktu Absensi: ${kegiatan.jadwal[0].jam_mulai.slice(0, 5)} – ${kegiatan.jadwal[0].jam_selesai.slice(0, 5)} WIB`
                      : 'Waktu Absensi Belum Diatur'}
                  </h2>
                </div>
              </div>

              {kegiatan.jadwal.length === 0 ? (
                <div className="warning-box">Jadwal belum diatur oleh Admin.</div>
              ) : kegiatan.jenis === 'sekolah' ? (
                <div className="roster-category-groups">
                  {[...new Set(kegiatan.targets.map(target => (target.unit_nama || target.unit_kode || (target.tingkat ? `Tingkat ${target.tingkat}` : 'Kelas Formal')).trim()))]
                    .sort((left, right) => left.localeCompare(right, 'id', { numeric: true }))
                    .map(unitName => {
                      const targets = kegiatan.targets.filter(target => (target.unit_nama || target.unit_kode || (target.tingkat ? `Tingkat ${target.tingkat}` : 'Kelas Formal')).trim() === unitName);
                      if (targets.length === 0) return null;
                      return collapsibleTargetGroup(kegiatan, `sekolah:${unitName}`, unitName, targets);
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
                <div className="roster-category-groups">
                  {collapsibleTargetGroup(kegiatan, `${kegiatan.jenis}:all`, 'Kelompok absensi', kegiatan.targets)}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
