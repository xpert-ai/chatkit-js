#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$BACKEND_DIR/.venv"

# Create virtualenv if missing
if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtualenv at $VENV_DIR ..."
  python3 -m venv "$VENV_DIR"
fi

# Activate virtualenv
source "$VENV_DIR/bin/activate"

# Upgrade pip and install dependencies
pip install --upgrade pip -q
pip install -e "$BACKEND_DIR" -q

# Load .env if present
if [ -f "$BACKEND_DIR/.env" ]; then
  set -a
  source "$BACKEND_DIR/.env"
  set +a
fi

# Start uvicorn
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8010}" --reload
