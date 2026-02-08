#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd docker

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  echo "Create it from .env.production.example before deploying." >&2
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Missing compose file: $COMPOSE_FILE" >&2
  exit 1
fi

echo "Pulling latest images..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull --policy always

echo "Applying deployment..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --wait --remove-orphans

echo "Production stack status:"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

