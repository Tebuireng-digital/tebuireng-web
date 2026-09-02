<?php

namespace App\Listeners;

use App\Events\PerizinanDisetujui;
use App\Services\WhatsAppService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class SendPerizinanWaNotification implements ShouldQueue
{
    use InteractsWithQueue;

    protected WhatsAppService $waService;

    public function __construct(WhatsAppService $waService)
    {
        $this->waService = $waService;
    }

    public function handle(PerizinanDisetujui $event): void
    {
        $perizinan = DB::table('perizinan')
            ->join('santri', 'perizinan.santri_id', '=', 'santri.santri_id')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->join('jenis_izin', 'perizinan.jenis_izin_id', '=', 'jenis_izin.jenis_izin_id')
            ->where('perizinan.perizinan_id', $event->perizinanId)
            ->select(
                'perizinan.*',
                'santri.nama as nama_santri',
                'santri.nis',
                'santri.nama_wali',
                'santri.no_hp_wali',
                'kamar.nama as nama_kamar',
                'jenis_izin.nama as nama_jenis_izin'
            )
            ->first();

        if (!$perizinan || empty($perizinan->no_hp_wali)) {
            return;
        }

        Carbon::setLocale('id');
        $tglMulai = Carbon::parse($perizinan->tanggal_mulai)->locale('id')->isoFormat('D MMMM YYYY, HH:mm') . ' WIB';
        $tglKembali = Carbon::parse($perizinan->rencana_kembali)->locale('id')->isoFormat('D MMMM YYYY, HH:mm') . ' WIB';
        $namaWali = $perizinan->nama_wali ? "Bapak/Ibu {$perizinan->nama_wali}" : "Bapak/Ibu Wali Santri";

        $message = "ASSALAMU'ALAIKUM WR. WB.\n\n"
            . "Yth. {$namaWali} dari:\n"
            . "Nama: {$perizinan->nama_santri} (NIS: {$perizinan->nis})\n"
            . "Kamar: " . ($perizinan->nama_kamar ?? '-') . "\n\n"
            . "Memberitahukan bahwa perizinan santri telah *DISETUJUI* dengan rincian:\n"
            . "Jenis Izin: {$perizinan->nama_jenis_izin}\n"
            . "Keperluan: {$perizinan->keperluan}\n"
            . "Waktu Mulai: {$tglMulai}\n"
            . "Rencana Kembali: {$tglKembali}\n\n"
            . "Mohon untuk dapat memantau kepulangan/kembali santri sesuai jadwal yang telah ditentukan. Terima kasih.\n\n"
            . "--\nPondok Pesantren Tebuireng";

        $this->waService->sendMessage(
            $perizinan->no_hp_wali,
            $message,
            (int) $perizinan->santri_id,
            'perizinan',
            (int) $perizinan->perizinan_id
        );
    }
}
