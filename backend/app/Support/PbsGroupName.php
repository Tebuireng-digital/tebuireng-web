<?php

namespace App\Support;

class PbsGroupName
{
    public static function normalize(string $name): string
    {
        $normalized = trim((string) preg_replace('/\s+/u', ' ', $name));

        if (preg_match('/^(?:KEL\.?\s*)?([ABC])\s*(\d+)$/iu', $normalized, $matches)) {
            return strtoupper($matches[1]).' '.(int) $matches[2];
        }

        return $normalized;
    }
}
