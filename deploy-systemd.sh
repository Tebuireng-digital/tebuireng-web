#!/usr/bin/env bash
set -Eeuo pipefail

SERVICE_NAME="tebuireng.service"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
COMPOSE_FILE="${SCRIPT_DIR}/compose.production.yaml"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env.production}"
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}"
ACTION="${1:-deploy}"

log() {
  printf '[tebuireng] %s\n' "$*"
}

fail() {
  printf '[tebuireng] ERROR: %s\n' "$*" >&2
  exit 1
}

require_root() {
  [[ "${EUID}" -eq 0 ]] || fail "Jalankan dengan sudo: sudo $0 ${ACTION}"
}

require_commands() {
  local command_name
  for command_name in docker systemctl openssl; do
    command -v "${command_name}" >/dev/null 2>&1 || fail "Perintah '${command_name}' belum terpasang."
  done
  docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin belum terpasang."
  [[ -f "${COMPOSE_FILE}" ]] || fail "File tidak ditemukan: ${COMPOSE_FILE}"
}

create_environment() {
  local public_url host_name
  public_url="${PUBLIC_URL:-}"

  if [[ -z "${public_url}" ]]; then
    fail "${ENV_FILE} belum ada. Jalankan sekali dengan PUBLIC_URL, contoh: sudo PUBLIC_URL=https://absensi.example.org $0 deploy"
  fi
  [[ "${public_url}" =~ ^https?://[^/]+$ ]] || fail "PUBLIC_URL harus berupa URL tanpa garis miring di akhir."

  host_name="${public_url#*://}"
  umask 077
  {
    printf 'APP_KEY=base64:%s\n' "$(openssl rand -base64 32 | tr -d '\n')"
    printf 'APP_URL=%s\n' "${public_url}"
    printf 'FRONTEND_URL=%s\n' "${public_url}"
    printf 'SANCTUM_STATEFUL_DOMAINS=%s\n' "${host_name}"
    printf '\nDB_DATABASE=absensi_santri\n'
    printf 'DB_USERNAME=tebuireng\n'
    printf 'DB_PASSWORD=%s\n' "$(openssl rand -hex 32)"
    printf 'MYSQL_ROOT_PASSWORD=%s\n' "$(openssl rand -hex 32)"
    printf '\nHTTP_PORT=%s\n' "${HTTP_PORT:-8080}"
  } > "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  log "Environment production dibuat di ${ENV_FILE}."
}

ensure_environment() {
  [[ -f "${ENV_FILE}" ]] || create_environment
  chmod 600 "${ENV_FILE}"

  if grep -Eq '^[A-Z0-9_]+=[[:space:]]*$|https://absensi\.example\.org' "${ENV_FILE}"; then
    fail "Lengkapi nilai production di ${ENV_FILE}; nilai kosong atau domain contoh masih ditemukan."
  fi

  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" config --quiet
}

compose() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

install_unit() {
  local docker_path temporary_unit
  docker_path="$(command -v docker)"
  temporary_unit="$(mktemp)"

  cat > "${temporary_unit}" <<EOF
[Unit]
Description=Tebuireng frontend, backend, database, and migration
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${SCRIPT_DIR}
TimeoutStartSec=15min
TimeoutStopSec=2min
ExecStartPre=${docker_path} compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE} config --quiet
ExecStartPre=${docker_path} compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE} up -d mysql
ExecStartPre=${docker_path} compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE} --profile tools run --rm migrate
ExecStart=${docker_path} compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE} up -d --remove-orphans mysql backend backend-web frontend
ExecStop=${docker_path} compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE} stop

[Install]
WantedBy=multi-user.target
EOF

  install -m 0644 "${temporary_unit}" "${UNIT_FILE}"
  rm -f "${temporary_unit}"
  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}" >/dev/null
  log "Unit systemd terpasang: ${UNIT_FILE}"
}

deploy() {
  systemctl enable --now docker.service >/dev/null
  ensure_environment
  docker volume inspect tebuireng_mysql_data >/dev/null 2>&1 || docker volume create tebuireng_mysql_data >/dev/null

  log "Membangun image frontend dan backend..."
  compose build --pull
  install_unit

  log "Menjalankan database, migrasi, backend, dan frontend..."
  systemctl restart "${SERVICE_NAME}"
  compose ps
  log "Deployment selesai. Cek readiness pada /ready melalui domain aplikasi."
}

run_migration() {
  ensure_environment
  compose up -d mysql
  compose --profile tools run --rm migrate
}

show_usage() {
  cat <<EOF
Pemakaian: sudo $0 [perintah]

Perintah:
  deploy   Build, pasang/update systemd, migrasi, lalu start (default)
  start    Menyalakan seluruh stack melalui systemd
  stop     Menghentikan seluruh stack tanpa menghapus volume
  restart  Menjalankan ulang stack dan migrasi
  migrate  Menjalankan migrasi database saja
  status   Menampilkan status systemd dan container
  logs     Mengikuti log seluruh container

Deployment pertama:
  sudo PUBLIC_URL=https://domain-anda.example $0 deploy
EOF
}

if [[ "${ACTION}" == "help" || "${ACTION}" == "-h" || "${ACTION}" == "--help" ]]; then
  show_usage
  exit 0
fi

require_root
require_commands

case "${ACTION}" in
  deploy|install)
    deploy
    ;;
  start|stop|restart)
    systemctl "${ACTION}" "${SERVICE_NAME}"
    ;;
  migrate)
    run_migration
    ;;
  status)
    systemctl --no-pager --full status "${SERVICE_NAME}" || true
    if [[ -f "${ENV_FILE}" ]]; then
      compose ps
    fi
    ;;
  logs)
    ensure_environment
    compose logs --tail=200 --follow mysql backend backend-web frontend
    ;;
  *)
    show_usage >&2
    exit 2
    ;;
esac
