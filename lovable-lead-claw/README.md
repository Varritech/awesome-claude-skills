# lovable-lead-claw

Daily lead sourcing for Lovable-built apps. Two sources feed Supabase (`lovable_leads`), then a report email goes to `REPORT_TO`.

- **GitHub**: public repos with `"lovable-tagger"` in package.json (~78K). Code search is sharded by file size; the shard/page cursor lives in `lovable_lead_cursors`, so each day continues where the last stopped. Keeps a repo's commit-author emails only if the homepage is live or the email is on a company domain. Junk (noreply, bots, schools, placeholders, portfolio/tutorial repos, emails on 3+ repos) is dropped.
- **Apify**: `harvestapi/linkedin-profile-search`, founders at 1-10 person companies, email search mode. Spend is capped by `APIFY_DAILY_USD` (budget minus today's spend; `maxItems` and `maxTotalChargeUsd` derived from it). `0` skips the source.

```
cp .env.example .env && chmod 600 .env   # fill in
node src/run.js --dry                    # no DB writes, no email, no Apify
node src/run.js --source github --no-report
./install.sh                             # daily 07:00 via launchd (logs/YYYY-MM-DD.log)
npm test
```

Needs node >= 22 on PATH (launchd PATH: ~/.local/bin, /opt/homebrew/bin, /usr/local/bin; nvm/volta users add their bin dir to bin/run-daily.sh). APIFY_TOTAL_USD (default 2.00) caps Apify spend for the whole test, on top of the daily cap. State is only in Supabase; the run aborts (and emails an ABORTED notice) if it is unreachable. No outreach is sent from here.
