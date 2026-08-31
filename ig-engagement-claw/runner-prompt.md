# ig-engagement-claw — one run

Runs every 5 minutes. **Most runs should do nothing** — that is correct, not a failure.
The send budget is wall-clock (`MAX_PER_HOUR` / `MAX_PER_DAY`), so frequent polling buys
you speed of response, not volume. If `next` returns an empty batch, stop immediately
and report "nothing to do". Never go looking for more people to fill a quota.

You are driving Cristiano's already-logged-in Instagram session to open ONE conversation
each with a handful of people who just engaged with @varritech.

## Browser access

**Use `mcp__browsermcp__*` ONLY.** Not claude-in-chrome, not CDP, not port 9222, never a
scripted login. You are borrowing a session that is already signed in, in the browser where
the Browser MCP extension is installed and showing **Connected**.

**Preflight — do this first, and abort the run if it fails:**

1. `mcp__browsermcp__browser_tab` → `{ "action": "list" }`
2. Find an existing `instagram.com` tab and **select it**:
   `mcp__browsermcp__browser_tab` → `{ "action": "select", "index": <n> }`.
   Only if there is no Instagram tab at all, open one:
   `{ "action": "new", "url": "https://www.instagram.com/" }`.
3. `mcp__browsermcp__browser_snapshot` → `{ "level": "minimal" }`

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

If that errors, times out, or comes back with no extension connected, **stop and report it** —
do not retry more than twice, and do not fall back to another browser tool. If the snapshot
shows a logged-out page or a login form, **stop**: the session isn't live and nothing below is
safe to attempt.

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

Only if the current tab is NOT on `/notifications/`, or its snapshot is
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
also outrank likers and followers when send budget is scarce, because their own
words are the one thing that makes an opener specific.

## 2. Plan

```
echo '<the rows json>' | node src/cli.js next
```

Returns `{ baseline, considered, batch: [{ handle, source, postId, text }] }`.

⛔ **`"baseline": true` means this was the first look ever.** It recorded where things
stood and planned nobody, on purpose — otherwise installing the claw would cold-DM
everyone who ever liked a post. Report it and stop.

An empty batch is the NORMAL outcome — nothing new, budget spent, or outside sending
hours. **If the batch is empty, stop.** Never go hunting for people to fill a quota.

## 3. Send — one at a time

For each entry in order:

1. `browser_navigate` → `https://www.instagram.com/<handle>/`
2. ⛔ **There is NO top-level "Message" button.** Only "Follow" renders on a
   stranger's profile. The DM action lives behind the **3-dots Options** menu:

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

6. `browser_screenshot` once more and **confirm the bubble is actually in the
   thread**, with a timestamp. The inbox row should also jump to the top.

⚠ `browser_type` sends the whole string in one shot — there is no per-character typing here.
So the realism has to come from the gaps: **wait 40–90 seconds between people, varied.** Never
the same interval twice. Uniform timing is the tell.

If a profile has DMs closed, the Message button is absent, or the thread won't open: **skip and
do not commit.** If two sends in a row fail, stop the whole run.

## 3b. Follow-ups — people who never answered

`next` also returns a `followUps` array. Each entry is someone we opened days ago
who has still said nothing. Cadence is 3 days after the opener, then 7 days after
that, and never again — at most two knocks, ever.

⛔ These are drafted and budgeted BEFORE cold openers, on purpose. There is always
another liker; a person only goes quiet once.

For each entry, in order:

1. Open their thread the same way as section 3 (profile → 3-dots → **Send message**).
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

   ⛔ The first follow-up normally hands them a free guide with a **price anchor and a
   URL**. Instagram's web composer accepts links fine — the old no-links rule came from
   the API claw, where InstantDM rejects any DM containing a URL, and does not apply to
   this path. But while `LINKS_BLOCKED=1` is set (see §1 above), `cli.js next` has
   already stripped the URL out of this `text` before you see it — send it verbatim,
   whatever it contains. Do not add a link back in yourself if it's missing.

   ```
   node src/cli.js followup-sent "<handle>" "<the exact text sent>"
   ```

5. Same pacing as cold sends: **wait 40–90 seconds between people, varied.**

If a thread will not open or the Message action is gone for a reason OTHER than the
"can't receive your message" banner (step 2 above), skip it and do NOT record
anything — it comes back around next run.

## 4. Commit — only what you saw land

```
node src/cli.js commit "<handle>" "<the exact text sent>" "<igUserId or omit>"
```

If you can read the person's numeric IG id off the page, pass it — that is what lets the sales
claw pick the reply up with history instead of re-introducing the founder. Try:

```json
{ "unsafe": true, "code": "(function(){ const m=document.body.innerHTML.match(/\"profilePage_(\\d+)\"/); return m?m[1]:null; })()" }
```

Omit the argument if it comes back null. Do not guess one.

## 5. Report

One line: considered / selected / sent / skipped, plus anything that looked off.
