<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Rate Limiter
        \Illuminate\Support\Facades\RateLimiter::for('login', function (\Illuminate\Http\Request $request) {
            return \Illuminate\Cache\RateLimiting\Limit::perMinute(5)->by($request->ip());
        });

        \Illuminate\Support\Facades\RateLimiter::for('bulk-input', function (\Illuminate\Http\Request $request) {
            return \Illuminate\Cache\RateLimiting\Limit::perMinute(10)->by($request->user()?->petugas_id ?: $request->ip());
        });

        // Observers
        \App\Models\Absensi::observe(\App\Observers\GenericLogObserver::class);
        \App\Models\Pelanggaran::observe(\App\Observers\GenericLogObserver::class);
        \App\Models\Perizinan::observe(\App\Observers\GenericLogObserver::class);
        \App\Models\PerizinanApproval::observe(\App\Observers\GenericLogObserver::class);

        \Illuminate\Support\Facades\Event::listen(
            \App\Events\PerizinanDisetujui::class,
            \App\Listeners\UpsertAbsensiIzin::class
        );
    }
}
