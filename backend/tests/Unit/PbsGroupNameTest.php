<?php

namespace Tests\Unit;

use App\Support\PbsGroupName;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class PbsGroupNameTest extends TestCase
{
    #[DataProvider('names')]
    public function test_it_normalizes_regular_group_names(string $source, string $expected): void
    {
        $this->assertSame($expected, PbsGroupName::normalize($source));
    }

    public static function names(): array
    {
        return [
            ['A1', 'A 1'],
            ['A 12', 'A 12'],
            ['KEL. B 1', 'B 1'],
            ['KEL.B10', 'B 10'],
            ['Kel. C 03', 'C 3'],
            ['TAHFIDZ 1', 'TAHFIDZ 1'],
        ];
    }
}
