# ig-engagement-claw — one run

Runs every 5 minutes. **Most runs should do nothing** — that is correct, not a failure.
The send budget is wall-clock (`MAX_PER_HOUR` / `MAX_PER_DAY`), so frequent polling buys
you speed of response, not volume. If `next` returns an empty batch, stop immediately
and report "nothing to do". Never go looking for more people to fill a quota.

You are driving Cristiano's already-logged-in Instagram session to open ONE conversation
each with a handful of people who just engaged with @varritech.

⛔ **Do not orient on the repo first.** No `pwd`, `ls`, `cat package.json`, or any other
"let me see what's here" call. The run shape is fixed and fully described in this file —
go straight to the `ToolSearch` call below, then preflight. A repo-orientation call has
recurred multiple times as pure waste on scheduled runs; it teaches you nothing this file
doesn't already state.

## Browser access

**Use `mcp__browsermcp__*` ONLY.** Not claude-in-chrome, not CDP, not port 9222, never a
scripted login. You are borrowing a session that is already signed in, in the browser where
the Browser MCP extension is installed and showing **Connected**.

⛔ **`mcp__browsermcp__*` tools are deferred in this session and only appear as names.**
Calling one directly fails with `InputValidationError`. Load them all in ONE batched call
before preflight, not one ToolSearch per tool as you reach for it:
`ToolSearch({query:"select:mcp__browsermcp__browser_tab,mcp__browsermcp__browser_snapshot,mcp__browsermcp__browser_navigate,mcp__browsermcp__browser_execute_js,mcp__browsermcp__browser_screenshot,mcp__browsermcp__browser_click"})`.

⛔ **Lane is fixed per-call.** Every browser call in this run must carry the exact same
`mcp__browsermcp__` prefix that answered the tab-list preflight — never `-b`/`-c`/`-d`/`-e` on
any single call, even after preflight succeeded. 2026-09-15: list/grep/select all worked on the
bare lane, then the first `browser_execute_js` went out as `mcp__browsermcp-c__browser_execute_js`
and died `No extension connected`. A sibling-prefix failure mid-run is lane drift, NOT the
extension being down — preflight already proved the bare lane healthy. Still abort per the
one-call rule; just don't misreport it as an extension outage.

**Preflight — do this first, and abort the run if it fails:**

1. `mcp__browsermcp__browser_tab` → `{ "action": "list" }`. Immediately pipe the raw result
   text through `grep -c "about:blank - about:blank"` (write it to a scratch file with `Write`
   first if it needs a file to grep, e.g. `state/tab-list.txt`) and hold onto that exact number
   for the report in step 5. ⛔ **Do not count this by eye and do not defer it to report time.**
   Self-reported eyeball counts of this same list have been wrong 4+ times in a row (off by
   3-9, always overcounts) and silently dropped from the final report entirely a dozen+ times —
   a scripted `grep -c` is the only form of this count that has ever been proven correct.
2. Find an existing `instagram.com` tab and **select it**:
   `mcp__browsermcp__browser_tab` → `{ "action": "select", "index": <n> }`.
   Only if there is no Instagram tab at all, open one:
   `{ "action": "new", "url": "https://www.instagram.com/" }`.
3. `mcp__browsermcp__browser_snapshot` → `{ "level": "minimal" }` — **skip this call if the
   `select` result from step 2 already came back with `Follow Back` buttons and bare handles**
   (it returns an enhanced scaffold, not just a URL). That scaffold already IS the snapshot;
   calling `browser_snapshot` again on top of it is a wasted call, not a safety check.

⛔ **An account-status page is NOT a stop condition — navigate away and carry on.**
If the tab you just selected is sitting on `/settings/...`, `/settings/help/enforcement/`
or any other Settings URL, that is just where the tab was last parked. It is a page
anyone can open from the menu, not Instagram interrupting you. Every run from
2026-08-28 onward aborted here and sent nothing, for weeks, because the parked tab was
read as a block. Navigate to `https://www.instagram.com/` and continue the run.

A real stop condition **interrupts** you: it appears on a page you did not ask for and
you cannot navigate past it. See the stop list below.

⛔ **The live restriction is link-sharing ONLY** ("You can't share links", added
2026-08-28, ends 2026-09-27). **DMs are not restricted.** Cold openers never contain a
link, and `LINKS_BLOCKED=1` already strips the URL out of follow-up knock one, so the
copy `cli.js next` hands you is safe to send as-is. Send it verbatim, as always. If you
ever see a URL in text handed to you while that restriction is live, do not send it —
report it instead, because that means the flag is not set.

