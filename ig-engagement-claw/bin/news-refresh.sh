#!/bin/zsh
# Daily AI-news research for the follow-up value library (src/value.js).
# Runs once a day from launchd. Does nothing if today's news is already stored.
# Never invents news: every item must carry a source URL the researcher actually
# fetched, and `cli.js news-add` drops anything unsourced and expires items >14 days.
set -u
cd "$HOME/awesome-claude-skills/ig-engagement-claw" || exit 1
export PATH="$HOME/.nvm/versions/node/v18.17.1/bin:$HOME/.local/bin:$PATH"

if [ "$(node src/cli.js news-status | python3 -c 'import sys,json;print(json.load(sys.stdin)["stale"])')" != "True" ]; then
  echo "[news] already fresh today, nothing to do"
  exit 0
fi

unset ANTHROPIC_API_KEY
export CLAUDE_CODE_OAUTH_TOKEN="$(cat "$HOME/.varritech/claude-oauth-token")"

"$HOME/.local/bin/claude" -p "Research task, run it NOW. Today is $(date +%Y-%m-%d).
Find 5 to 10 REAL AI news items from the last 10 days that a founder building with AI would care about: new models, new developer tools or coding agents, new products or platform changes. Use WebSearch, then WebFetch the page you will cite to confirm the date and the claim.
Hard rules: never invent or guess a fact, date or URL. If you cannot confirm an item on a page you fetched, drop it. Attribute vendor claims as claims (e.g. 'MiniMax claims'). No rumours.
Output: write ONE JSON array and pipe it to the CLI with exactly this shape, one Bash call:
  echo '<json array>' | node src/cli.js news-add
Each element: {\"id\":\"news-<kebab-slug>\",\"title\":\"<what shipped>\",\"url\":\"<the page you fetched>\",\"date\":\"YYYY-MM-DD\",\"why\":\"<one line: why a builder cares, claims attributed>\",\"tags\":[3-6 lowercase topic words like model cost agents code api automation design security marketing],\"anchors\":[1-2 lowercase distinctive names a DM about it must contain, like the product or model name]}
Then run: node src/cli.js news-status and finish with one line: how many items were kept and how many were dropped." \
  --model claude-sonnet-5-5 \
  --allowedTools "WebSearch,WebFetch,Bash(node src/cli.js news-add:*),Bash(node src/cli.js news-status:*),Bash(echo:*)" \
  >> state/news.log 2>&1
