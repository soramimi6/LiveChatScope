#!/usr/bin/env bash
# LiveChatScope E2E API test runner
# Usage:
#   ./scripts/e2e-api.sh                                    # smoke tests only
#   ./scripts/e2e-api.sh "https://www.youtube.com/watch?v=..."  # smoke + full flow

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Virtual environment not found at $VENV_PYTHON — run: python -m venv .venv; pip install -r requirements.txt" >&2
  exit 1
fi

URL="${1:-}"
if [[ -n "$URL" ]]; then
  export LIVECHATSCOPE_E2E_URL="$URL"
  echo "LIVECHATSCOPE_E2E_URL set — running smoke + flow tests"
else
  unset LIVECHATSCOPE_E2E_URL || true
  echo "LIVECHATSCOPE_E2E_URL not set — running smoke tests only"
fi

cd "$BACKEND_DIR"
exec "$VENV_PYTHON" -m pytest tests/ -v
