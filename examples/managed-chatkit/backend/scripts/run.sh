#!/usr/bin/env bash

# Start the Managed ChatKit FastAPI backend.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

if [ ! -d ".venv" ] || [ ! -f ".venv/bin/activate" ]; then
  echo "Creating virtual env in $PROJECT_ROOT/.venv ..."
  if command -v python3 >/dev/null 2>&1; then
    python3 -m venv .venv
  else
    python -m venv .venv
  fi
fi

if [ ! -f ".venv/bin/activate" ]; then
  echo "Virtual env creation failed; .venv/bin/activate not found."
  exit 1
fi

source .venv/bin/activate

echo "Installing backend deps (editable) ..."
pip install -e . >/dev/null

# Load env vars from the repo's .env.local (if present) so XPERTAI_API_KEY
# does not need to be exported manually.
ENV_FILE="$PROJECT_ROOT/.env"
if [ -z "${XPERTAI_API_KEY:-}" ] && [ -f "$ENV_FILE" ]; then
  echo "Sourcing XPERTAI_API_KEY from $ENV_FILE"
  # shellcheck disable=SC1090
  set -a
  . "$ENV_FILE"
  set +a
fi

if [ -z "${XPERTAI_API_KEY:-}" ]; then
  echo "Set XPERTAI_API_KEY in your environment or in .env.local before running this script."
  exit 1
fi

export PYTHONPATH="$PROJECT_ROOT${PYTHONPATH:+:$PYTHONPATH}"

echo "Starting Managed ChatKit backend on http://127.0.0.1:8000 ..."
exec uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
