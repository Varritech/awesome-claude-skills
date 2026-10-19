#!/bin/zsh
# Loads the daily launchd job. Copies no secrets: create .env yourself (cp .env.example .env; chmod 600 .env).
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL=com.varritech.lovable-lead-claw
DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
[ -f "$DIR/.env" ] || { echo "missing $DIR/.env (copy .env.example, fill it, chmod 600)"; exit 1; }
chmod 600 "$DIR/.env"
mkdir -p "$HOME/Library/LaunchAgents" "$DIR/logs"
sed "s|__CLAW_DIR__|$DIR|g" "$DIR/$LABEL.plist" > "$DEST"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$DEST"
echo "loaded $LABEL, runs daily 07:00. Test now: zsh $DIR/bin/run-daily.sh --dry"
