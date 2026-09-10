<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MediaStorage
{
    /**
     * @return array{disk:string,directory:string,image:bool,mimes:array<int,string>,max_kilobytes:int,fallback_read_disks:array<int,string>}
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
        $extension = strtolower((string) ($file->guessExtension() ?: $file->extension() ?: $file->getClientOriginalExtension() ?: 'bin'));
        $fileName = Str::uuid().'.'.$extension;
        $path = $file->storeAs($config['directory'], $fileName, $disk);

        if (!$path) {
            throw new RuntimeException('File gagal disimpan ke media storage.');
        }

        $storedMimeType = $file->getMimeType()
            ?: $file->getClientMimeType()
            ?: (Storage::disk($disk)->mimeType($path) ?: 'application/octet-stream');
        $storedSize = (int) ($file->getSize() ?? Storage::disk($disk)->size($path) ?? 0);

        return [
            'disk' => $disk,
            'path' => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => (string) $storedMimeType,
            'size_bytes' => $storedSize,
            'sha256' => hash_file('sha256', $file->getRealPath()) ?: '',
        ];
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
        $clean = trim(str_replace(["\r", "\n", '"', '\\'], ' ', $filename));

        return $clean !== '' ? $clean : 'media-file';
    }
}
