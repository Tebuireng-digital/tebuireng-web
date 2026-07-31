<?php

namespace App\Support;

class KamarName
{
    /**
     * Memisahkan nama bangunan dan nomor kamar tanpa mengubah data master asli.
     * Contoh: "Gus Dur 201" menjadi "Gus Dur_201".
     */
    public static function parse(string $name): array
    {
        $normalized = trim((string) preg_replace('/\s+/u', ' ', $name));

        if (preg_match('/^(.+?)\s+(\d+|[IVXLCDM]+|BAWAH)$/iu', $normalized, $matches)) {
            $category = trim($matches[1]);
            $number = strtoupper($matches[2]);

            return [
                'kategori' => $category,
                'nomor' => $number,
                'standar' => $category.'_'.$number,
            ];
        }

        return [
            'kategori' => $normalized,
            'nomor' => null,
            'standar' => $normalized,
        ];
    }
}
