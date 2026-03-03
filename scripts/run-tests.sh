#!/usr/bin/env bash
# scripts/run-tests.sh
# ─────────────────────────────────────────────────────────────────────────────
# Run backend (Rust) and frontend (Node) tests locally.
#
# Usage:
#   ./scripts/run-tests.sh               # run both
#   ./scripts/run-tests.sh --backend    # run only backend tests
#   ./scripts/run-tests.sh --frontend   # run only frontend tests
#   ./scripts/run-tests.sh --coverage   # run both with coverage
#
# Environment variables (all optional — sensible defaults provided):
#   DATABASE_URL    — Postgres connection string for backend tests
#   BACKEND_DIR     — Path to the Rust workspace (default: ./backend)
#   FRONTEND_DIR    — Path to the Node project  (default: ./frontend)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colour helpers ─────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()     { echo -e "${CYAN}${BOLD}[run-tests]${RESET} $*"; }
success() { echo -e "${GREEN}${BOLD}✔  $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠   $*${RESET}"; }
error()   { echo -e "${RED}${BOLD}✘  $*${RESET}" >&2; }

# ── Defaults ───────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKEND_DIR="${BACKEND_DIR:-${ROOT_DIR}/backend}"
FRONTEND_DIR="${FRONTEND_DIR:-${ROOT_DIR}/frontend}"
DATABASE_URL="${DATABASE_URL:-postgres://cnc_user:cnc_password@localhost:5432/cnc_machinery}"

RUN_BACKEND=true
RUN_FRONTEND=true
WITH_COVERAGE=false

# ── Argument parsing ───────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend)   RUN_FRONTEND=false ;;
    --frontend)  RUN_BACKEND=false  ;;
    --coverage)  WITH_COVERAGE=true ;;
    --help|-h)
      sed -n '2,/^[^#]/p' "$0" | grep '^#' | sed 's/^# \{0,2\}//'
      exit 0
      ;;
    *)
      error "Unknown option: $1  (use --help for usage)"
      exit 1
      ;;
  esac
  shift
done

# ── Prerequisite checks ───────────────────────────────────────────────────
need_cmd() {
  if ! command -v "$1" &>/dev/null; then
    error "Required command not found: $1"
    exit 1
  fi
}

$RUN_BACKEND  && { need_cmd cargo; need_cmd sqlx || warn "sqlx-cli not found — skipping migration check"; }
$RUN_FRONTEND && { need_cmd node; need_cmd npm; }
$WITH_COVERAGE && $RUN_BACKEND && need_cmd cargo-llvm-cov 2>/dev/null \
  || true  # non-fatal; we check properly below

PASS=0
FAIL=0

# ─────────────────────────────────────────────────────────────────────────────
# Backend tests
# ─────────────────────────────────────────────────────────────────────────────
run_backend_tests() {
  log "Running Rust backend tests..."
  cd "${BACKEND_DIR}"

  # Run pending migrations if sqlx is available
  if command -v sqlx &>/dev/null; then
    log "Applying pending migrations..."
    DATABASE_URL="${DATABASE_URL}" sqlx migrate run \
      && success "Migrations OK" \
      || warn "Migration failed — tests may fail if schema is stale"
  fi

  if $WITH_COVERAGE; then
    if ! command -v cargo-llvm-cov &>/dev/null; then
      warn "cargo-llvm-cov not installed. Install with: cargo install cargo-llvm-cov"
      warn "Falling back to plain cargo test..."
    else
      log "Running with llvm-cov coverage..."
      DATABASE_URL="${DATABASE_URL}" \
        cargo llvm-cov \
          --all-features \
          --workspace \
          --lcov \
          --output-path lcov.info \
          --html \
          --output-dir target/coverage \
        && success "Backend tests + coverage passed" \
        && log "  HTML report: ${BACKEND_DIR}/target/coverage/index.html" \
        && { PASS=$((PASS + 1)); return 0; } \
        || { error "Backend tests FAILED"; FAIL=$((FAIL + 1)); return 1; }
    fi
  fi

  DATABASE_URL="${DATABASE_URL}" \
    cargo test --all-features --workspace \
    && success "Backend tests passed" \
    && PASS=$((PASS + 1)) \
    || { error "Backend tests FAILED"; FAIL=$((FAIL + 1)); return 1; }
}

# ─────────────────────────────────────────────────────────────────────────────
# Frontend tests
# ─────────────────────────────────────────────────────────────────────────────
run_frontend_tests() {
  log "Running frontend tests..."
  cd "${FRONTEND_DIR}"

  if [ ! -d node_modules ]; then
    log "node_modules not found — running npm ci..."
    npm ci
  fi

  local EXTRA_ARGS="--watchAll=false --ci"
  if $WITH_COVERAGE; then
    EXTRA_ARGS="${EXTRA_ARGS} --coverage --coverageReporters=text --coverageReporters=lcov --coverageReporters=json-summary"
  fi

  # shellcheck disable=SC2086
  npm test -- ${EXTRA_ARGS} \
    && success "Frontend tests passed" \
    && PASS=$((PASS + 1)) \
    || { error "Frontend tests FAILED"; FAIL=$((FAIL + 1)); return 1; }
}

# ─────────────────────────────────────────────────────────────────────────────
# Execution
# ─────────────────────────────────────────────────────────────────────────────
START=$(date +%s)

$RUN_BACKEND  && run_backend_tests  || true
$RUN_FRONTEND && run_frontend_tests || true

END=$(date +%s)
ELAPSED=$((END - START))

echo ""
echo -e "${BOLD}─────────────────────────────────────────${RESET}"
echo -e "${BOLD}Test Summary  (${ELAPSED}s)${RESET}"
echo -e "  ${GREEN}Passed: ${PASS}${RESET}"
if [ "${FAIL}" -gt 0 ]; then
  echo -e "  ${RED}Failed: ${FAIL}${RESET}"
fi
echo -e "${BOLD}─────────────────────────────────────────${RESET}"

if [ "${FAIL}" -gt 0 ]; then
  exit 1
fi

if $WITH_COVERAGE; then
  log "Running coverage threshold check..."
  "${SCRIPT_DIR}/check-coverage.sh" || exit 1
fi
