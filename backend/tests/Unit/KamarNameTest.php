<?php

namespace Tests\Unit;

use App\Support\KamarName;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class KamarNameTest extends TestCase
{
    #[DataProvider('roomNames')]
    public function test_it_standardizes_room_names(string $original, string $category, ?string $number, string $standard): void
    {
        $this->assertSame([
            'kategori' => $category,
            'nomor' => $number,
            'standar' => $standard,
        ], KamarName::parse($original));
    }

    public static function roomNames(): array
    {
        return [
            ['Gus Dur 201', 'Gus Dur', '201', 'Gus Dur_201'],
            ['KH. A. Baidlowi 310', 'KH. A. Baidlowi', '310', 'KH. A. Baidlowi_310'],
            ['Kiyai Karim II', 'Kiyai Karim', 'II', 'Kiyai Karim_II'],
            ['K BAWAH', 'K', 'BAWAH', 'K_BAWAH'],
            ['Nama Tanpa Nomor', 'Nama Tanpa Nomor', null, 'Nama Tanpa Nomor'],
        ];
    }
}
