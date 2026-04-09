#!/usr/bin/env bash
set -e

ROOT="/Users/matijarajkovic/cis4120project"

echo "Starting backend..."
osascript -e "tell application \"Terminal\" to do script \"cd $ROOT/backend && source venv/bin/activate && bash run.sh\""

echo "Starting frontend..."
osascript -e "tell application \"Terminal\" to do script \"cd $ROOT/frontend && npm run dev\""