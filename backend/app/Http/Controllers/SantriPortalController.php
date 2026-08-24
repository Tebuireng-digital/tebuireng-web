<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

use Illuminate\Support\Facades\Storage;

class SantriPortalController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'no_id_induk' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $wali = \App\Models\WaliAccount::where('username', $credentials['no_id_induk'])
            ->where('status_aktif', true)
            ->first();

        if ($wali && Hash::check($credentials['password'], $wali->password_hash)) {
            Auth::guard('wali')->login($wali);
            $request->session()->regenerate();
            
            return response()->json([
                'message' => 'Logged in successfully',
                'user' => $this->userForResponse($wali),
            ]);
        }

        return response()->json([
            'message' => 'Nomor Induk Pondok anak atau password yang Anda masukkan salah.'
        ], 401);
    }

    public function logout(Request $request)
    {
        Auth::guard('wali')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(Request $request)
    {
        $user = Auth::guard('wali')->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        return response()->json(['user' => $this->userForResponse($user)]);
    }

    public function changePassword(Request $request)
    {
        $data = $request->validate([
            'old_password' => ['required', 'string'],
            'new_password' => ['required', 'string', 'confirmed', 'different:old_password', Password::min(12)->letters()->numbers()],
        ]);

        $santri = Auth::guard('wali')->user();
        if (!Hash::check($data['old_password'], $santri->password_hash)) {
            return response()->json(['message' => 'Kata sandi lama tidak sesuai.'], 400);
        }

        $santri->forceFill([
            'password_hash' => Hash::make($data['new_password']),
            'wajib_ganti_password' => false,
        ])->save();

        return response()->json(['message' => 'Kata sandi berhasil diubah.']);
    }

    public function kehadiran(Request $request)
    {
        $user = Auth::guard('wali')->user();
        $riwayat = DB::table('absensi')
            ->join('jenis_kegiatan', 'absensi.jenis_kegiatan_id', '=', 'jenis_kegiatan.jenis_kegiatan_id')
            ->where('absensi.santri_id', $user->santri_id)
            ->orderBy('absensi.tanggal', 'desc')
            ->select('absensi.*', 'jenis_kegiatan.nama as nama_kegiatan')
            ->get();
        return response()->json($riwayat);
    }

    public function pelanggaran(Request $request)
    {
        $user = Auth::guard('wali')->user();
        $riwayat = DB::table('pelanggaran')
            ->join('kategori_pelanggaran', 'pelanggaran.kategori_pelanggaran_id', '=', 'kategori_pelanggaran.kategori_pelanggaran_id')
            ->where('pelanggaran.santri_id', $user->santri_id)
            ->orderBy('pelanggaran.tanggal', 'desc')
            ->select('pelanggaran.*', 'kategori_pelanggaran.kategori', 'kategori_pelanggaran.uraian_pelanggaran', 'kategori_pelanggaran.poin_maks')
            ->get();
        return response()->json($riwayat);
    }

    public function perizinan(Request $request)
    {
        $user = Auth::guard('wali')->user();
        $riwayat = DB::table('perizinan')
            ->join('jenis_izin', 'perizinan.jenis_izin_id', '=', 'jenis_izin.jenis_izin_id')
            ->where('perizinan.santri_id', $user->santri_id)
            ->orderBy('perizinan.tanggal_mulai', 'desc')
            ->select('perizinan.*', 'jenis_izin.nama as jenis_izin_nama')
            ->get();
        return response()->json($riwayat);
    }

    public function prestasi(Request $request)
    {
        $user = Auth::guard('wali')->user();
        $riwayat = DB::table('prestasi')
            ->where('prestasi.santri_id', $user->santri_id)
            ->orderBy('prestasi.tanggal', 'desc')
            ->orderBy('prestasi.prestasi_id', 'desc')
            ->get();

        return response()->json($riwayat);
    }

    private function userForResponse($wali): array
    {
        $latestEducation = DB::table('santri_pendidikan as sp')
            ->whereRaw('sp.tahun_ajaran = (select max(sp2.tahun_ajaran) from santri_pendidikan as sp2 where sp2.santri_id = sp.santri_id)');
        $participation = DB::table('santri_kegiatan_partisipasi as participation')
            ->join('jenis_kegiatan as activity', 'participation.jenis_kegiatan_id', '=', 'activity.jenis_kegiatan_id')
            ->where('participation.santri_id', $wali->santri_id)
            ->pluck('participation.status', 'activity.kode')
            ->all();

        $profile = DB::table('santri')
            ->leftJoin('unit_pendidikan', 'santri.unit_id', '=', 'unit_pendidikan.unit_id')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('kelas_formal', 'santri.kelas_formal_id', '=', 'kelas_formal.kelas_formal_id')
            ->leftJoin('kelompok_madin', 'santri.kelompok_madin_id', '=', 'kelompok_madin.kelompok_madin_id')
            ->leftJoin('kelompok_pbs', 'santri.kelompok_pbs_id', '=', 'kelompok_pbs.kelompok_pbs_id')
            ->leftJoin('kelompok_pbm', 'santri.kelompok_pbm_id', '=', 'kelompok_pbm.kelompok_pbm_id')
            ->leftJoin('santri_keluarga', 'santri.santri_id', '=', 'santri_keluarga.santri_id')
            ->leftJoinSub($latestEducation, 'pendidikan', function ($join) {
                $join->on('santri.santri_id', '=', 'pendidikan.santri_id');
            })
            ->where('santri.santri_id', $wali->santri_id)
            ->select('santri.no_id_induk', 'santri.nis', 'santri.nik_siswa', 'santri.nama', 'santri.jenis_kelamin', 'santri.tempat_lahir', 'santri.tanggal_lahir', 'santri.no_hp_santri', 'santri.foto_path', 'santri.alamat_jalan', 'santri.provinsi', 'santri.kabupaten_kota', 'santri.kecamatan', 'santri.desa_kelurahan', 'santri.kode_pos', 'santri.nama_wali', 'santri.no_hp_wali', 'unit_pendidikan.kode as unit_kode', 'kamar.nama as nama_kamar', 'kelas_formal.nama_kelas', 'kelas_formal.tingkat', 'kelompok_madin.nama_kelas_madin as nama_madin', 'kelompok_pbs.nama_kelompok as nama_al_quran_subuh', 'kelompok_pbm.nama_kelompok as nama_takhasus', 'santri_keluarga.no_kk', 'santri_keluarga.nama_ayah', 'santri_keluarga.nik_ayah', 'santri_keluarga.pendidikan_ayah', 'santri_keluarga.pekerjaan_ayah', 'santri_keluarga.nama_ibu', 'santri_keluarga.nik_ibu', 'santri_keluarga.pendidikan_ibu', 'santri_keluarga.pekerjaan_ibu', 'santri_keluarga.rata_rata_penghasilan', 'pendidikan.tahun_ajaran', 'pendidikan.pend_sumber', 'pendidikan.kelas_sumber', 'pendidikan.jurusan', 'pendidikan.kelas_paralel', 'pendidikan.ranking', 'pendidikan.status_siswa_sumber as status_siswa_pendidikan', 'pendidikan.asal_sekolah', 'pendidikan.jenis_sekolah', 'pendidikan.status_sekolah', 'pendidikan.lokasi_sekolah', 'pendidikan.no_un', 'pendidikan.kip', 'pendidikan.saldo_spp')
            ->first();

        return [
            'wali_id' => $wali->wali_id,
            'santri_id' => $wali->santri_id,
            'no_id_induk' => $profile?->no_id_induk ?? $wali->username,
            'nis' => $profile?->nis,
            'nik_siswa' => $profile?->nik_siswa,
            'nama' => $profile?->nama ?? $wali->username,
            'foto_url' => $profile?->foto_path ? Storage::url($profile->foto_path) : null,
            'jenis_kelamin' => $profile?->jenis_kelamin,
            'tempat_lahir' => $profile?->tempat_lahir,
            'tanggal_lahir' => $profile?->tanggal_lahir,
            'no_hp_santri' => $profile?->no_hp_santri,
            'alamat_jalan' => $profile?->alamat_jalan,
            'provinsi' => $profile?->provinsi,
            'kabupaten_kota' => $profile?->kabupaten_kota,
            'kecamatan' => $profile?->kecamatan,
            'desa_kelurahan' => $profile?->desa_kelurahan,
            'kode_pos' => $profile?->kode_pos,
            'nama_wali' => $profile?->nama_wali,
            'no_hp_wali' => $profile?->no_hp_wali,
            'no_kk' => $profile?->no_kk,
            'nama_ayah' => $profile?->nama_ayah,
            'nik_ayah' => $profile?->nik_ayah,
            'pendidikan_ayah' => $profile?->pendidikan_ayah,
            'pekerjaan_ayah' => $profile?->pekerjaan_ayah,
            'nama_ibu' => $profile?->nama_ibu,
            'nik_ibu' => $profile?->nik_ibu,
            'pendidikan_ibu' => $profile?->pendidikan_ibu,
            'pekerjaan_ibu' => $profile?->pekerjaan_ibu,
            'rata_rata_penghasilan' => $profile?->rata_rata_penghasilan,
            'unit_kode' => $profile?->unit_kode,
            'nama_kamar' => $profile?->nama_kamar,
            'nama_kelas' => $profile?->nama_kelas,
            'tingkat' => $profile?->tingkat,
            'tahun_ajaran' => $profile?->tahun_ajaran,
            'pend_sumber' => $profile?->pend_sumber,
            'kelas_sumber' => $profile?->kelas_sumber,
            'jurusan' => $profile?->jurusan,
            'kelas_paralel' => $profile?->kelas_paralel,
            'ranking' => $profile?->ranking,
            'status_siswa_sumber' => $profile?->status_siswa_pendidikan,
            'asal_sekolah' => $profile?->asal_sekolah,
            'jenis_sekolah' => $profile?->jenis_sekolah,
            'status_sekolah' => $profile?->status_sekolah,
            'lokasi_sekolah' => $profile?->lokasi_sekolah,
            'no_un' => $profile?->no_un,
            'kip' => $profile?->kip,
            'saldo_spp' => $profile?->saldo_spp,
            'nama_madin' => $profile?->nama_madin,
            'nama_al_quran_subuh' => $profile?->nama_al_quran_subuh,
            'nama_takhasus' => $profile?->nama_takhasus,
            'partisipasi_kegiatan' => $participation,
            'wajib_ganti_password' => (bool) $wali->wajib_ganti_password,
        ];
    }
}
