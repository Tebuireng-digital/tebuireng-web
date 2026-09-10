<?php

return [
    'pelanggaran_attachment' => [
        'disk' => 'local',
        'directory' => 'pelanggaran_lampiran',
        'image' => true,
        'mimes' => ['jpg', 'jpeg', 'png', 'webp'],
        'max_kilobytes' => 5120,
        'fallback_read_disks' => [],
    ],
    'santri_photo' => [
        'disk' => 'local',
        'directory' => 'santri_foto',
        'image' => true,
        'mimes' => ['jpg', 'jpeg', 'png', 'webp'],
        'max_kilobytes' => 5120,
        'fallback_read_disks' => ['public'],
    ],
];
