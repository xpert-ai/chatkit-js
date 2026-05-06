#!/usr/bin/env bash

# Start the Managed ChatKit FastAPI backend.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

PYTHON_RUNNER=()

if command -v uv >/dev/null 2>&1; then
  echo "Installing backend deps with uv ..."
  uv sync >/dev/null
  PYTHON_RUNNER=(uv run)
else
  if [ ! -d ".venv" ]; then
    echo "Creating virtual env in $PROJECT_ROOT/.venv ..."
    if command -v python3 >/dev/null 2>&1; then
      python3 -m venv .venv
    elif command -v python >/dev/null 2>&1; then
      python -m venv .venv
    else
      echo "Python 3.11+ is required to run the Managed ChatKit backend."
      exit 1
    fi
  fi

  VENV_PYTHON="$PROJECT_ROOT/.venv/bin/python"
  if [ ! -x "$VENV_PYTHON" ]; then
    echo "Virtual env creation failed; $VENV_PYTHON not found."
    exit 1
  fi

  if ! "$VENV_PYTHON" -m pip --version >/dev/null 2>&1; then
    echo "Bootstrapping pip in virtual env ..."
    if ! "$VENV_PYTHON" -m ensurepip --upgrade >/dev/null 2>&1; then
      echo "pip is not available in .venv; install uv or recreate .venv with pip support."
      exit 1
    fi
  fi

  echo "Installing backend deps (editable) ..."
  "$VENV_PYTHON" -m pip install -e . >/dev/null
  PYTHON_RUNNER=("$VENV_PYTHON" -m)
fi

# Load env vars from the backend .env (if present) so XPERTAI_API_KEY
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
  echo "Set XPERTAI_API_KEY in your environment or in .env before running this script."
  exit 1
fi

export PYTHONPATH="$PROJECT_ROOT${PYTHONPATH:+:$PYTHONPATH}"

echo "Starting Managed ChatKit backend on http://127.0.0.1:8000 ..."
exec "${PYTHON_RUNNER[@]}" uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
