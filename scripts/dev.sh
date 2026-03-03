#!/usr/bin/env bash
set -euo pipefail

# CNC Machinery - Development startup script
# Starts all services using Docker Compose

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "Starting CNC Machinery development environment..."

# Check Docker is running
if ! docker info &>/dev/null; then
  echo "Error: Docker is not running. Please start Docker and try again."
  exit 1
fi

# Check docker compose (plugin) / docker-compose (standalone)
if docker compose version &>/dev/null; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
else
  echo "Error: docker-compose or docker compose not found."
  exit 1
fi

echo "Using compose command: $COMPOSE_CMD"

# Pull latest images and rebuild if needed
$COMPOSE_CMD pull --quiet
$COMPOSE_CMD up --build -d

echo ""
echo "Services started:"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:8080"
echo "  Swagger:   http://localhost:8080/swagger/index.html"
echo "  pgAdmin:   http://localhost:5050"
echo ""
echo "Run '$COMPOSE_CMD logs -f' to follow logs."
