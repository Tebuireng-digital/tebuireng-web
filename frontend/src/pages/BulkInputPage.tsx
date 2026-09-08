import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { usePageMeta } from '../hooks/usePageMeta';

export type StatusAbsensi = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpha';

interface SantriAbsensi {
  santri_id: number;
  nis: string | null;
  no_id_induk?: string | null;
  nama: string;
  status: StatusAbsensi | null;
  menit_terlambat: number | null;
  keterangan: string | null;
  waktu_input?: string | null;
}

interface SesiAbsensi {
  nama_kegiatan: string;
  target: { target_id: number; nama_target: string; nama_penanggung_jawab: string | null };
  jadwal: { jadwal_id: number; nama_jadwal: string; jam_mulai: string; jam_selesai: string };
  tanggal: string;
  santri: SantriAbsensi[];
}

interface DraftItem {
  status: StatusAbsensi;
  keterangan?: string;
}

type SaveModal = { type: 'success' | 'error'; title: string; message: string };

const STATUS_OPTIONS: StatusAbsensi[] = ['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpha'];

const SUBMENU_MAP: Record<string, { nama: string; route: string }> = {
  sekolah: { nama: 'Absensi Kelas Formal', route: '/absensi-kegiatan/sekolah' },
  keberangkatan: { nama: 'Keberangkatan Kelas', route: '/absensi-kegiatan/keberangkatan' },
  kamar: { nama: 'Absensi Kamar', route: '/absensi-kegiatan/kamar' },
  pbs: { nama: "Al-Qur'an Subuh", route: '/absensi-kegiatan/pbs' },
  diniyah: { nama: 'Kelas Madin', route: '/absensi-kegiatan/diniyah' },
  pbm: { nama: 'Takhasus Maghrib', route: '/absensi-kegiatan/pbm' },
};

const todayJakarta = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

function BlueCheckbox({
  checked,
  disabled,
  onClick,
  ariaLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      disabled={disabled}
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`attendance-blue-checkbox ${checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''}`}
    >
      {checked && (
        <svg
          className="attendance-check-icon"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="4 10.5 8 14.5 16 5.5" />
        </svg>
      )}
    </button>
  );
}

