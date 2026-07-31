# syntax=docker/dockerfile:1.7
FROM php:8.3-cli

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        unzip \
        libfreetype6-dev \
        libicu-dev \
        libjpeg62-turbo-dev \
        libonig-dev \
        libpng-dev \
        libzip-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" bcmath gd intl mbstring pdo_mysql zip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Database pengujian memakai SQLite in-memory agar tidak menyentuh data lokal.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libsqlite3-dev \
    && docker-php-ext-install -j"$(nproc)" pdo_sqlite \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN --mount=type=cache,target=/tmp/composer-cache,sharing=locked \
    COMPOSER_CACHE_DIR=/tmp/composer-cache \
    composer install --no-interaction --prefer-dist --no-progress --no-scripts \
    && sha256sum composer.lock | cut -d ' ' -f 1 > vendor/.tebuireng-composer-lock.sha256 \
    && chown -R 1000:1000 vendor

COPY docker/entrypoint.sh /usr/local/bin/tebuireng-entrypoint
RUN chmod +x /usr/local/bin/tebuireng-entrypoint

ENTRYPOINT ["tebuireng-entrypoint"]
