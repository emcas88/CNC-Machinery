# CNC-Machinery — Development Makefile
# ──────────────────────────────────────────────────────────────────────────────
# Usage:  make <target>
# Requires: docker, docker compose
# Optional: cargo, npm, sqlx-cli, cargo-llvm-cov (for local development)
# ──────────────────────────────────────────────────────────────────────────────

.DEFAULT_GOAL := help
.PHONY: help dev dev-docker dev-local \
        test test-backend test-frontend \
        lint lint-backend lint-frontend \
        fmt fmt-backend fmt-frontend fmt-check \
        build build-backend build-frontend \
        check \
        docker-up docker-down docker-build docker-logs docker-ps \
        migrate migrate-new migrate-revert migrate-status \
        coverage coverage-backend coverage-frontend coverage-check \
        clean clean-all seed setup

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT_DIR   := $(shell pwd)
BACKEND    := $(ROOT_DIR)/backend
FRONTEND   := $(ROOT_DIR)/frontend
SCRIPTS    := $(ROOT_DIR)/scripts
MIGRATIONS := $(ROOT_DIR)/migrations

# ── Database (can be overridden via env) ──────────────────────────────────────
DATABASE_URL ?= postgres://cnc_user:cnc_password@localhost:5432/cnc_machinery

# ── Coverage threshold ────────────────────────────────────────────────────────
COVERAGE_THRESHOLD ?= 85

# ─────────────────────────────────────────────────────────────────────────────
# help — print available targets
# ─────────────────────────────────────────────────────────────────────────────
help: ## Show this help
	@echo ""
	@echo "CNC-Machinery — available make targets"
	@echo "────────────────────────────────────────"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────────────────────────────────────
setup: ## First-time setup: copy .env, start infra, install frontend deps
	@echo "→ Setting up development environment..."
	@test -f .env || (cp .env.example .env && echo "  Created .env from .env.example")
	@echo "  Starting infrastructure (Postgres, Redis, MinIO)..."
	docker compose up -d db redis minio
	@echo "  Waiting for Postgres to be healthy..."
	@until docker compose exec -T db pg_isready -U cnc_user -d cnc_machinery >/dev/null 2>&1; do sleep 1; done
	@echo "  Installing frontend dependencies..."
	cd $(FRONTEND) && npm install
	@echo ""
	@echo "✓ Setup complete. Run 'make dev' to start development."

# ─────────────────────────────────────────────────────────────────────────────
# Development
# ─────────────────────────────────────────────────────────────────────────────
dev: dev-local ## Start full dev environment (alias for dev-local)

dev-local: ## Start infra in Docker + backend/frontend locally with hot reload
	@echo "→ Starting infrastructure services..."
	docker compose up -d db redis minio
	@echo "→ Waiting for Postgres to be healthy..."
	@until docker compose exec -T db pg_isready -U cnc_user -d cnc_machinery >/dev/null 2>&1; do sleep 1; done
	@echo "→ Starting backend and frontend in parallel..."
	@trap 'kill 0' SIGINT; \
	  (cd $(BACKEND) && DATABASE_URL=$(DATABASE_URL) SQLX_OFFLINE=true cargo run) & \
	  (cd $(FRONTEND) && npm run dev) & \
	  wait

dev-docker: ## Start everything in Docker (no local toolchains required)
	@echo "→ Starting all services via Docker Compose..."
	docker compose up --build

# ─────────────────────────────────────────────────────────────────────────────
# Testing
# ─────────────────────────────────────────────────────────────────────────────
test: test-backend test-frontend ## Run all tests (backend + frontend)

test-backend: ## Run Rust backend tests (requires Postgres running)
	@echo "→ Running backend tests..."
	cd $(BACKEND) && DATABASE_URL=$(DATABASE_URL) SQLX_OFFLINE=true cargo test --all-features -- --test-threads=1

test-frontend: ## Run frontend tests (Vitest)
	@echo "→ Running frontend tests..."
	cd $(FRONTEND) && npm test

# ─────────────────────────────────────────────────────────────────────────────
# Linting & formatting
# ─────────────────────────────────────────────────────────────────────────────
lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Run cargo clippy
	@echo "→ Linting backend..."
	cd $(BACKEND) && SQLX_OFFLINE=true cargo clippy --all-targets --all-features -- -D warnings

lint-frontend: ## Run ESLint on frontend
	@echo "→ Linting frontend..."
	cd $(FRONTEND) && npm run lint

fmt: fmt-backend fmt-frontend ## Auto-format all code

fmt-backend: ## cargo fmt
	cd $(BACKEND) && cargo fmt --all

