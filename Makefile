# CNC-Machinery — Development Makefile
# ──────────────────────────────────────────────────────────────────────────────
# Usage:  make <target>
# Requires: cargo, npm, docker, docker compose, sqlx-cli, cargo-llvm-cov
# ──────────────────────────────────────────────────────────────────────────────

.DEFAULT_GOAL := help
.PHONY: help dev test lint build fmt check \
        docker-up docker-down docker-build docker-logs \
        migrate migrate-new migrate-revert \
        coverage coverage-backend coverage-frontend \
        clean clean-all

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT_DIR  := $(shell pwd)
BACKEND   := $(ROOT_DIR)/backend
FRONTEND  := $(ROOT_DIR)/frontend
SCRIPTS   := $(ROOT_DIR)/scripts

# ── Database (can be overridden via env) ──────────────────────────────────────
DATABASE_URL ?= postgres://cnc_user:cnc_password@localhost:5432/cnc_machinery

# ── Coverage threshold ────────────────────────────────────────────────────────
COVERAGE_THRESHOLD ?= 85

# ─────────────────────────────────────────────────────────────────────────────
# help — print available targets
# ─────────────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "CNC-Machinery — available make targets"
	@echo "────────────────────────────────────────"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Development
# ─────────────────────────────────────────────────────────────────────────────
dev: docker-up migrate ## Start full dev environment (Docker + migrations + hot reload)
	@echo "Starting backend and frontend in parallel..."
	@trap 'kill 0' SIGINT; \
	  (cd $(BACKEND) && DATABASE_URL=$(DATABASE_URL) cargo run) & \
	  (cd $(FRONTEND) && npm run dev) & \
	  wait

# ─────────────────────────────────────────────────────────────────────────────
# Testing
# ─────────────────────────────────────────────────────────────────────────────
test: test-backend test-frontend ## Run all tests (backend + frontend)

test-backend: ## Run Rust backend tests
	@echo "→ Running backend tests..."
	cd $(BACKEND) && DATABASE_URL=$(DATABASE_URL) cargo test --all-features --workspace

test-frontend: ## Run frontend tests
	@echo "→ Running frontend tests..."
	cd $(FRONTEND) && npm test -- --watchAll=false --ci

# ─────────────────────────────────────────────────────────────────────────────
# Linting & formatting
# ─────────────────────────────────────────────────────────────────────────────
lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Run cargo clippy
	@echo "→ Linting backend..."
	cd $(BACKEND) && cargo clippy --all-targets --all-features -- -D warnings

lint-frontend: ## Run ESLint on frontend
	@echo "→ Linting frontend..."
	cd $(FRONTEND) && npm run lint

fmt: fmt-backend fmt-frontend ## Auto-format all code

fmt-backend: ## cargo fmt
	cd $(BACKEND) && cargo fmt --all

fmt-frontend: ## Prettier on frontend
	cd $(FRONTEND) && npm run format

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

build-backend: ## cargo build --release
	@echo "→ Building backend (release)..."
	cd $(BACKEND) && cargo build --release

build-frontend: ## npm run build
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
# Database migrations (sqlx)
# ─────────────────────────────────────────────────────────────────────────────
migrate: ## Run all pending database migrations
	@echo "→ Running migrations (DATABASE_URL=$(DATABASE_URL))..."
	cd $(BACKEND) && DATABASE_URL=$(DATABASE_URL) sqlx migrate run

migrate-new: ## Create a new migration  (usage: make migrate-new NAME=create_users)
ifndef NAME
	$(error NAME is required — e.g.  make migrate-new NAME=create_users)
endif
	cd $(BACKEND) && sqlx migrate add $(NAME)

migrate-revert: ## Revert the last applied migration
	@echo "→ Reverting last migration..."
	cd $(BACKEND) && DATABASE_URL=$(DATABASE_URL) sqlx migrate revert

migrate-status: ## Show migration status
	cd $(BACKEND) && DATABASE_URL=$(DATABASE_URL) sqlx migrate info

# ─────────────────────────────────────────────────────────────────────────────
# Coverage
# ─────────────────────────────────────────────────────────────────────────────
coverage: coverage-backend coverage-frontend ## Generate coverage reports for everything

coverage-backend: ## Run backend tests with llvm-cov and open HTML report
	@echo "→ Generating backend coverage..."
	cd $(BACKEND) && DATABASE_URL=$(DATABASE_URL) \
	  cargo llvm-cov \
	    --all-features \
	    --workspace \
	    --html \
	    --open \
	    --output-dir target/coverage

coverage-frontend: ## Run frontend tests with coverage
	@echo "→ Generating frontend coverage..."
	cd $(FRONTEND) && npm test -- \
	  --coverage \
	  --watchAll=false \
	  --ci \
	  --coverageReporters=html \
	  --coverageReporters=lcov \
	  --coverageReporters=json-summary

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
