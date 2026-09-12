import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { ContentSkeleton } from '../components/LoadingSkeleton';
import { AppToast } from '../components/AppToast';
import { usePageMeta } from '../hooks/usePageMeta';

export interface JadwalItem {
  jadwal_id: number;
  jenis_kegiatan_id: number;
  kode_kegiatan: string;
  nama_jadwal: string;
  nama_kegiatan_modul: string;
  konteks_operasional: string;
  jam_mulai: string;
  jam_selesai: string;
  waktu_pelaksanaan: string;
  penanggung_jawab: string;
  toleransi_menit: number;
  status_aktif: boolean;
}

function formatMaskedTime(raw: string): string {
  let digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 0) return '';
  
  // If first digit is 3..9 (e.g. typing '5' or '6'), auto-prefix with 0: '05:'
  if (digits.length === 1 && Number(digits[0]) >= 3) {
    return `0${digits[0]}:`;
  }

  // If 2 digits entered, clamp hour to max 23
  if (digits.length >= 2) {
    const hour = Number(digits.slice(0, 2));
    if (hour > 23) {
      digits = `23${digits.slice(2)}`;
    }
  }

  // If 3 digits entered, clamp minute tens to max 5
  if (digits.length >= 3) {
    const minTens = Number(digits[2]);
    if (minTens > 5) {
      digits = `${digits.slice(0, 2)}5${digits.slice(3)}`;
    }
  }

  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function validateTime(timeStr: string): { isValid: boolean; message: string } {
  if (!timeStr || timeStr.trim() === '') return { isValid: false, message: 'Wajib diisi (HH:MM)' };
  if (timeStr.length < 5) return { isValid: false, message: 'Lengkapi 4 digit waktu (HH:MM)' };
  const [hStr, mStr] = timeStr.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h) || isNaN(m)) return { isValid: false, message: 'Format waktu tidak valid' };
  if (h < 0 || h > 23) return { isValid: false, message: 'Jam harus antara 00 s.d 23' };
  if (m < 0 || m > 59) return { isValid: false, message: 'Menit harus antara 00 s.d 59' };
  return { isValid: true, message: '' };
}

function getMinutesFromMidnight(timeStr: string): number {
  if (!timeStr || timeStr.length < 5) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

interface MaskedTimeInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  error?: string;
}

function MaskedTimeInput({ label, value, onChange, error }: MaskedTimeInputProps) {
  const [isTouched, setIsTouched] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMaskedTime(e.target.value);
    onChange(formatted);
  };

  const handleBlur = () => {
    setIsTouched(true);
    // Auto-pad partial time on blur e.g. "5:" -> "05:00", "05" -> "05:00"
    if (value && value.length > 0 && value.length < 5) {
      const clean = value.replace(':', '');
      if (clean.length === 1) onChange(`0${clean}:00`);
      else if (clean.length === 2) {
        const h = Number(clean);
        onChange(`${h > 23 ? '23' : clean.padStart(2, '0')}:00`);
      } else if (clean.length === 3) {
        onChange(`${clean.slice(0, 2)}:${clean[2]}0`);
      }
    }
  };

  const validation = validateTime(value);
  const displayError = error || ((isTouched || value.length === 5) && !validation.isValid ? validation.message : '');

  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="00:00"
          value={value}
          maxLength={5}
          onChange={handleChange}
          onBlur={handleBlur}
          style={{
            width: '100%',
            padding: '8px 50px 8px 12px',
            borderRadius: '6px',
            border: displayError ? '1px solid #ef4444' : '1px solid #cbd5e1',
            fontSize: '0.95rem',
            color: '#1c2420',
            fontWeight: 700,
            fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
            background: displayError ? '#fef2f2' : '#ffffff',
            outline: 'none',
            letterSpacing: '0.05em',
            transition: 'border-color 0.15s ease, background 0.15s ease',
          }}
        />
        <span
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '0.7rem',
            fontWeight: 800,
            color: '#0f6e56',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            padding: '3px 7px',
            borderRadius: '4px',
            pointerEvents: 'none',
          }}
        >
          WIB
        </span>
      </div>
      {displayError ? (
        <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
          {displayError}
        </span>
      ) : (
        <span style={{ display: 'block', marginTop: '4px', fontSize: '0.725rem', color: '#64748b' }}>
          Format 24 jam (00:00 - 23:59)
        </span>
      )}
    </div>
  );
}

