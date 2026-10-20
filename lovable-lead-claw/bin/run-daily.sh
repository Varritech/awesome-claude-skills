#!/bin/zsh
# Daily runner: cd relative to this script, load the 600 .env next to the repo, log to logs/.
set -u
cd "$(dirname "$0")/.." || exit 1
mkdir -p logs
if [ -f .env ]; then set -a; . ./.env; set +a; fi
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
command -v node >/dev/null || { echo "node not found; PATH=$PATH" >&2; echo "node not found; PATH=$PATH" >> "logs/$(date +%Y-%m-%d).log"; exit 127; }
LOG="logs/$(date +%Y-%m-%d).log"
echo "=== $(date '+%F %T') ===" >> "$LOG"
# One run at a time: a long GitHub rate-limit sleep must never overlap tomorrow's 07:00 launch.
LOCK="logs/.run.lock"
if [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then
  echo "previous run (pid $(cat "$LOCK")) still going, skipping this launch" >> "$LOG"
  exit 0
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT
# caffeinate keeps the Mini awake for the multi-hour run
if command -v caffeinate >/dev/null; then caffeinate -i node src/run.js "$@" >> "$LOG" 2>&1; else node src/run.js "$@" >> "$LOG" 2>&1; fi
code=$?
echo "exit $code" >> "$LOG"
exit $code
