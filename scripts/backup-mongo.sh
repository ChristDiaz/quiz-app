#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
set -a
source "$ENV_FILE"
set +a

if [ -z "${MONGO_ROOT_USERNAME:-}" ] || [ -z "${MONGO_ROOT_PASSWORD:-}" ]; then
  echo "MONGO_ROOT_USERNAME and MONGO_ROOT_PASSWORD must be set in $ENV_FILE" >&2
  exit 1
fi

TIMESTAMP="$(date +%F-%H%M%S)"
TARGET_FILE="$BACKUP_DIR/mongo-$TIMESTAMP.archive.gz"

echo "Creating backup at $TARGET_FILE"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mongo \
  mongodump \
    --username "$MONGO_ROOT_USERNAME" \
    --password "$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --archive \
    --gzip > "$TARGET_FILE"

echo "Pruning backups older than $KEEP_DAYS days"
find "$BACKUP_DIR" -type f -name "mongo-*.archive.gz" -mtime +"$KEEP_DAYS" -delete

echo "Backup complete."

