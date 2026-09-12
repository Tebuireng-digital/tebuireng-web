<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MediaStorage
{
    /** @var array<string, string> */
    private const MIME_EXTENSION_MAP = [
        'image/jpeg' => 'jpg',
        'image/pjpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    private const DEFAULT_FILENAME = 'media-file';
    private const MAX_FILENAME_LENGTH = 120;

    /**
     * @return array{disk:string,directory:string,image:bool,mimes:array<int,string>,mime_types:array<int,string>,max_kilobytes:int,fallback_read_disks:array<int,string>}
     */
    public static function profile(string $profile): array
    {
        $config = config("media.{$profile}");

        if (!is_array($config)) {
            throw new RuntimeException("Media profile [{$profile}] tidak ditemukan.");
        }

        return [
            'disk' => (string) ($config['disk'] ?? 'local'),
            'directory' => trim((string) ($config['directory'] ?? ''), '/'),
            'image' => (bool) ($config['image'] ?? false),
            'mimes' => array_values(array_filter((array) ($config['mimes'] ?? []), 'is_string')),
            'mime_types' => array_values(array_filter((array) ($config['mime_types'] ?? []), 'is_string')),
            'max_kilobytes' => (int) ($config['max_kilobytes'] ?? 5120),
            'fallback_read_disks' => array_values(array_filter((array) ($config['fallback_read_disks'] ?? []), 'is_string')),
        ];
    }

    /**
     * @return array<int, string>
     */
    public static function validationRules(string $profile, bool $required = false): array
    {
        $config = self::profile($profile);
        $rules = [$required ? 'required' : 'nullable', 'file'];

        if ($config['image']) {
            $rules[] = 'image';
        }

        if ($config['mimes'] !== []) {
            $rules[] = 'mimes:'.implode(',', $config['mimes']);
        }

        if ($config['mime_types'] !== []) {
            $rules[] = 'mimetypes:'.implode(',', $config['mime_types']);
        }

        if ($config['max_kilobytes'] > 0) {
            $rules[] = 'max:'.$config['max_kilobytes'];
        }

        return $rules;
    }

    /**
     * @return array{
     *     disk:string,
     *     path:string,
     *     original_filename:string,
     *     mime_type:string,
     *     size_bytes:int,
     *     sha256:string
     * }
     */
    public static function store(UploadedFile $file, string $profile): array
    {
        $config = self::profile($profile);
        $disk = $config['disk'];
        $storedMimeType = self::detectMimeType($file);
        $extension = self::resolveStorageExtension($storedMimeType, $file);
        $fileName = Str::uuid().'.'.$extension;
        $path = $file->storeAs($config['directory'], $fileName, $disk);

        if (!$path) {
            throw new RuntimeException('File gagal disimpan ke media storage.');
        }

        $storedSize = (int) (Storage::disk($disk)->size($path) ?? $file->getSize() ?? 0);

        return [
            'disk' => $disk,
            'path' => $path,
            'original_filename' => self::sanitizeOriginalFilename($file->getClientOriginalName(), $extension),
            'mime_type' => $storedMimeType,
            'size_bytes' => $storedSize,
            'sha256' => self::resolveSha256($file, $disk, $path),
        ];
    }

    private static function detectMimeType(UploadedFile $file): string
    {
        $mimeType = trim((string) ($file->getMimeType() ?: $file->getClientMimeType() ?: ''));

        return $mimeType !== '' ? strtolower($mimeType) : 'application/octet-stream';
    }

    private static function resolveStorageExtension(string $mimeType, UploadedFile $file): string
    {
        $mappedExtension = self::MIME_EXTENSION_MAP[$mimeType] ?? null;
        if ($mappedExtension !== null) {
            return $mappedExtension;
        }

        $guessedExtension = self::normalizeExtension($file->guessExtension());

        return $guessedExtension !== '' ? $guessedExtension : 'bin';
    }

    private static function sanitizeOriginalFilename(string $filename, string $extension): string
    {
        $baseName = basename(str_replace('\\', '/', $filename));
        $stem = (string) pathinfo($baseName, PATHINFO_FILENAME);

        return self::buildSanitizedFilename($stem !== '' ? $stem : $baseName, $extension);
    }

    private static function resolveSha256(UploadedFile $file, string $disk, string $path): string
    {
        $realPath = $file->getRealPath();
        if (is_string($realPath) && $realPath !== '' && is_file($realPath)) {
            $hash = hash_file('sha256', $realPath);
            if (is_string($hash) && $hash !== '') {
                return $hash;
            }
        }

        try {
            $storedAbsolutePath = Storage::disk($disk)->path($path);
        } catch (\Throwable) {
            return '';
        }

        if (!is_string($storedAbsolutePath) || $storedAbsolutePath === '' || !is_file($storedAbsolutePath)) {
            return '';
        }

        return hash_file('sha256', $storedAbsolutePath) ?: '';
    }

    public static function delete(?string $disk, ?string $path): void
    {
        if (!$path) {
            return;
        }

        Storage::disk($disk ?: 'local')->delete($path);
    }

    public static function exists(?string $disk, ?string $path): bool
    {
        if (!$path) {
            return false;
        }

        return Storage::disk($disk ?: 'local')->exists($path);
    }

    /**
     * @param  array<int, string>  $fallbackDisks
     */
    public static function resolveExistingDisk(?string $preferredDisk, string $path, array $fallbackDisks = []): ?string
    {
        $candidateDisks = array_values(array_unique(array_filter(
            array_merge([$preferredDisk], $fallbackDisks),
            static fn ($disk): bool => is_string($disk) && trim($disk) !== ''
        )));

        foreach ($candidateDisks as $disk) {
            if (Storage::disk($disk)->exists($path)) {
                return $disk;
            }
        }

        return null;
    }

    /**
     * @param  array<int, string>  $fallbackDisks
     */
    public static function stream(
        ?string $preferredDisk,
        string $path,
        ?string $originalFilename = null,
        ?string $mimeType = null,
        string $disposition = 'inline',
        array $fallbackDisks = []
    ): StreamedResponse {
        $disk = self::resolveExistingDisk($preferredDisk, $path, $fallbackDisks);

        if (!$disk) {
            abort(404, 'Media file tidak ditemukan.');
        }

        $stream = Storage::disk($disk)->readStream($path);
        if ($stream === false) {
            abort(404, 'Media file tidak dapat dibaca.');
        }

        $resolvedMimeType = $mimeType ?: (Storage::disk($disk)->mimeType($path) ?: 'application/octet-stream');
        $contentLength = Storage::disk($disk)->size($path);
        $downloadName = self::sanitizeDownloadFilename($originalFilename ?: basename($path));
        $dispositionValue = in_array($disposition, ['inline', 'attachment'], true) ? $disposition : 'inline';

        return response()->stream(function () use ($stream): void {
            fpassthru($stream);
            fclose($stream);
        }, 200, array_filter([
            'Content-Type' => $resolvedMimeType,
            'Content-Length' => $contentLength ?: null,
            'Content-Disposition' => sprintf('%s; filename="%s"', $dispositionValue, $downloadName),
            'Cache-Control' => 'private, max-age=0, must-revalidate',
            'X-Content-Type-Options' => 'nosniff',
        ]));
    }

    public static function safeVersion(mixed $value): ?string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('c');
        }

        if ($value === null) {
            return null;
        }

        $stringValue = trim((string) $value);

        return $stringValue === '' ? null : $stringValue;
    }

    public static function sanitizeDownloadFilename(string $filename): string
    {
        $baseName = basename(str_replace('\\', '/', $filename));
        $stem = (string) pathinfo($baseName, PATHINFO_FILENAME);
        $extension = (string) pathinfo($baseName, PATHINFO_EXTENSION);

        return self::buildSanitizedFilename($stem !== '' ? $stem : $baseName, $extension !== '' ? $extension : null);
    }

    private static function buildSanitizedFilename(string $stem, ?string $extension = null): string
    {
        $cleanStem = self::sanitizeFilenameStem($stem);
        $cleanExtension = self::normalizeExtension($extension);

        if ($cleanExtension === '') {
            $trimmed = mb_strimwidth($cleanStem, 0, self::MAX_FILENAME_LENGTH, '');

            return $trimmed !== '' ? $trimmed : self::DEFAULT_FILENAME;
        }

        $maxStemLength = max(1, self::MAX_FILENAME_LENGTH - strlen($cleanExtension) - 1);
        $trimmedStem = mb_strimwidth($cleanStem, 0, $maxStemLength, '');

        return ($trimmedStem !== '' ? $trimmedStem : self::DEFAULT_FILENAME).'.'.$cleanExtension;
    }

    private static function sanitizeFilenameStem(string $value): string
    {
        $clean = Str::of($value)
            ->replaceMatches('/[\x00-\x1F\x7F]+/u', ' ')
            ->replace(['.', '/', '\\', '"'], ' ')
            ->ascii()
            ->replaceMatches('/[^A-Za-z0-9 _-]+/', ' ')
            ->squish()
            ->trim(' _-')
            ->value();

        return $clean !== '' ? $clean : self::DEFAULT_FILENAME;
    }

    private static function normalizeExtension(?string $extension): string
    {
        return preg_replace('/[^a-z0-9]+/', '', strtolower((string) $extension)) ?: '';
    }
}