⛔ **Select a tab BEFORE you navigate, and reuse that one tab for the whole run.**
`browser_navigate` has no tab argument — it acts on whatever tab is currently
active. If that happens to be an `about:blank` scratch tab (which is what a
scheduled run lands on), every navigation strands another Instagram tab behind
it. Left unchecked this reached **20 orphaned Instagram tabs** before anyone
noticed, and the run itself was driving a blank page the whole time, which reads
as "the claw does nothing." Selecting first fixes both: a selected tab is
navigated in place and the count never grows.

If `list` shows more than one Instagram tab, close the extras
(`{ "action": "close", "index": <n> }`, **highest index first** so the indices
below don't shift under you) and keep one.

**Close every `about:blank - about:blank` tab, every run** (Cristiano 2026-10-10: "it
keeps opening up these about:blank tabs"). After selecting the Instagram tab, close
each blank one with `{ "action": "close", "index": <n> }`, highest index first. Never
close any other tab: everything else in the browser is Cristiano's work.
⛔ **Gate:** only close if every `[n]` number in the list is unique. If any number
repeats (two windows each counting from 0, which is what the extension did before the
2026-10-10 fix), a close can hit the wrong window's tab. In that case close nothing
and add "tab numbers repeat, Browser MCP extension needs a reload" to the report.

If that errors, times out, or comes back with no extension connected, **stop and report it
after the FIRST failure** — the MCP client already retried 3x internally, so an error string
containing `No extension connected` IS the abort. One call, then abort; never re-call it, and
do not fall back to another browser tool. `Cannot read properties of undefined (reading
'snapshot')` from `browser_tab select` is the same class of abort (seen live 2026-09-10,
first call of the run) — treat any thrown error here as terminal, not just the
`No extension connected` string. If the snapshot
shows a logged-out page or a login form, **stop**: the session isn't live and nothing below is
safe to attempt.

⛔ **Same-day occurrence counter for the `Cannot read properties of undefined (reading
'snapshot')` abort specifically.** This exact signature hit the same tab index 5+ times in
one day on 2026-09-10 before anyone said so out loud in a run report. On this error (only
this one, not `No extension connected`): read `state/preflight-abort-count.json` (shape
`{"date":"YYYY-MM-DD","count":N}`, missing file = `{date:"", count:0}`); if `date` isn't
today, reset `count` to 0; increment `count`; write it back with `Write`. If the new `count`
is **3 or more**, say so explicitly in the step 5 report — `"occurrence <count> today — human
intervention needed: open a fresh Instagram tab, or reload the Browser MCP extension"` — do
not just report the generic abort message. Below 3, report the abort normally with no mention
of the counter.

⛔ **At count 15 or more, the report-only escalation has already failed — stop asking and pull
the plug yourself.** This exact signature climbed unactioned from 3 → 10 → 18 → 25 across
2026-09-10/11 with the report stating the ask every single time and nobody reading it, then hit
**75** later on 2026-09-11 — a cron re-asking every 5 minutes into the void, for hours, is not an
intervention. Once `count >= 15`: run `Bash({"command":"launchctl unload
~/Library/LaunchAgents/com.varritech.ig-engagement-claw.plist"})` (ignore a nonzero exit —
already-unloaded is a success state, not an error) and say so in the step 5 report instead of
the plain "human intervention needed" line: `"occurrence <count> today — unloaded the launchd
job myself, no further runs will fire until a human reloads it after opening a fresh Instagram
tab or reloading the Browser MCP extension"`. This is a one-way stop for THIS run's schedule
only — reloading requires `launchctl load` by a human, on purpose, so a broken extension can't
silently keep burning calls once this line is crossed.

## Hard rules (do not relax)

- **You do not decide who gets messaged.** `cli.js next` decides. Someone not in that batch
  does not get a DM — no exceptions, no "while I'm here".
- **You do not decide what gets said.** Send the `text` field verbatim, exactly as given.
  Do not add anything of your own: no link, no price, no pitch, no second message.
  ⛔ The `text` for a follow-up DOES contain a price and a link, on purpose — that is
  Cristiano's fixed copy, not something for you to trim, reword or "clean up".
  Verbatim means verbatim in both directions.
- **Confirm before you commit.** Only run `commit` after you have re-snapshotted the thread and
  seen the message in it. An uncommitted send is retried next hour; a wrongly committed one is
  a person we never talk to again.
- **One pass, then stop.** No loops, no stories, no follow-ups.
- Stop immediately on a login wall, checkpoint/challenge screen, "Action Blocked", "Try Again
  Later", or a 2FA prompt. A checkpoint is Instagram telling you it already noticed.
  ⛔ The Settings → Account Status / enforcement page is **not** one of these — it is a
  passive status page you can navigate away from. Do not abort on it (see preflight).

## Offer memory — what we sell, and what we have sold

⛔ **`src/offers.js` is the single source of truth for every offer fact in this repo.**
Prices, tier names, the catalogue size, the guarantees and the past-sales record all live
there, and `node -e "import('./src/offers.js').then(m=>console.log(m.offerBriefing()))"`
prints the whole thing. Never quote a number from this file, from a screenshot, or from
memory — read it from there. It carries a re-verify instruction against the live landing
page, because this page has repriced three times in six weeks.

The short version, after the **2026-09-11** reprice (vds-marketing-core PR #494):

| | |
|---|---|
| Free 5-skill starter pack | `grand-slam-offer`, `static-ads-creator`, `meta-ads-account-architecture`, `inert-funnel-audit`, `email-deliverability-audit` |
| Essential | **$299** one time, the ENTIRE vault, **268 skills**, six departments. No course, no onboarding, no custom skills |
| Premium | **$999** one time, everything in Essential plus **five custom skills our team builds for their stack**, the Ship-With-Claude course, onboarding with the team, weekly calls |
| AI Employee Pack | **$299**, a SEPARATE add-on. ⛔ Autonomous agents are NOT in Essential or Premium |
| Scalewright | Revenue share, nothing upfront, "free until you are". Never priced over text, always a call |

Three guarantees, and they are the close: **72-Hour Takeover**, **First-Hire** (ten hours off
your plate in 30 days), and a **48-hour fix-or-refund**. Plus pay-once and a 30-second
self-serve refund.

⛔ **No discounts. For anyone, including long term clients.** Both tiers are one flat price
since 2026-09-11 and the old $47 entry tier is retired. A prospect asking for the price they saw
earlier gets "that tier is retired, Essential is $299 for the whole vault" and an honest no.

⛔ **Retired numbers that are still all over older assets and WILL be wrong:** 170 / 213 / 191
skills, $47, $97, $197, $297, $149.99, $15k. If a draft contains one, it is stale.

⛔ **Exception: the `$149.99` inside a §3b follow-up's fixed `text` field is NOT this stale
number — send it anyway.** It is a deliberate value-anchor on the free Playbook guide, overridden
by Cristiano on 2026-08-17 after being flagged exactly like this (`[[feedback_guide_price_anchor_is_deliberate]]`).
Same for that copy naming "Scalewright" with a number attached, which reads like it contradicts
the "never priced over text" row above — it doesn't, because his own guide page carries the same
"$10K MRR guaranteed" line already. `cli.js next` only ever hands you this fixed copy for a
follow-up; do not hold the send or ask for a call on it, that question was already asked and
answered once — see [[ig-engagement-outreach-claw]] SKILL.md for the full history.

### What we have actually sold

Three real closed threads are recorded in `PAST_SALES` in `src/offers.js`, including the one
that refunded. Read them before answering an objection, because between them they cover
almost every question that gets asked:

- **A marketing agency's director of ops** argued for the expired $47 price, was told no and
  told plainly to look elsewhere if he wanted cheap, then got asked what he was building. He
  bought the complete set plus the course and booked a call. ⚠️ He also had to chase us twice
  for delivery after paying.
- **A solo builder** bought Premium and refunded inside the hour: some skills leaned on a
  discontinued MCP, some were publicly available, some referenced missing scripts. He got a
  full refund with no argument in under two minutes and stayed warm enough to accept a
  community invite. The six-department structure on the page came out of that feedback.
- **An insurance adjuster** with 20 years in his niche and a tight budget was steered off the
  done-for-you service and onto the skills, and said the honest answers "without the big sales
  push" were what sold him.

### The SMS half of this funnel

`node src/cli.js sms-tick` is a SEPARATE, fully autonomous run — no browser, no agent. It
texts free-pack leads from the Quo (OpenPhone) line, asks what they are building, and answers
their questions using the same `src/offers.js` memory. **You are not it.** Do not text
anybody, do not read `src/sms*.js` as part of an Instagram run, and do not mention it in your
report.

## 1. Read the notifications feed (READ ONLY)

The notifications feed already says who followed, who liked and who commented,
newest first.
Do NOT scrape the followers list — 674 rows, virtualized, and it cannot tell a
follower from 2024 apart from one from two minutes ago.

⛔ **Check the tab you already selected in preflight BEFORE navigating anywhere.**
If its URL is already `/notifications/` and the snapshot shows real rows (named
handles, text like "started following you" / "liked your photo"), you are
already there — extract right now and skip the rest of this section. Do not
assume it's stale or empty without reading the snapshot content first. This
exact mistake — re-navigating away from a tab that was already correct — has
burned 10-15 tool calls on three separate runs.

⛔ **The panel is often open at URL `https://www.instagram.com/` — the URL does
NOT change to `/notifications/`.** Judge by the snapshot, not the URL: several
"Follow Back" buttons plus bare handles means the Notifications panel is already
sitting over the home feed. It is NOT a `div[role="dialog"]` either, so a
`querySelector('div[role="dialog"]')` probe returning null proves nothing.

⛔ **If the tab is parked on a DM thread or Messages page, the `select`
scaffold usually already contains a clickable `Notifications` link (e.g.
`a [ref=refNN] "NotificationsNotifications"`) even though the visible page is
Messages.** Click that ref directly. Do NOT `browser_navigate` to the home
feed first to go hunting for a different Notifications icon there — that has
now cost 3+ runs an extra navigate + re-snapshot for zero benefit. Read the
whole scaffold you already have (not just the visibly-rendered region) before
deciding you need to navigate anywhere.
⛔ **Do NOT call `browser_screenshot` to confirm this.** The `select` snapshot you
already have IS the check — if it shows `Follow Back` buttons plus bare handles,
the panel is open, extract immediately. A screenshot call here is pure waste: it
was suggested as "one cheap check" in an earlier version of this file and burned
an extra tool call on well over a dozen consecutive runs before anyone removed it.

Only if the current tab is NOT on `/notifications/`, has no notifications panel
open, or its snapshot is
genuinely empty: `browser_navigate` → `https://www.instagram.com/` (the HOME
feed, not the profile page — on narrow viewports the notifications icon lives
in the home header, not the profile's left rail), then click **Notifications**
in the header (`browser_snapshot` → click its ref).

⛔ Known decoys — do not click these while hunting for notifications: the "3"
badge near the avatar (Threads unread count, opens threads.com), "Professional
dashboard" in the left rail (opens `/ad_tools/`, the ads dashboard), and the
left-rail heart icon on the **profile** page (can open a Messages panel
instead).

⛔ Do NOT navigate straight to `/varritech/followers/` or a notifications URL —
Instagram renders those panels only via the in-app click path. A direct
navigation gives you a page with no dialog on it and looks like "no results".
This does not apply to a tab already parked on `/notifications/` at preflight
— see above.

Extract rows with `mcp__browsermcp__browser_execute_js` (unsafe mode, IIFE):

```js
(function(){
  var rows=[];
  document.querySelectorAll('a[href^="/"]').forEach(function(a){
    var h=a.getAttribute('href').replace(/^\//,'').replace(/\/$/,'');
    if(!h || h.indexOf('/')>=0 || h==='varritech') return;
    var box=a.closest('div[role="button"]') || a.parentElement.parentElement.parentElement;
    if(!box) return;
    var t=(box.innerText||'').replace(/\s+/g,' ').trim();
    if(!t) return;
    var pl=box.querySelector('a[href*="/p/"],a[href*="/reel/"]');
    rows.push({handle:h, text:t.slice(0,140), postHref: pl?pl.getAttribute('href'):null});
  });
  return rows;
})()
```

Pass that array through verbatim. Do not filter, dedupe or interpret it —
`cli.js` knows which rows are follows, which are likes, which are comments, and
which to ignore.

Comments are the most valuable rows on the feed and the reason this claw exists:
Instagram will not let the API claw open a DM off a comment (every attempt 403s
`outside of allowed window`), so a commenter can ONLY be reached this way. They
are still messaged, but since 2026-10-10 new FOLLOWERS go first, then likers,
then commenters (Cristiano: "the ones who followed us recently"). `cli.js` does
the ordering; just pass every row from this feed. Use only the notifications feed:
never open a post's likes list or the followers list to find more people.

## 2. Plan

```
echo '<the rows json>' | node src/cli.js next
```

⛔ **Do not retype the extracted array into a `Bash` heredoc from memory.** A `cat >
file << 'EOF'` command you compose by hand is silently capped well short of the
`browser_execute_js` result's real length — a 130-row/28KB extraction got hand-typed
into a 12KB heredoc, dropped to 101 rows, and returned a wrong (still-empty, but
unverified) `next` result. Use the `Write` tool to save the JS result to a file
verbatim instead — it isn't length-limited the way a manually-composed shell command
is — then `cat <file> | node src/cli.js next`. If you already piped a hand-typed
version, diff the row count in the file against the extraction's row count before
trusting the `considered` number.

⛔ **Always write to the exact path `state/notif-rows.json` — never invent a new name.**
Nothing downstream reads this file (it's a stdin scratch buffer only), but every run that
picks its own name (`last-extract.json`, `latest-notifications-extract.json`,
`notif-extract-<date>.json`, `notif-rows-<date>.json`, `notif_extract_<date>.json`,
`run_rows.json` all seen live) leaves it behind — six near-duplicate files piled up in one
day. Overwrite the one fixed name every run; it's gitignored so there's no commit cost, but
a stable name keeps `state/` legible for the next person poking at it.

⛔ **Just `Write` it — do not `mkdir -p state`, do not `ls state/` first to check it
exists, and do not `node -e` count-verify it afterward.** The path is fixed and always
writable; there is nothing to check or create. Row-count verification only matters for the hand-typed-heredoc failure
mode two paragraphs up — if you used `Write` (not a hand-typed `cat > file << 'EOF'`), the
tool result already confirms the write succeeded, full stop. And when you run the `next`
command, call it alone (`cat state/notif-rows.json | node src/cli.js next`) — don't smuggle
a `pwd` or `ls` onto the front of that line "for free"; it isn't free, it's the same
repo-orientation waste this file already forbids at the top, just moved to a different
command.

Returns `{ baseline, considered, batch: [{ handle, source, postId, text }] }`.

⛔ **`"baseline": true` means this was the first look ever.** It recorded where things
stood and planned nobody, on purpose — otherwise installing the claw would cold-DM
everyone who ever liked a post. Report it and stop.

An empty batch is the NORMAL outcome — nothing new, budget spent, or outside sending
hours. **If the batch is empty, stop.** Never go hunting for people to fill a quota.

⛔ **Stop means stop at `next` — no post-`next` archaeology.** Do not read the ledger,
`state/*.json`, `src/config.js` or `date` to explain the empty batch. `next` already applied
the budget and the send window; the reason adds nothing and each probe costs a call. There is
also no `cli.js status` subcommand — usage is `next|commit|skip|blocked|friend-check|followup-sent|replied|ledger` (plus `news-add|news-status|followups-dry`, which the daily news job and humans use, never this run).

## 3. Send — one at a time

For each entry in order:

0. ⛔ **Friend check, before anything else** (Cristiano, 2026-10-30). Anyone following his
   personal @varriale.cristiano is a friend and gets no opener, unless they commented: a
   commenter is always messaged, and Node handles that from the `source` you pass. From any
   instagram.com tab, start the lookup (`<handle>` is the entry's handle):

   ```js
   (function(){ window.__friend='pending';
     fetch('/api/v1/friendships/4689465015/followers/?count=12&query='+encodeURIComponent('<handle>'),
       {credentials:'include',headers:{'X-IG-App-ID':'936619743392459','X-Requested-With':'XMLHttpRequest','X-ASBD-ID':'129477'}})
       .then(function(r){return r.json()}).then(function(d){window.__friend=JSON.stringify({status:d.status,users:(d.users||[]).map(function(u){return {username:u.username}})})})
       .catch(function(e){window.__friend=JSON.stringify({error:String(e)})});
     return 'started'; })()
   ```

   `browser_execute_js` does not wait for the fetch, so read the result in a second call:
   `(function(){return window.__friend})()`. If it still says `pending`, wait 2s and read
   again. Then hand Node the exact text:

   ```
   echo '<the result>' | node src/cli.js friend-check "<handle>" "<source>"
   ```

   - `friend` → already recorded. Do not open the profile. Next entry.
   - `clear` → continue to step 1.
   - `unknown` → do NOT send and record nothing; they come back next run. Two `unknown`s in
     one run means Instagram is rate-limiting the account: end the run and report it.

1. `browser_navigate` → `https://www.instagram.com/<handle>/`
2. ⛔ **Check for a top-level "Message" button FIRST — many profiles have one.**
   Some accounts only render "Follow", others render "Message" right next to it.
   One direct query settles it, don't guess:

   ```js
   (function(){
     var els=[...document.querySelectorAll('div[role="button"],button')];
     return els.some(function(e){ return (e.innerText||'').trim()==='Message'; });
   })()
   ```

   If `true`, click that element directly and skip straight to step 3. **Only open
   the 3-dots Options menu if this comes back `false`:**

   ```js
   (function(){ var s=document.querySelector('svg[aria-label="Options"]');
     (s.closest('div[role="button"],button')||s.parentElement).click(); })()
   ```

   Then click the item whose text is **exactly** `Send message`. Match the exact
   string, never a position — that same menu holds **Block, Restrict and Report**.

   ```js
   (function(){ var d=document.querySelector('div[role="dialog"]'), t=null;
     d.querySelectorAll('button,div[role="button"],[tabindex]').forEach(function(e){
       if(!t && (e.innerText||'').trim()==='Send message') t=e; });
     if(t) t.click(); return !!t; })()
   ```

   ⛔ **If that Options menu doesn't hold `Send message` at all** (only
   Block/Restrict/Report/Share/About), the dialog can get **stuck open and
   unclosable** — `Escape` keydown, `document.body.click()`, clicking outside via
   `elementFromPoint`, none of it closes it (confirmed live, `royalgoon`,
   2026-09-10). Don't keep fighting it. Just `browser_navigate` back to the same
   profile URL for a clean reload, then redo the top-level-Message check above —
   that's how `royalgoon` was recovered, and it turned out to have a working
   top-level `Message` button the whole time. This is why the check above must run
   first: it would have avoided opening Options at all.

   ⛔ **If a dialog offers "Send prioritized message / Send message request":** always click
   the button whose text is **exactly** `Send prioritized message` (Cristiano, 2026-10-30).
   Fall back to `Send message request` only if the prioritized option is missing or greyed out,
   or it asks for payment, and say so in the report. **Never pay**, buy credits or enter card
   details. After sending, reload the thread and confirm the bubble is still there:
   the prioritized dialog's sends have vanished on reload before, and only `commit` what survived.

3. ⛔ **Check the thread is empty before typing anything.** Screenshot it. If there
   is ANY prior message — from them or from us, however old — we have already
   talked to this person. Do NOT send. Back out and record it:

   ```
   node src/cli.js skip "<handle>" existing-thread
   ```

   This is the difference between "we haven't messaged them" and "this claw hasn't
   messaged them". The ledger only knows its own sends; years of existing threads
   and everything the sales claw has opened are invisible to it. You are the only
   thing that can see them. A skip costs no send budget. (Live 2026-08-17: 2 of 4
   planned targets were caught here, both already opened by the sales claw.)

   ⛔ **If the thread shows this exact banner: "This account can't receive your
   message because they don't allow new message requests from everyone" —** that
   is a permanent delivery block, not a delay warning. It can appear before you've
   typed anything (a dead composer) or right under a bubble you just sent (a send
   that silently failed). Either way, record it immediately so it never comes back:

   ```
   node src/cli.js skip "<handle>" message-request-blocked-not-delivered
   ```

   Do NOT leave this one unrecorded "to retry next run" — that's the §3b anti-pattern
   below, and it means every future run re-opens the same dead thread forever,
   burning a batch slot each time (recurred on `pbjoel` across three separate runs,
   2026-08-17 discovery on `davemiz`, 2026-08-28, and again 2026-08-31 because this
   run followed the generic "skip, don't record" line instead).

4. The composer is a **Lexical** editor. It is not exposed as a snapshot ref until
   you take a full `browser_snapshot` with `viewportOnly: false`, so put the text
   in with an insertText command instead:

   ```js
   (function(){ var b=document.querySelector('div[contenteditable="true"][data-lexical-editor="true"]');
     b.focus(); var s=getSelection(), r=document.createRange();
     r.selectNodeContents(b); r.collapse(false); s.removeAllRanges(); s.addRange(r);
     document.execCommand('insertText', false, "<the exact text>"); })()
   ```

   ⛔ Reading `innerText` back immediately returns `""` — Lexical has not committed
   the node yet. That is NOT a failure. Confirm with a screenshot instead.

5. ⛔ **Enter does NOT send.** `browser_press_key` Enter was tried twice on a
   focused composer and the text just sat there. Take a `browser_snapshot` with
   `viewportOnly: false`, find `div "Send" {role:button}` in the orphaned-elements
   list, and `browser_click` that ref. That is the only send path that works.
   ✅ Cheaper alternative, confirmed 2026-09-10: skip the snapshot. `execute_js` matching
   `innerText.trim()==='Send'` comes back `not-found` (the button carries no text), but
   `document.querySelector('svg[aria-label="Send"], div[aria-label="Send"],
   button[aria-label="Send"]')`, then click the closest `div[role="button"],button` ancestor,
   works first try. Try the aria-label query first; fall back to the snapshot-ref method only
   if it comes back null.

6. `browser_screenshot` once more and **confirm the bubble is actually in the
   thread**, with a timestamp. The inbox row should also jump to the top.

   ⛔ **A clicked Send can still silently fail — check for "Failed to send" text under
   the bubble, not just that a bubble appeared.** Confirmed 2026-09-14 on `zane.jeffries`
   (follow-up #3): the aria-label Send click returned normally and a bubble with our text
   appeared in the thread, but it carried a "Failed to send" label directly under it. This
   is NOT a stale UI artifact — reloading the thread (`browser_navigate` back to the same
   `/direct/t/<id>` URL) made the bubble disappear entirely, proving the message never
   actually delivered. Retried once (fresh insertText + fresh Send click) and it failed the
   same way twice. Two-in-a-row triggered the existing "stop the whole run" rule below —
   do NOT `commit`/`followup-sent` a bubble that shows "Failed to send", even if the
   screenshot looks like a normal sent message at a glance.

   ⛔ **The label is not reliable and this is not thread-specific — always reload to check
   persistence.** Confirmed on `zane.jeffries` (some attempts showed no label at all, only
   the reload made the bubble vanish) and again 2026-09-15 on a completely different handle,
   `misaelcruz117` — same two-in-a-row silent fail, no label shown either time, only caught
   by `browser_navigate` refresh. Treat this as general Browser MCP/IG composer flakiness,
   not a broken thread: always reload after every send (cold or follow-up) to confirm the
   bubble survives, regardless of whether a "Failed to send" label was visible.

⚠ `browser_type` sends the whole string in one shot — there is no per-character typing here.
So the realism has to come from the gaps: **wait 40–90 seconds between people, varied.** Never
the same interval twice. Uniform timing is the tell.

⛔ **How to actually wait — never end the turn on the pacing gap.** A foreground
`Bash({command:"sleep 55"})` is BLOCKED by the sandbox. The fix is
`Bash({command:"sleep <55-90>", run_in_background:true})`, which returns a task id. Then
**block on it inside the same turn** — `TaskOutput({task_id:"<id>", block:true,
timeout:120000})` waits for the sleep to finish and returns control to you, so the turn
continues to the next person. Confirmed 2026-09-16: a two-person follow-up batch completed
fully this way. Ending the turn on the wait and trusting the completion notification does
NOT reliably resume this session — six batches have died silently that way. Do NOT follow
the sleep with `ScheduleWakeup` (wrong tool for a plain timer), `ToolSearch({query:"select:Monitor"})`,
`Bash({command:"wait"})`, or a no-op `Bash({command:"true"})` placeholder — `TaskOutput`
block:true is the one useful follow-up call; everything else is wasted.

If a profile has DMs closed, the Message button is absent, or the thread won't open: **record it,
don't just walk away.** This is a pre-first-contact handle, so call

```
node src/cli.js skip "<handle>" no-message-button
```

before moving on. "Skip and do not commit" does NOT mean "leave it unrecorded" — an unrecorded
handle comes back in every future batch and burns a batch slot forever (this is the exact
`pbjoel`/`message-request-blocked-not-delivered` recurrence from §3 above, just for the
no-Message-button case instead of the banner case). Check fast: don't click Options, screenshot,
then hunt coordinates — query directly first:

```js
[...document.querySelectorAll('div,button,a,span')].some(function(e){
  var t=(e.innerText||'').trim(); return t==='Message' || t==='Send message'; })
```

If that's `false` and the 3-dots menu (when opened) holds only Block/Restrict/Report/Share/About,
there is no DM path — call `skip` immediately, no further clicking needed. If two sends in a row
fail, stop the whole run.

## 3b. Follow-ups — people who never answered

`next` also returns a `followUps` array. Each entry is someone we opened days ago
who has still said nothing. Cadence is 3 days after the opener, then 7 days after
that — **as of 2026-09-10 there is no cap past that: the final interval repeats
indefinitely, so `followUpNumber` can legitimately be 3, 4, 5...** Do not withhold
a send because `followUpNumber` looks past "two knocks" — that cap was removed on
purpose (Cristiano: "follow up with literally everyone we've ever talked to").
If an entry carries `reopen: true`, it is someone with a pre-existing thread from
before the claw existed, not a knock-one/knock-two continuation — send `text` as
given, it already reads as a reopen, not a sales follow-up.

⛔ **Every follow-up is a VALUE TOUCHPOINT** (Cristiano, 2026-10-22: "Always with value,
not just wishing you the best"). Each entry's `text` carries exactly ONE real thing for
that person — a recent AI model/tool/product, a free Varritech guide, or free access to
the Varritech AI Router — and `valueId` names which one (`news-...`, `guide-N`, `router-free-access`).
Send `text` verbatim and do NOT soften it, add a "hope you're well", or pad it. Never write
a check-in of your own ("just following up", "wishing you the best", "hope it's going well").
If a follow-up draft could not meet the rule, `next` leaves it out of `followUps` entirely
(logged to stderr as `[value] skip`); do not improvise a replacement for that person.
The router offer has no link on purpose: "reply and I'll set you up with free access".

⛔ These are budgeted AFTER cold openers, and get only what section 3 did not use
(changed 2026-09-04 — it used to be the other way round, and cold outreach starved:
four days passed without opening a single new person). Someone who just followed or
liked is the time-critical one; a second knock on a days-old silence keeps. So an
empty `followUps` on a busy day is CORRECT, not a bug — do not go hunting for people
to knock on because this array came back short.

For each entry, in order:

1. Run the §3 step 0 `friend-check` first, with the handle only: the commenter exemption
   covers the opener, not follow-ups. `friend` = recorded, no follow-up, next entry;
   `unknown` = no send this run. Only on `clear`, open their thread the same way as section 3
   (profile → 3-dots → **Send message**), taking `Send prioritized message` if that dialog appears.
2. ⛔ **Check for the "can't receive your message... don't allow new message
   requests from everyone" banner before typing anything.** If it's there, run:

   ```
   node src/cli.js blocked "<handle>" message-request-blocked-not-delivered
   ```

   ⛔ **This is `blocked`, not `skip`.** A follow-up target is by definition
   already in the ledger (that's why they were due a second knock), and `skip`
   silently refuses to touch anyone already known — it prints "already known"
   and does nothing, leaving the dead thread to come due again next run. This
   exact mistake recurred on `pbjoel` across three separate runs (2026-08-17,
   2026-08-28, 2026-08-31) before `blocked` existed to fix it. Use `skip` only
   in §3, for a handle that was never contacted before. Then move to the next
   entry.
3. ⛔ **Read the thread before you type anything.** If they replied at ANY point —
   even one word, even months ago — do NOT send the follow-up. Record it and move on:

   ```
   node src/cli.js replied "<handle>"
   ```

   That ends their follow-up chain for good. From there the sales claw owns the
   conversation, and a second knock from us talks straight over it. The ledger
   cannot see replies; you are the only thing that can.
4. If the thread still shows only our message, send the `text` verbatim, confirm it
   landed with a screenshot, then:

   ⛔ **This `text` will contain `$149.99` and "Scalewright" together — send it anyway, do not
   pause for a call on it.** See the exception carved out in the offers section above
   (§ "Retired numbers"); it is deliberate, not stale copy, and re-asking wastes the whole
   batch slot waiting on an answer that already exists.

   ⛔ The first follow-up normally hands them a free guide with a **price anchor and a
   URL**. Instagram's web composer accepts links fine — the old no-links rule came from
   the API claw, where InstantDM rejects any DM containing a URL, and does not apply to
   this path. But while `LINKS_BLOCKED=1` is set (see §1 above), `cli.js next` has
   already stripped the URL out of this `text` before you see it — send it verbatim,
   whatever it contains. Do not add a link back in yourself if it's missing.

   ```
   node src/cli.js followup-sent "<handle>" "<the exact text sent>" "<valueId from the entry>"
   ```

5. Same pacing as cold sends: **wait 40–90 seconds between people, varied.**

⛔ **If their profile 404s ("Page not found") — a deleted/renamed account, not a
transient failure:** check `/direct/inbox/`, search by their handle, and look for a
genuine existing thread before giving up. A partial-handle search can match an
unrelated account by display name (e.g. searching `em_moonys` for `em_moonys_versionn`
matched a thread titled `romioneswift` / "emma (moony's version)") — an empty thread
under a different-looking name is NOT proof you found the real one; only treat it as a
match if the thread's own handle/URL matches the target. If no genuine thread turns up,
the account is confirmed gone — call:

```
node src/cli.js blocked "<handle>" profile-not-found
```

not a bare skip, so this handle stops re-entering `followUps` every run forever.

⛔ **If the profile shows no top-level `Message` button and the 3-dots Options menu
holds only Block/Restrict/Report/Share/About/About this account (no `Send message`)** —
the same no-DM-path shape §3 handles for cold opens — this is a follow-up target, so
`skip` is wrong here too (it no-ops on an already-known handle, same reasoning as step 2
above). Call:

```
node src/cli.js blocked "<handle>" no-message-button
```

not a bare skip, so this handle stops re-entering `followUps` every run forever.

If a thread will not open or the Message action is gone for a reason OTHER than a
confirmed-404 profile, the "can't receive your message" banner (step 2 above), or the
no-Message-button shape just above, skip it and do NOT record anything — it comes back
around next run.

## 4. Commit — only what you saw land

```
node src/cli.js commit "<handle>" "<the exact text sent>" "<igUserId or omit>" "<source>"
```

⛔ **Pass `source`** — it is the 4th argument and it is `follower`, `liker` or `commenter`, exactly
as `next` gave it to you in that person's batch entry. It decides what knock one says days later:
a **commenter** gets the Claude Skills Library pitch, everyone else gets the strategy guide. This
was silently dropped for months, so every ledger row reads `source:null` and every commenter got
the wrong follow-up. If you genuinely do not have it, pass `""` rather than guessing.

If you can read the person's numeric IG id off the page, pass it — that is what lets the sales
claw pick the reply up with history instead of re-introducing the founder. Try:

```json
{ "unsafe": true, "code": "(function(){ const m=document.body.innerHTML.match(/\"profilePage_(\\d+)\"/); return m?m[1]:null; })()" }
```

Omit the argument if it comes back null. Do not guess one.

## 5. Report

One line: considered / selected / sent / skipped, plus anything that looked off.

⛔ **Stray `about:blank` tabs: state the exact count you got from `grep -c` in step 1 of
preflight, verbatim.** Do not recount, re-estimate or round it here — use the number the
scripted count already gave you. Never call them orphaned, leaked, clutter or a bug, never
infer a cause, never offer to close them. The count churns up and down on its own; a new
number is not a finding.

⛔ **If this run aborted on the `Cannot read properties of undefined (reading 'snapshot')`
preflight error, the occurrence count from `state/preflight-abort-count.json` goes in this
report, not just in your head.** See the counter rule in the preflight section above — below
3 today, report the abort normally; 3 or more, state the count and that human intervention is
needed.
