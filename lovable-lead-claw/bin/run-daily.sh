#!/bin/zsh
# Daily runner: cd relative to this script, load the 600 .env next to the repo, log to logs/.
set -u
cd "$(dirname "$0")/.." || exit 1
mkdir -p logs
if [ -f .env ]; then set -a; . ./.env; set +a; fi
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
LOG="logs/$(date +%Y-%m-%d).log"
echo "=== $(date '+%F %T') ===" >> "$LOG"
node src/run.js "$@" >> "$LOG" 2>&1
code=$?
echo "exit $code" >> "$LOG"
exit $code