export function JadwalAbsensiMasterPage() {
  usePageMeta({
    title: 'Jadwal Absensi',
    description: 'Pengaturan waktu pelaksanaan dan penanggung jawab input untuk seluruh modul absensi santri.',
  });

  const queryClient = useQueryClient();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Edit Modal state
  const [editingSchedule, setEditingSchedule] = useState<JadwalItem | null>(null);
  const [formNamaJadwal, setFormNamaJadwal] = useState('');
  const [formJamMulai, setFormJamMulai] = useState('');
  const [formJamSelesai, setFormJamSelesai] = useState('');
  const [formToleransi, setFormToleransi] = useState(15);
  const [formStatusAktif, setFormStatusAktif] = useState(true);

  // Feedback state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [modalError, setModalError] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const { data: schedules = [], isLoading, isError, refetch } = useQuery<JadwalItem[]>({
    queryKey: ['absensi-jadwal'],
    queryFn: async () => (await api.get('/api/absensi/jadwal')).data,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, any> }) => {
      return (await api.put(`/api/absensi/jadwal/${id}`, data)).data;
    },
    onSuccess: () => {
      setEditingSchedule(null);
      setModalError('');
      showToast('Waktu pelaksanaan absensi berhasil diperbarui');
      void queryClient.invalidateQueries({ queryKey: ['absensi-jadwal'] });
    },
    onError: (err: any) => {
      setModalError(err.response?.data?.message || 'Gagal memperbarui jadwal absensi.');
    },
  });

  const filteredSchedules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return schedules.filter(item => {
      return (
        !q ||
        item.nama_jadwal.toLowerCase().includes(q) ||
        item.nama_kegiatan_modul.toLowerCase().includes(q) ||
        item.penanggung_jawab.toLowerCase().includes(q)
      );
    });
  }, [schedules, searchQuery]);

  const jamMulaiValid = validateTime(formJamMulai);
  const jamSelesaiValid = validateTime(formJamSelesai);

  const startMinutes = getMinutesFromMidnight(formJamMulai);
  const endMinutes = getMinutesFromMidnight(formJamSelesai);
  const durationMinutes = endMinutes - startMinutes;

  const isChronologicalValid = useMemo(() => {
    if (!jamMulaiValid.isValid || !jamSelesaiValid.isValid) return false;
    return durationMinutes >= 15 && durationMinutes <= 360;
  }, [jamMulaiValid.isValid, jamSelesaiValid.isValid, durationMinutes]);

  const chronologicalError = useMemo(() => {
    if (formJamMulai.length === 5 && formJamSelesai.length === 5 && jamMulaiValid.isValid && jamSelesaiValid.isValid) {
      if (endMinutes <= startMinutes) {
        return 'Jam selesai harus lebih besar dari jam mulai';
      }
      if (durationMinutes < 15) {
        return `Durasi minimal 15 menit (saat ini ${durationMinutes} menit)`;
      }
      if (durationMinutes > 360) {
        return 'Durasi maksimal 6 jam per sesi absensi';
      }
    }
    return '';
  }, [formJamMulai, formJamSelesai, jamMulaiValid.isValid, jamSelesaiValid.isValid, endMinutes, startMinutes, durationMinutes]);

  const handleOpenEdit = (item: JadwalItem) => {
    setEditingSchedule(item);
    setFormNamaJadwal(item.nama_jadwal);
    setFormJamMulai(item.jam_mulai.slice(0, 5));
    setFormJamSelesai(item.jam_selesai.slice(0, 5));
    setFormToleransi(item.toleransi_menit || 15);
    setFormStatusAktif(item.status_aktif);
    setModalError('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;

    if (!jamMulaiValid.isValid || !jamSelesaiValid.isValid) {
      setModalError('Format waktu tidak valid. Pastikan jam 00-23 dan menit 00-59.');
      return;
    }

    if (endMinutes <= startMinutes) {
      setModalError('Jam selesai harus lebih besar dari jam mulai.');
      return;
    }

    if (durationMinutes < 15) {
      setModalError(`Durasi waktu minimal 15 menit (saat ini ${durationMinutes} menit).`);
      return;
    }

    if (durationMinutes > 360) {
      setModalError('Durasi waktu maksimal 6 jam untuk satu sesi absensi.');
      return;
    }

    updateMutation.mutate({
      id: editingSchedule.jadwal_id,
      data: {
        nama_jadwal: formNamaJadwal.trim(),
        jam_mulai: formJamMulai,
        jam_selesai: formJamSelesai,
        toleransi_menit: Number(formToleransi),
        status_aktif: formStatusAktif,
      },
    });
  };

  if (isLoading) {
    return <ContentSkeleton rows={6} />;
  }

  return (
    <div className="jadwal-master-container page-shell" style={{ padding: '1.5rem', maxWidth: '1280px', margin: '0 auto' }}>
      {toast && <AppToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Main Table Container */}
      <main className="master-content">
        {isError ? (
          <div className="error-card card p-4 text-center" style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #fecaca' }}>
            <p className="text-danger mb-3" style={{ color: '#dc2626', fontWeight: 600 }}>Gagal memuat daftar jadwal absensi.</p>
            <button type="button" className="btn btn-primary" onClick={() => void refetch()} style={{ background: '#0f6e56', borderColor: '#0f6e56', color: '#ffffff', padding: '8px 20px', borderRadius: '6px', fontWeight: 600 }}>
              Coba Lagi
            </button>
          </div>
        ) : (
          <div className="card table-card" style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            
            {/* Header Title & Search Bar Row inside Container */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '1.125rem 1.25rem',
                borderBottom: '1px solid #cbd5e1',
                background: '#ffffff',
              }}
            >
              <div>
                <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1c2420', margin: 0, letterSpacing: '-0.02em' }}>
                  Jadwal Absensi
                </h1>
                <p style={{ margin: '0.25rem 0 0', color: '#5b655f', fontSize: '0.875rem' }}>
                  Pengaturan waktu pelaksanaan dan penanggung jawab input untuk seluruh modul absensi santri.
                </p>
              </div>

              {/* Search Bar positioned on the Right of Headline */}
              <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'grid', placeItems: 'center' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Cari kegiatan, modul, atau penanggung jawab..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 14px 7px 36px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    outline: 'none',
                    background: '#ffffff',
                    color: '#1c2420',
                  }}
                />
              </div>
            </div>

            {/* Clear Table Structure with Green Header Row & Distinct Borders (No Scrollbar) */}
            <div className="table-responsive" style={{ overflowX: 'hidden' }}>
              <table className="data-table" aria-label="Daftar Jadwal Absensi" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0f6e56', color: '#ffffff' }}>
                    <th style={{ width: '50px', textAlign: 'center', padding: '12px 14px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid #0d5c48' }}>No</th>
                    <th style={{ padding: '12px 14px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid #0d5c48' }}>Nama Kegiatan</th>
                    <th style={{ padding: '12px 14px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid #0d5c48' }}>Modul Absensi</th>
                    <th style={{ textAlign: 'center', padding: '12px 14px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid #0d5c48' }}>Waktu Pelaksanaan</th>
                    <th style={{ padding: '12px 14px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid #0d5c48' }}>Penanggung Jawab Input</th>
                    <th style={{ width: '130px', textAlign: 'center', padding: '12px 14px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid #0d5c48' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedules.map((item, index) => {
                    return (
                      <tr key={item.jadwal_id} style={{ borderBottom: '1px solid #cbd5e1', background: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#475569', padding: '10px 14px', fontSize: '0.875rem', border: '1px solid #cbd5e1' }}>
                          {index + 1}
                        </td>
                        <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <strong style={{ color: '#1c2420', fontSize: '0.9rem', fontWeight: 700 }}>
                              {item.nama_jadwal}
                            </strong>
                            {!item.status_aktif && (
                              <span style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                                Non-Aktif
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', color: '#1c2420', fontWeight: 600, fontSize: '0.875rem' }}>
                          {item.nama_kegiatan_modul}
                        </td>
                        <td style={{ textAlign: 'center', padding: '10px 14px', border: '1px solid #cbd5e1', color: '#1c2420', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace' }}>
                          {item.jam_mulai.slice(0, 5)} - {item.jam_selesai.slice(0, 5)} WIB
                        </td>
                        <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', color: '#1c2420', fontSize: '0.875rem', fontWeight: 600 }}>
                          {item.penanggung_jawab}
                        </td>
                        <td style={{ textAlign: 'center', padding: '10px 14px', border: '1px solid #cbd5e1' }}>
                          {/* Tombol Edit Waktu (Background Hijau #0f6e56, Foreground Putih #ffffff) */}
                          <button
                            type="button"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '5px 12px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              borderRadius: '6px',
                              border: '1px solid #0d5c48',
                              background: '#0f6e56',
                              color: '#ffffff',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#0a4f3e';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#0f6e56';
                            }}
                            onClick={() => handleOpenEdit(item)}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            <span>Edit Waktu</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredSchedules.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', border: '1px solid #cbd5e1' }}>
                        Tidak ada jadwal absensi ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Edit Modal Component (No Emojis) */}
      {editingSchedule && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
              overflow: 'visible',
            }}
          >
            {/* Modal Header (Green background, white text) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                background: '#0f6e56',
                borderTopLeftRadius: '11px',
                borderTopRightRadius: '11px',
                borderBottom: '1px solid #0d5c48',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ffffff' }} aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Edit Waktu Pelaksanaan
                </h3>
              </div>
              <button
                type="button"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#ffffff',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  lineHeight: 1,
                  display: 'grid',
                  placeItems: 'center',
                  opacity: 0.9,
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                onClick={() => setEditingSchedule(null)}
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div style={{ margin: '1rem 1.25rem 0', padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                {modalError}
              </div>
            )}

            {/* Modal Form Body */}
            <form onSubmit={handleSaveEdit} style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                  Modul Absensi (Read-Only)
                </label>
                <input
                  type="text"
                  value={editingSchedule.nama_kegiatan_modul}
                  disabled
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#f1f5f9',
                    color: '#475569',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                  Nama Kegiatan
                </label>
                <input
                  type="text"
                  value={formNamaJadwal}
                  onChange={(e) => setFormNamaJadwal(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    color: '#1c2420',
                    fontWeight: 600,
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <MaskedTimeInput
                    label="Jam Mulai (WIB)"
                    value={formJamMulai}
                    onChange={(val) => setFormJamMulai(val)}
                  />
                  <MaskedTimeInput
                    label="Jam Selesai (WIB)"
                    value={formJamSelesai}
                    onChange={(val) => setFormJamSelesai(val)}
                    error={chronologicalError}
                  />
                </div>

                {/* Realtime Duration Feedback Badge */}
                {jamMulaiValid.isValid && jamSelesaiValid.isValid && isChronologicalValid && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '8px',
                      padding: '4px 10px',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      fontSize: '0.775rem',
                      fontWeight: 700,
                      color: '#15803d',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>
                      Durasi: {Math.floor(durationMinutes / 60) > 0 ? `${Math.floor(durationMinutes / 60)} jam ` : ''}{durationMinutes % 60 > 0 ? `${durationMinutes % 60} menit` : ''} ({durationMinutes} menit)
                    </span>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                  Toleransi Input (Menit)
                </label>
                <input
                  type="number"
                  min={0}
                  max={240}
                  value={formToleransi}
                  onChange={(e) => setFormToleransi(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    color: '#1c2420',
                    fontWeight: 600,
                    outline: 'none',
                  }}
                />
                <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: '#64748b' }}>
                  Toleransi keterlambatan input sebelum status warning.
                </span>
              </div>

              <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="statusAktifCheck"
                  checked={formStatusAktif}
                  onChange={(e) => setFormStatusAktif(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#0f6e56', cursor: 'pointer' }}
                />
                <label htmlFor="statusAktifCheck" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1c2420', cursor: 'pointer' }}>
                  Aktifkan Jadwal Kegiatan Ini
                </label>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem', paddingTop: '0.875rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setEditingSchedule(null)}
                  disabled={updateMutation.isPending}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending || !jamMulaiValid.isValid || !jamSelesaiValid.isValid || !isChronologicalValid}
                  style={{
                    padding: '8px 20px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: '1px solid #0d5c48',
                    background: (updateMutation.isPending || !jamMulaiValid.isValid || !jamSelesaiValid.isValid || !isChronologicalValid) ? '#94a3b8' : '#0f6e56',
                    color: '#ffffff',
                    cursor: (updateMutation.isPending || !jamMulaiValid.isValid || !jamSelesaiValid.isValid || !isChronologicalValid) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {updateMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