export function BulkInputPage() {
  const { jenis = '', id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const jadwalId = Number(searchParams.get('jadwal'));
  const targetId = Number(id);
  const tanggal = useMemo(() => todayJakarta(), []);
  const tanggalLabel = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [isAbsensiStarted, setIsAbsensiStarted] = useState(false);
  const [activeNoteEditingId, setActiveNoteEditingId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [syncState, setSyncState] = useState<'tersinkron' | 'menyinkronkan' | 'error'>('tersinkron');
  const [syncError, setSyncError] = useState('');
  const [drafts, setDrafts] = useState<Record<number, DraftItem>>({});
  const [saveModal, setSaveModal] = useState<SaveModal | null>(null);

  const draftStorageKey = `simanteb_attendance_draft_${jenis}_${targetId}_${jadwalId}_${tanggal}`;

  // Restore draft if user previously clicked Mulai Absensi and left the page
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (raw) {
        const item = JSON.parse(raw);
        if (item && item.expiresAt && Date.now() < item.expiresAt) {
          if (item.drafts && Object.keys(item.drafts).length > 0) {
            setDrafts(item.drafts);
          }
          setIsAbsensiStarted(true);
        } else {
          localStorage.removeItem(draftStorageKey);
        }
      }
    } catch {}
  }, [draftStorageKey]);

  const sessionQuery = useQuery<SesiAbsensi>({
    queryKey: ['absensi-session', jenis, targetId, jadwalId, tanggal],
    enabled: Boolean(jenis && targetId && jadwalId),
    queryFn: async () => (await api.get(`/api/absensi/${jenis}/session`, {
      params: { target_id: targetId, jadwal_id: jadwalId, tanggal },
    })).data,
  });

  const sessionData = sessionQuery.data;

  // Silently auto-save draft in background when absensi is in progress
  useEffect(() => {
    if (!isAbsensiStarted || !sessionData) return;
    try {
      const totalFilled = Object.keys(drafts).length;
      const payload = {
        jenis,
        targetId,
        jadwalId,
        namaTarget: sessionData.target.nama_target,
        namaJadwal: sessionData.jadwal.nama_jadwal,
        tanggal,
        tanggalLabel,
        updatedAt: Date.now(),
        expiresAt: Date.now() + 12 * 60 * 60 * 1000, // Expire after 12 hours
        totalFilled,
        drafts,
      };
      localStorage.setItem(draftStorageKey, JSON.stringify(payload));
    } catch {}
  }, [drafts, isAbsensiStarted, sessionData, jenis, targetId, jadwalId, tanggal, tanggalLabel, draftStorageKey]);

  usePageMeta({
    title: sessionData ? `Absensi ${sessionData.nama_kegiatan} - ${sessionData.target.nama_target}` : 'Input Absensi Santri',
    description: sessionData
      ? `Formulir pencatatan absensi ${sessionData.nama_kegiatan} untuk ${sessionData.target.nama_target} jadwal ${sessionData.jadwal.nama_jadwal}.`
      : 'Formulir pencatatan absensi santri Pondok Pesantren Tebuireng.',
  });

  const subMenuInfo = SUBMENU_MAP[jenis] || { nama: sessionData?.nama_kegiatan || 'Menu Absensi', route: `/absensi-kegiatan/${jenis}` };

  const handleSelectStatus = (santri: SantriAbsensi, status: StatusAbsensi) => {
    if (!isAbsensiStarted) return;
    setDrafts(current => ({
      ...current,
      [santri.santri_id]: {
        status,
        keterangan: current[santri.santri_id]?.keterangan ?? santri.keterangan ?? '',
      },
    }));
  };

  const handleNoteChange = (santri: SantriAbsensi, note: string) => {
    if (!isAbsensiStarted) return;
    setDrafts(current => ({
      ...current,
      [santri.santri_id]: {
        status: current[santri.santri_id]?.status ?? santri.status ?? 'Hadir',
        keterangan: note,
      },
    }));
  };

  const handleCancelAttendance = () => {
    setIsAbsensiStarted(false);
    setDrafts({});
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {}
  };

  const handleSave = async () => {
    if (!sessionQuery.data) return;
    setSaveModal(null);

    // Validasi: Status Hadir - Alpha wajib terisi untuk seluruh santri
    const unselectedSantri = sessionQuery.data.santri.filter(s => {
      const current = drafts[s.santri_id]?.status ?? s.status;
      return !current;
    });

    if (unselectedSantri.length > 0) {
      setSyncError(`Ada ${unselectedSantri.length} santri yang belum dipilih status absensinya. Status Hadir s/d Alpha wajib diisi.`);
      setSyncState('error');
      return;
    }

    try {
      setSyncState('menyinkronkan');
      setSyncError('');
      await api.post(`/api/absensi/${jenis}/bulk`, {
        target_id: targetId,
        jadwal_id: jadwalId,
        tanggal,
        absensi: sessionQuery.data.santri.map(santri => {
          const draft = drafts[santri.santri_id];
          const note = draft?.keterangan !== undefined ? draft.keterangan : (santri.keterangan ?? '');
          return {
            santri_id: santri.santri_id,
            status: draft?.status ?? santri.status ?? 'Hadir',
            menit_terlambat: null,
            keterangan: note.trim() || null,
          };
        }),
      });
      setDrafts({});
      try {
        localStorage.removeItem(draftStorageKey);
      } catch {}
      setSyncState('tersinkron');
      await queryClient.invalidateQueries({ queryKey: ['absensi-session', jenis, targetId, jadwalId, tanggal] });
      setSaveModal({ type: 'success', title: 'Absensi Berhasil Disimpan', message: 'Seluruh data absensi telah tersinkronisasi ke server pusat.' });
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message
        || 'Server tidak dapat menyimpan absensi. Periksa koneksi lalu coba lagi.';
      setSyncError(message);
      setSyncState('error');
      setSaveModal({
        type: 'error',
        title: 'Gagal Menyimpan Absensi',
        message,
      });
    }
  };

  // Filter santri list based on search keyword
  const filteredSantri = useMemo(() => {
    if (!sessionData?.santri) return [];
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return sessionData.santri;
    return sessionData.santri.filter(s => {
      const nomorInduk = s.no_id_induk || s.nis || '';
      return s.nama.toLowerCase().includes(keyword) || nomorInduk.toLowerCase().includes(keyword);
    });
  }, [sessionData?.santri, searchKeyword]);

  // Real-time status counts
  const statusCounts = useMemo(() => {
    const counts = { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpha: 0, Total: 0 };
    if (!sessionData?.santri) return counts;
    counts.Total = sessionData.santri.length;
    sessionData.santri.forEach(s => {
      const current = drafts[s.santri_id]?.status ?? s.status ?? 'Hadir';
      if (counts[current] !== undefined) {
        counts[current]++;
      }
    });
    return counts;
  }, [sessionData?.santri, drafts]);

  if (!jadwalId || !targetId) {
    return (
      <div className="attendance-page-wrapper">
        <div className="error-box">
          Jadwal atau kelompok tidak valid.{' '}
          <Link to={subMenuInfo.route} className="ui-link">Kembali ke Menu</Link>
        </div>
      </div>
    );
  }
  if (sessionQuery.isLoading) return <PageSkeleton rows={10} />;
  if (sessionQuery.error || !sessionQuery.data) {
    return (
      <div className="attendance-page-wrapper">
        <div className="error-box">
          Daftar absensi tidak dapat dimuat. Pastikan akun Anda memiliki penugasan yang sesuai.{' '}
          <Link to={subMenuInfo.route} className="ui-link">Kembali ke Menu</Link>
        </div>
      </div>
    );
  }

  const session = sessionQuery.data;

  return (
    <div className="attendance-page-wrapper attendance-focus-wrapper">
      {/* Dedicated Attendance Focus Header */}
      <header className="attendance-focus-topbar">
        <div className="focus-topbar-left">
          <Link
            to={subMenuInfo.route}
            className="attendance-focus-back-btn"
            title="Kembali ke Menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Kembali ke Menu</span>
          </Link>
        </div>

        <div className="focus-topbar-center">
          <h1 className="focus-target-title">{session.target.nama_target}</h1>
          <div className="focus-target-sub">
            <span>Sesi: <strong>{session.jadwal.nama_jadwal}</strong> ({session.jadwal.jam_mulai.slice(0, 5)} - {session.jadwal.jam_selesai.slice(0, 5)} WIB)</span>
            {session.target.nama_penanggung_jawab && (
              <span> · PJ: <strong>{session.target.nama_penanggung_jawab}</strong></span>
            )}
          </div>
        </div>

        <div className="focus-topbar-right">
          <div className="attendance-date-display" title="Tanggal absensi otomatis hari ini">
            <span>{tanggalLabel}</span>
          </div>
        </div>
      </header>

      {syncState === 'error' && <div className="error-box" role="alert">{syncError}</div>}

      {/* Search Toolbar */}
      <div className="attendance-toolbar focus-toolbar">
        <div className="attendance-search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Cari nama santri atau nomor induk pondok..."
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
          />
          {searchKeyword && (
            <button type="button" className="clear-search-btn" onClick={() => setSearchKeyword('')}>✕</button>
          )}
        </div>

        <div className="toolbar-right-actions">
          <div className="attendance-count-indicator">
            Menampilkan <strong>{filteredSantri.length}</strong> dari <strong>{session.santri.length}</strong> santri
          </div>

          {!isAbsensiStarted ? (
            <button
              type="button"
              className="attendance-toggle-mode-btn is-start"
              onClick={() => setIsAbsensiStarted(true)}
              title="Buka akses pengisian absensi"
            >
              Mulai Absensi
            </button>
          ) : (
            <button
              type="button"
              className="attendance-toggle-mode-btn is-cancel"
              onClick={handleCancelAttendance}
              title="Batalkan pengisian dan buang draft"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Batal Absen
            </button>
          )}

          <button
            type="button"
            disabled={!isAbsensiStarted || session.santri.length === 0 || syncState === 'menyinkronkan'}
            className="attendance-save-btn"
            onClick={() => void handleSave()}
            title={isAbsensiStarted ? "Simpan data absensi ke server pusat" : "Klik 'Mulai Absensi' terlebih dahulu"}
          >
            {syncState === 'menyinkronkan' ? (
              <>
                <span className="spinner-inline" /> Menyimpan…
              </>
            ) : (
              'Simpan Absensi'
            )}
          </button>
        </div>
      </div>

      {/* Main Attendance Table */}
      {session.santri.length === 0 ? (
        <div className="empty-state">Belum ada santri pada kelompok ini. Periksa data master atau hasil import penugasan.</div>
      ) : filteredSantri.length === 0 ? (
        <div className="empty-state">Tidak ada santri yang cocok dengan pencarian "{searchKeyword}".</div>
      ) : (
        <div className="attendance-table-card focus-table-card">
          <div className="attendance-table-container">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th className="th-nomor">No</th>
                  <th className="th-nama">Nama Santri</th>
                  <th className="th-status th-hadir">
                    <div className="th-status-header">
                      <span>Hadir</span>
                      <span className="th-status-count">({statusCounts.Hadir})</span>
                    </div>
                  </th>
                  <th className="th-status th-terlambat">
                    <div className="th-status-header">
                      <span>Terlambat</span>
                      <span className="th-status-count">({statusCounts.Terlambat})</span>
                    </div>
                  </th>
                  <th className="th-status th-izin">
                    <div className="th-status-header">
                      <span>Izin</span>
                      <span className="th-status-count">({statusCounts.Izin})</span>
                    </div>
                  </th>
                  <th className="th-status th-sakit">
                    <div className="th-status-header">
                      <span>Sakit</span>
                      <span className="th-status-count">({statusCounts.Sakit})</span>
                    </div>
                  </th>
                  <th className="th-status th-alpha">
                    <div className="th-status-header">
                      <span>Alpha</span>
                      <span className="th-status-count">({statusCounts.Alpha})</span>
                    </div>
                  </th>
                  <th className="th-catatan">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {filteredSantri.map((santri, index) => {
                  const draft = drafts[santri.santri_id];
                  const currentStatus: StatusAbsensi = draft?.status ?? santri.status ?? 'Hadir';
                  const currentNote = draft?.keterangan !== undefined ? draft.keterangan : (santri.keterangan ?? '');
                  const nomorInduk = santri.no_id_induk || santri.nis || '—';

                  return (
                    <tr key={santri.santri_id} className={`attendance-row ${currentStatus ? `status-${currentStatus.toLowerCase()}` : ''} ${!isAbsensiStarted ? 'is-locked-row' : ''}`}>
                      <td className="cell-nomor">{index + 1}</td>
                      <td className="cell-nama">
                        <div className="santri-name-stack">
                          <span className="santri-name-text">{santri.nama}</span>
                          <span className="santri-nip-text">
                            NIP: {nomorInduk}
                          </span>
                        </div>
                      </td>

                      {/* Status Columns with Blue Checkboxes */}
                      {STATUS_OPTIONS.map(status => {
                        const isChecked = currentStatus === status;
                        return (
                          <td
                            key={status}
                            className={`cell-checkbox cell-${status.toLowerCase()} ${isChecked ? 'is-selected' : ''} ${!isAbsensiStarted ? 'is-disabled-cell' : ''}`}
                            onClick={() => handleSelectStatus(santri, status)}
                          >
                            <div className="checkbox-center-wrap">
                              <BlueCheckbox
                                checked={isChecked}
                                disabled={!isAbsensiStarted}
                                onClick={() => handleSelectStatus(santri, status)}
                                ariaLabel={`${status} untuk ${santri.nama}`}
                              />
                            </div>
                          </td>
                        );
                      })}

                      {/* Optional Notes Column (Progressive Disclosure) */}
                      <td className="cell-catatan">
                        {currentNote.trim() || activeNoteEditingId === santri.santri_id ? (
                          <div className="attendance-note-active-wrap">
                            <input
                              type="text"
                              autoFocus={activeNoteEditingId === santri.santri_id}
                              disabled={!isAbsensiStarted}
                              className="attendance-note-input is-active"
                              placeholder="Isi catatan disini"
                              value={currentNote}
                              onChange={e => handleNoteChange(santri, e.target.value)}
                              onBlur={() => {
                                if (!currentNote.trim()) setActiveNoteEditingId(null);
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === 'Escape') {
                                  setActiveNoteEditingId(null);
                                }
                              }}
                              aria-label={`Catatan untuk ${santri.nama}`}
                            />
                            {isAbsensiStarted && currentNote.trim() && (
                              <button
                                type="button"
                                className="clear-note-inline-btn"
                                title="Hapus catatan"
                                onClick={() => {
                                  handleNoteChange(santri, '');
                                  setActiveNoteEditingId(null);
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!isAbsensiStarted}
                            className={`add-note-inline-btn ${!isAbsensiStarted ? 'is-disabled' : ''}`}
                            onClick={() => {
                              if (isAbsensiStarted) {
                                setActiveNoteEditingId(santri.santri_id);
                              }
                            }}
                            title={isAbsensiStarted ? `Tambah catatan untuk ${santri.nama}` : "Mulai absensi terlebih dahulu"}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="5" x2="12" y2="19"></line>
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            <span>Catatan</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="attendance-footer-summary-row">
                  <td colSpan={2} className="footer-summary-label">
                    Total: <strong>{session.santri.length}</strong> Santri
                  </td>
                  <td className="footer-summary-cell cell-hadir">({statusCounts.Hadir})</td>
                  <td className="footer-summary-cell cell-terlambat">({statusCounts.Terlambat})</td>
                  <td className="footer-summary-cell cell-izin">({statusCounts.Izin})</td>
                  <td className="footer-summary-cell cell-sakit">({statusCounts.Sakit})</td>
                  <td className="footer-summary-cell cell-alpha">({statusCounts.Alpha})</td>
                  <td className="footer-summary-cell"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Save Success / Error Modal */}
      {saveModal && (
        <div className="save-modal-backdrop" role="presentation">
          <div
            aria-describedby="save-modal-message"
            aria-labelledby="save-modal-title"
            aria-modal="true"
            className={`save-modal ${saveModal.type}`}
            role="dialog"
          >
            <div className="save-modal-icon" aria-hidden="true">
              {saveModal.type === 'success' ? '✓' : '!'}
            </div>
            <h2 id="save-modal-title">{saveModal.title}</h2>
            <p id="save-modal-message">{saveModal.message}</p>
            <div className="save-modal-actions">
              {saveModal.type === 'error' && (
                <button className="secondary-button" onClick={() => { setSaveModal(null); void handleSave(); }}>
                  Coba lagi
                </button>
              )}
              {saveModal.type === 'success' && (
                <button
                  className="secondary-button"
                  onClick={() => navigate(subMenuInfo.route)}
                >
                  Kembali ke Menu
                </button>
              )}
              <button className="primary-button" onClick={() => setSaveModal(null)}>
                {saveModal.type === 'success' ? 'Tetap di Halaman Ini' : 'Tutup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
