import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
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
  const [selectedJenis, setSelectedJenis] = useState('');
  const [collapsedRosterGroups, setCollapsedRosterGroups] = useState<Set<string>>(() => new Set());
  const { data = [], isLoading, error } = useQuery<OpsiAbsensi[]>({
    queryKey: ['absensi-options', user?.petugas_id],
    queryFn: async () => (await api.get('/api/absensi-options')).data,
  });
  const kelompokTampilan: KelompokTampilan[] = data.map(kegiatan => ({
    ...kegiatan,
    displayKey: kegiatan.jenis,
    nama: kegiatan.jenis === 'sekolah' ? 'Kelas Formal' : kegiatan.nama,
  }));
  const activeJenis = kelompokTampilan.some(item => item.displayKey === selectedJenis)
    ? selectedJenis
    : (kelompokTampilan[0]?.displayKey ?? '');

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

  return (
    <div>
      <header className="dashboard-header">
        <div>
          <span className="page-eyebrow">Assalamu'alaikum, {user?.nama}</span>
          <h1>Absensi Santri</h1>
          <p>Pilih kelompok sesuai penugasan Anda untuk mulai mencatat kehadiran.</p>
        </div>
        <div className="dashboard-mosque" aria-hidden="true"><span></span></div>
      </header>

      {isLoading && <div className="empty-state">Memuat penugasan absensi...</div>}
      {error && <div className="error-box">Penugasan tidak dapat dimuat. Periksa koneksi lalu muat ulang halaman.</div>}

      {!isLoading && !error && data.length === 0 && (
        <div className="empty-state">
          Belum ada kelompok absensi yang ditugaskan kepada akun ini. Hubungi Admin untuk mengatur penugasan.
        </div>
      )}

      {kelompokTampilan.length > 1 && (
        <nav className="dashboard-activity-tabs" aria-label="Pilih kegiatan absensi" role="tablist">
          {kelompokTampilan.map(kegiatan => (
            <button
              aria-selected={activeJenis === kegiatan.displayKey}
              className={activeJenis === kegiatan.displayKey ? 'active' : ''}
              key={kegiatan.displayKey}
              onClick={() => setSelectedJenis(kegiatan.displayKey)}
              role="tab"
              type="button"
            >
              <span>{kegiatan.nama}</span>
              <small>{kegiatan.targets.length}</small>
            </button>
          ))}
        </nav>
      )}

      <div className="attendance-groups">
        {kelompokTampilan.map(kegiatan => (
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
    </div>
  );
}
