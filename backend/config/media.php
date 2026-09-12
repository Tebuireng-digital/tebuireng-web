<?php

return [
    'pelanggaran_attachment' => [
        'disk' => 'local',
        'directory' => 'pelanggaran_lampiran',
        'image' => true,
        'mimes' => ['jpg', 'jpeg', 'png', 'webp'],
        'mime_types' => ['image/jpeg', 'image/pjpeg', 'image/jpg', 'image/png', 'image/webp'],
        'max_kilobytes' => 1024,
        'fallback_read_disks' => [],
    ],
    'santri_photo' => [
        'disk' => 'local',
        'directory' => 'santri_foto',
        'image' => true,
        'mimes' => ['jpg', 'jpeg', 'png', 'webp'],
        'mime_types' => ['image/jpeg', 'image/pjpeg', 'image/jpg', 'image/png', 'image/webp'],
        'max_kilobytes' => 1024,
        'fallback_read_disks' => ['public'],
    ],
];
