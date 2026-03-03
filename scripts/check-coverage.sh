#!/usr/bin/env bash
# scripts/check-coverage.sh
# ─────────────────────────────────────────────────────────────────────────────
# Validates that backend (Rust) and frontend (Node) line-coverage meets the
# required threshold.  Exits non-zero if either component is below the bar.
#
# Usage:
#   ./scripts/check-coverage.sh [THRESHOLD]
#
#   THRESHOLD  — Integer or decimal percentage (default: 85)
#
# Prerequisites:
#   Backend  — cargo-llvm-cov must have already generated:
#                backend/target/coverage/lcov.info   (or backend/lcov.info)
#              OR backend/coverage-summary.json (llvm-cov --json output)
#
#   Frontend — Jest coverage must have already generated:
#                frontend/coverage/coverage-summary.json
#
# Exit codes:
#   0  All components meet the threshold
#   1  One or more components are below the threshold
#   2  Coverage data not found (run tests with coverage first)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colour helpers ─────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()     { echo -e "${CYAN}${BOLD}[coverage]${RESET} $*"; }
pass()    { echo -e "${GREEN}${BOLD}  ✔  $*${RESET}"; }
fail()    { echo -e "${RED}${BOLD}  ✘  $*${RESET}" >&2; }
warn()    { echo -e "${YELLOW}  ⚠  $*${RESET}"; }

# ── Configuration ─────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

THRESHOLD="${1:-85}"
BACKEND_DIR="${BACKEND_DIR:-${ROOT_DIR}/backend}"
FRONTEND_DIR="${FRONTEND_DIR:-${ROOT_DIR}/frontend}"

MISSING=0
BELOW=0

# ─────────────────────────────────────────────────────────────────────────────
# Utility: compare two decimal numbers using Python (avoids bash float issues)
# Returns 0 if A >= B, 1 otherwise
# ─────────────────────────────────────────────────────────────────────────────
gte() {
  python3 -c "import sys; sys.exit(0 if float('$1') >= float('$2') else 1)"
}

# ─────────────────────────────────────────────────────────────────────────────
# Utility: extract line-coverage % from an LCOV file
# Outputs a decimal like "87.34"
# ─────────────────────────────────────────────────────────────────────────────
lcov_line_pct() {
  local file="$1"
  python3 - "$file" <<'EOF'
import sys

found = 0
hit   = 0

with open(sys.argv[1]) as f:
    for line in f:
        line = line.strip()
        if line.startswith("LF:"):
            found += int(line[3:])
        elif line.startswith("LH:"):
            hit += int(line[3:])

if found == 0:
    print("0.00")
else:
    print(f"{hit / found * 100:.2f}")
EOF
}

# ─────────────────────────────────────────────────────────────────────────────
# Backend coverage
# ─────────────────────────────────────────────────────────────────────────────
check_backend() {
  log "Checking backend (Rust) coverage..."

  # Prefer JSON summary from llvm-cov --json
  local json_summary="${BACKEND_DIR}/coverage-summary.json"
  local lcov_a="${BACKEND_DIR}/target/coverage/lcov.info"
  local lcov_b="${BACKEND_DIR}/lcov.info"

  local backend_cov

  if [ -f "${json_summary}" ]; then
    backend_cov=$(python3 - "${json_summary}" <<'EOF'
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
totals = data.get("data", [{}])[0].get("totals", {})
lines  = totals.get("lines", {})
pct    = lines.get("percent", 0)
print(f"{pct:.2f}")
EOF
    )
  elif [ -f "${lcov_a}" ]; then
    backend_cov=$(lcov_line_pct "${lcov_a}")
  elif [ -f "${lcov_b}" ]; then
    backend_cov=$(lcov_line_pct "${lcov_b}")
  else
    warn "Backend coverage data not found."
    warn "  Expected one of:"
    warn "    ${json_summary}"
    warn "    ${lcov_a}"
    warn "    ${lcov_b}"
    warn "  Run:  make coverage-backend   (or: ./scripts/run-tests.sh --backend --coverage)"
    MISSING=$((MISSING + 1))
    return
  fi

  echo -e "  Backend line coverage : ${BOLD}${backend_cov}%${RESET}  (threshold: ${THRESHOLD}%)"

  if gte "${backend_cov}" "${THRESHOLD}"; then
    pass "Backend meets threshold (${backend_cov}% >= ${THRESHOLD}%)"
  else
    fail "Backend BELOW threshold (${backend_cov}% < ${THRESHOLD}%)"
    BELOW=$((BELOW + 1))
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Frontend coverage
# ─────────────────────────────────────────────────────────────────────────────
check_frontend() {
  log "Checking frontend (JS/TS) coverage..."

  local json_summary="${FRONTEND_DIR}/coverage/coverage-summary.json"
  local lcov="${FRONTEND_DIR}/coverage/lcov.info"

  local frontend_cov

  if [ -f "${json_summary}" ]; then
    frontend_cov=$(node -e "
      const s = require('${json_summary}');
      process.stdout.write(String(s.total.lines.pct));
    ")
  elif [ -f "${lcov}" ]; then
    frontend_cov=$(lcov_line_pct "${lcov}")
  else
    warn "Frontend coverage data not found."
    warn "  Expected one of:"
    warn "    ${json_summary}"
    warn "    ${lcov}"
    warn "  Run:  make coverage-frontend  (or: ./scripts/run-tests.sh --frontend --coverage)"
    MISSING=$((MISSING + 1))
    return
  fi

  echo -e "  Frontend line coverage: ${BOLD}${frontend_cov}%${RESET}  (threshold: ${THRESHOLD}%)"

  if gte "${frontend_cov}" "${THRESHOLD}"; then
    pass "Frontend meets threshold (${frontend_cov}% >= ${THRESHOLD}%)"
  else
    fail "Frontend BELOW threshold (${frontend_cov}% < ${THRESHOLD}%)"
    BELOW=$((BELOW + 1))
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Coverage Threshold Check  (required: ${THRESHOLD}%)${RESET}"
echo    "─────────────────────────────────────────────────────"

check_backend
echo ""
check_frontend

echo ""
echo "─────────────────────────────────────────────────────"

if [ "${MISSING}" -gt 0 ]; then
  warn "${MISSING} component(s) missing coverage data — run tests first."
  exit 2
fi

if [ "${BELOW}" -gt 0 ]; then
  fail "${BELOW} component(s) did not meet the ${THRESHOLD}% threshold."
  echo ""
  echo -e "  ${YELLOW}Tips to improve coverage:${RESET}"
  echo -e "  • Add unit tests for uncovered functions and branches"
  echo -e "  • Check the HTML report:  make coverage"
  echo -e "  • Backend: open \`backend/target/coverage/index.html\`"
  echo -e "  • Frontend: open \`frontend/coverage/lcov-report/index.html\`"
  echo ""
  exit 1
fi

echo ""
echo -e "${GREEN}${BOLD}All coverage checks passed.${RESET}"
echo ""
