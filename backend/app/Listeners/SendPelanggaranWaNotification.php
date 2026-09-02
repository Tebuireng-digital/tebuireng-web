<?php

namespace App\Listeners;

use App\Events\PelanggaranDicatat;
use App\Services\WhatsAppService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class SendPelanggaranWaNotification implements ShouldQueue
{
    use InteractsWithQueue;

    protected WhatsAppService $waService;

    public function __construct(WhatsAppService $waService)
    {
        $this->waService = $waService;
    }

    public function handle(PelanggaranDicatat $event): void
    {
        $pelanggaran = DB::table('pelanggaran')
            ->join('santri', 'pelanggaran.santri_id', '=', 'santri.santri_id')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->join('kategori_pelanggaran', 'pelanggaran.kategori_pelanggaran_id', '=', 'kategori_pelanggaran.kategori_pelanggaran_id')
            ->where('pelanggaran.pelanggaran_id', $event->pelanggaranId)
            ->select(
                'pelanggaran.*',
                'santri.nama as nama_santri',
                'santri.nis',
                'santri.nama_wali',
                'santri.no_hp_wali',
                'kamar.nama as nama_kamar',
                'kategori_pelanggaran.uraian_pelanggaran',
                'kategori_pelanggaran.kategori'
            )
            ->first();

        if (!$pelanggaran || empty($pelanggaran->no_hp_wali)) {
            return;
        }

        $totalPoin = (int) DB::table('pelanggaran')
            ->where('santri_id', $pelanggaran->santri_id)
            ->sum('poin');

        Carbon::setLocale('id');
        $tglKejadian = Carbon::parse($pelanggaran->tanggal)->locale('id')->isoFormat('D MMMM YYYY');
        $namaWali = $pelanggaran->nama_wali ? "Bapak/Ibu {$pelanggaran->nama_wali}" : "Bapak/Ibu Wali Santri";
        $ket = $pelanggaran->keterangan ? $pelanggaran->keterangan : '-';

        $message = "ASSALAMU'ALAIKUM WR. WB.\n\n"
            . "Yth. {$namaWali} dari:\n"
            . "Nama: {$pelanggaran->nama_santri} (NIS: {$pelanggaran->nis})\n"
            . "Kamar: " . ($pelanggaran->nama_kamar ?? '-') . "\n\n"
            . "Pemberitahuan catatan pelanggaran santri:\n"
            . "Pelanggaran: {$pelanggaran->uraian_pelanggaran}\n"
            . "Kategori: {$pelanggaran->kategori} ({$pelanggaran->poin} Poin)\n"
            . "Total Akumulasi Poin: {$totalPoin} Poin\n"
            . "Tanggal Kejadian: {$tglKejadian}\n"
            . "Keterangan: {$ket}\n\n"
            . "Mohon Bapak/Ibu dapat memberikan bimbingan dan nasihat kepada santri. Terima kasih.\n\n"
            . "--\nPondok Pesantren Tebuireng";

        $this->waService->sendMessage(
            $pelanggaran->no_hp_wali,
            $message,
            (int) $pelanggaran->santri_id,
            'pelanggaran',
            (int) $pelanggaran->pelanggaran_id
        );
    }
}
