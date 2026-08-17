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
- **You do not decide what gets said.** Send the `text` field verbatim. No link, no price, no
  pitch, no second message.
- **Confirm before you commit.** Only run `commit` after you have re-snapshotted the thread and
  seen the message in it. An uncommitted send is retried next hour; a wrongly committed one is
  a person we never talk to again.
- **One pass, then stop.** No loops, no stories, no follow-ups.
- Stop immediately on a login wall, checkpoint/challenge screen, "Action Blocked", "Try Again
  Later", or a 2FA prompt. A checkpoint is Instagram telling you it already noticed.

## 1. Read the notifications feed (READ ONLY)

The notifications feed already says who followed, who liked and who commented,
newest first.
Do NOT scrape the followers list — 674 rows, virtualized, and it cannot tell a
follower from 2024 apart from one from two minutes ago.

`browser_navigate` → `https://www.instagram.com/varritech/`, then open
**Notifications** from the left rail (`browser_snapshot` → click its ref).

⛔ Do NOT navigate straight to `/varritech/followers/` or a notifications URL —
Instagram renders those panels only via the in-app click path. A direct
navigation gives you a page with no dialog on it and looks like "no results".

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
2. `browser_snapshot` → find the **Message** button, then
   `mcp__browsermcp__browser_click` → `{ "ref": "<ref>", "element": "Message button" }`
3. ⛔ **Check the thread is empty before typing anything.** Snapshot it. If there is
   ANY prior message — from them or from us, however old — we have already talked to
   this person. Do NOT send. Back out and record it so they are never reconsidered:

   ```
   node src/cli.js skip "<handle>" existing-thread
   ```

   This is the difference between "we haven't messaged them" and "this claw hasn't
   messaged them". The ledger only knows its own sends; years of existing threads and
   everything the sales claw has opened are invisible to it. You are the only thing
   that can see them. A skip costs no send budget.
4. Snapshot again, find the message textbox, then
   `mcp__browsermcp__browser_type` → `{ "ref": "<ref>", "text": "<the exact text>", "submit": false }`
5. **Pause a beat**, then `mcp__browsermcp__browser_press_key` → `{ "key": "Enter" }`
6. `browser_snapshot` once more and **confirm the message is actually in the thread**

⚠ `browser_type` sends the whole string in one shot — there is no per-character typing here.
So the realism has to come from the gaps: **wait 40–90 seconds between people, varied.** Never
the same interval twice. Uniform timing is the tell.

If a profile has DMs closed, the Message button is absent, or the thread won't open: **skip and
do not commit.** If two sends in a row fail, stop the whole run.

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
