<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    public function createApplication()
    {
        $app = parent::createApplication();

        // Validasi konfigurasi Laravel yang sudah di-bootstrap, bukan hanya env
        // PHPUnit. Pemeriksaan ini berjalan sebelum trait RefreshDatabase.
        $environment = $app->environment();
        $connection = $app['config']->get('database.default');
        $database = $app['config']->get("database.connections.{$connection}.database");

        if ($environment !== 'testing' || $connection !== 'sqlite' || $database !== ':memory:') {
            $app->flush();
            throw new \RuntimeException(
                'Test dibatalkan: wajib memakai APP_ENV=testing dan SQLite :memory:.'
            );
        }

        return $app;
    }
}
