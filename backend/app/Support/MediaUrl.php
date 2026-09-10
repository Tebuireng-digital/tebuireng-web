<?php

namespace App\Support;

class MediaUrl
{
    public static function santriPhoto(int $santriId, mixed $version = null): string
    {
        return self::withVersion("/api/santri/{$santriId}/foto", $version);
    }

    public static function portalSantriPhoto(mixed $version = null): string
    {
        return self::withVersion('/api/santri-portal/foto', $version);
    }

    public static function pelanggaranLampiran(int $pelanggaranId, int $lampiranId, mixed $version = null): string
    {
        return self::withVersion("/api/pelanggaran/{$pelanggaranId}/lampiran/{$lampiranId}", $version);
    }

    private static function withVersion(string $path, mixed $version = null): string
    {
        $resolvedVersion = MediaStorage::safeVersion($version);

        if (!$resolvedVersion) {
            return $path;
        }

        return $path.'?v='.rawurlencode($resolvedVersion);
    }
}
