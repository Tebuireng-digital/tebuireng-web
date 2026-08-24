import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';

export interface SantriUser {
  santri_id: number;
  no_id_induk: string;
  nama: string;
  foto_url?: string | null;
  nis?: string | null;
  nik_siswa?: string | null;
  jenis_kelamin?: string | null;
  tempat_lahir?: string | null;
  tanggal_lahir?: string | null;
  no_hp_santri?: string | null;
  alamat_jalan?: string | null;
  provinsi?: string | null;
  kabupaten_kota?: string | null;
  kecamatan?: string | null;
  desa_kelurahan?: string | null;
  kode_pos?: string | null;
  nama_wali?: string | null;
  no_hp_wali?: string | null;
  no_kk?: string | null;
  nama_ayah?: string | null;
  nik_ayah?: string | null;
  pendidikan_ayah?: string | null;
  pekerjaan_ayah?: string | null;
  nama_ibu?: string | null;
  nik_ibu?: string | null;
  pendidikan_ibu?: string | null;
  pekerjaan_ibu?: string | null;
  rata_rata_penghasilan?: string | null;
  unit_kode?: string | null;
  nama_kamar?: string | null;
  nama_kelas?: string | null;
  tingkat?: string | null;
  tahun_ajaran?: string | null;
  pend_sumber?: string | null;
  kelas_sumber?: string | null;
  jurusan?: string | null;
  kelas_paralel?: string | null;
  ranking?: string | null;
  status_siswa_sumber?: string | null;
  asal_sekolah?: string | null;
  jenis_sekolah?: string | null;
  status_sekolah?: string | null;
  lokasi_sekolah?: string | null;
  no_un?: string | null;
  kip?: string | null;
  saldo_spp?: string | null;
  nama_madin?: string | null;
  nama_al_quran_subuh?: string | null;
  nama_takhasus?: string | null;
  partisipasi_kegiatan?: Record<string, string>;
  wajib_ganti_password: boolean;
}

interface SantriPortalAuthValue {
  user: SantriUser | null;
  loading: boolean;
  login: (user: SantriUser) => void;
  logout: () => Promise<void>;
}

const SantriPortalAuthContext = createContext<SantriPortalAuthValue | undefined>(undefined);

export function SantriPortalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SantriUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/santri-portal/me')
      .then(response => setUser(response.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    try { await api.post('/api/santri-portal/logout'); } finally { setUser(null); }
  };

  return <SantriPortalAuthContext.Provider value={{ user, loading, login: setUser, logout }}>{children}</SantriPortalAuthContext.Provider>;
}

export function useSantriPortalAuth() {
  const context = useContext(SantriPortalAuthContext);
  if (!context) throw new Error('useSantriPortalAuth must be used inside SantriPortalAuthProvider');
  return context;
}
