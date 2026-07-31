#!/bin/sh
set -eu

current_package_lock="image-v1:$(sha256sum package-lock.json | cut -d ' ' -f 1)"
installed_package_lock="$(cat node_modules/.tebuireng-package-lock.sha256 2>/dev/null || true)"

if [ ! -x node_modules/.bin/vite ] || [ "$current_package_lock" != "$installed_package_lock" ]; then
    echo "Menyinkronkan volume npm dari dependency image..."
    find /app/node_modules -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
    cp -a /opt/tebuireng/frontend/node_modules/. /app/node_modules/
fi

exec "$@"
