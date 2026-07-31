#!/bin/sh
set -eu

mkdir -p \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

current_composer_lock="$(sha256sum composer.lock | cut -d ' ' -f 1)"
installed_composer_lock="$(cat vendor/.tebuireng-composer-lock.sha256 2>/dev/null || true)"

if [ ! -f vendor/autoload.php ] || [ "$current_composer_lock" != "$installed_composer_lock" ]; then
    echo "Menyinkronkan dependency Composer karena composer.lock berubah..."
    composer install --no-interaction --prefer-dist --no-progress
    printf '%s\n' "$current_composer_lock" > vendor/.tebuireng-composer-lock.sha256
fi

if [ "${DB_CONNECTION:-mysql}" = "mysql" ]; then
until php -r '
try {
    new PDO(
        "mysql:host=".getenv("DB_HOST").";port=".getenv("DB_PORT").";dbname=".getenv("DB_DATABASE"),
        getenv("DB_USERNAME"),
        getenv("DB_PASSWORD")
    );
    exit(0);
} catch (Throwable $exception) {
    exit(1);
}
'; do
    echo "Menunggu MySQL..."
    sleep 2
done
fi

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
    php artisan migrate --force
fi

exec "$@"