fmt-frontend: ## Prettier on frontend (falls back to lint --fix)
	@echo "→ Formatting frontend..."
	@cd $(FRONTEND) && \
	  if npm run --silent 2>/dev/null | grep -q '^  format$$'; then \
	    npm run format; \
	  else \
	    echo "  'format' script not found, running eslint --fix instead"; \
	    npx eslint . --ext ts,tsx --fix 2>/dev/null || true; \
	  fi

fmt-check: ## Check formatting without modifying files
	@echo "→ Checking backend formatting..."
	cd $(BACKEND) && cargo fmt --all -- --check
	@echo "→ Checking frontend types..."
	cd $(FRONTEND) && npm run type-check

check: fmt-check lint ## Run all static checks (fmt + lint)

# ─────────────────────────────────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────────────────────────────────
build: build-backend build-frontend ## Build backend and frontend for production

build-backend: ## Build backend in release mode (SQLX_OFFLINE=true for no-DB builds)
	@echo "→ Building backend (release)..."
	cd $(BACKEND) && SQLX_OFFLINE=true cargo build --release

build-frontend: ## Build frontend for production
	@echo "→ Building frontend..."
	cd $(FRONTEND) && npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Docker
# ─────────────────────────────────────────────────────────────────────────────
docker-up: ## Start all services with docker compose (detached)
	@echo "→ Starting Docker services..."
	docker compose up -d

docker-down: ## Stop all Docker services
	@echo "→ Stopping Docker services..."
	docker compose down

docker-build: ## Build Docker images locally
	@echo "→ Building Docker images..."
	docker compose build

docker-logs: ## Tail logs from all Docker services
	docker compose logs -f

docker-ps: ## Show running Docker services
	docker compose ps

# ─────────────────────────────────────────────────────────────────────────────
# Database migrations (sqlx-cli required: cargo install sqlx-cli)
# ─────────────────────────────────────────────────────────────────────────────
migrate: ## Run all pending database migrations
	@echo "→ Running migrations (source: $(MIGRATIONS))..."
	DATABASE_URL=$(DATABASE_URL) sqlx migrate run --source $(MIGRATIONS)

migrate-new: ## Create a new migration (usage: make migrate-new NAME=create_users)
ifndef NAME
	$(error NAME is required — e.g. make migrate-new NAME=create_users)
endif
	sqlx migrate add --source $(MIGRATIONS) $(NAME)

migrate-revert: ## Revert the last applied migration
	@echo "→ Reverting last migration..."
	DATABASE_URL=$(DATABASE_URL) sqlx migrate revert --source $(MIGRATIONS)

migrate-status: ## Show migration status
	DATABASE_URL=$(DATABASE_URL) sqlx migrate info --source $(MIGRATIONS)

# ─────────────────────────────────────────────────────────────────────────────
# Seed
# ─────────────────────────────────────────────────────────────────────────────
seed: ## Run database seed script
	@echo "→ Running seed data..."
	$(SCRIPTS)/seed.sh

# ─────────────────────────────────────────────────────────────────────────────
# Coverage
# ─────────────────────────────────────────────────────────────────────────────
coverage: coverage-backend coverage-frontend ## Generate coverage reports for everything

coverage-backend: ## Run backend tests with llvm-cov and open HTML report
	@echo "→ Generating backend coverage..."
	cd $(BACKEND) && DATABASE_URL=$(DATABASE_URL) SQLX_OFFLINE=true \
	  cargo llvm-cov \
	    --all-features \
	    --html \
	    --open \
	    --output-dir target/coverage \
	    -- --test-threads=1

coverage-frontend: ## Run frontend tests with coverage (Vitest)
	@echo "→ Generating frontend coverage..."
	cd $(FRONTEND) && npx vitest run --coverage

coverage-check: ## Validate coverage meets $(COVERAGE_THRESHOLD)% threshold
	@echo "→ Checking coverage threshold ($(COVERAGE_THRESHOLD)%)..."
	$(SCRIPTS)/check-coverage.sh $(COVERAGE_THRESHOLD)

# ─────────────────────────────────────────────────────────────────────────────
# Clean
# ─────────────────────────────────────────────────────────────────────────────
clean: ## Remove build artefacts (keeps Docker volumes)
	cd $(BACKEND) && cargo clean
	rm -rf $(FRONTEND)/dist $(FRONTEND)/coverage $(FRONTEND)/.next

clean-all: clean docker-down ## Remove build artefacts AND Docker volumes
	docker compose down -v --remove-orphans
	docker image prune -f
