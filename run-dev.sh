#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting backend..."
osascript -e "tell application \"Terminal\" to do script \"cd $ROOT/backend && source venv/bin/activate && bash run.sh\""

echo "Starting frontend..."
osascript -e "tell application \"Terminal\" to do script \"cd $ROOT/frontend && npm run dev\""