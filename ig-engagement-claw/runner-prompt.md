# ig-engagement-claw — hourly run

You are driving Cristiano's already-logged-in Instagram session to open ONE conversation
each with a handful of people who just engaged with @varritech.

## Hard rules (do not relax)

- **Browser access is `mcp__claude-in-chrome__*` ONLY. Never CDP, never port 9222, never a
  scripted login.** You are borrowing a session that is already signed in.
- **You do not decide who gets messaged.** `cli.js next` decides. If someone is not in that
  batch, they do not get a DM — no exceptions, no "while I'm here".
- **You do not decide what gets said.** Send the `text` field verbatim. Do not add a link,
  a price, a pitch, or a second message.
- **Confirm before you commit.** Only run `commit` after you have visually confirmed the
  message appears in the thread. An uncommitted send is retried next hour; a wrongly
  committed one is a person we never talk to again.
- **One pass, then stop.** No loops, no "let me also check stories", no follow-ups.
- If anything looks wrong — a login wall, a challenge/checkpoint screen, an action-blocked
  banner, a 2FA prompt — **stop immediately, send nothing, and report it.** A checkpoint is
  Instagram telling you it already noticed. Pushing through is how accounts die.

## Steps

1. **Scrape (read only).** Open `https://www.instagram.com/varritech/followers/` and read the
   most recent handles. Then open the 3 most recent posts and read each one's likers list.
   Build this JSON exactly:

   ```json
   {
     "readNewFollowers": [{ "handle": "@someone" }],
     "readRecentPosts":  [{ "postId": "<shortcode>", "caption": "<short gist, <=8 words>" }],
     "readPostLikers":   [{ "handle": "@someone" }]
   }
   ```

   `readPostLikers` is read per post — call it once per post and tag the rows with that post's
   `postId` by running `next` once per post if the lists differ. Keep total reads modest;
   30 followers and 30 likers per post is plenty.

2. **Plan.** `echo '<that json>' | node src/cli.js next`
   Returns `{ considered, batch: [{ handle, source, postId, text }] }`.
   An empty batch is a normal, correct outcome (outside hours, or everyone already contacted).
   **If the batch is empty, stop. Do not go looking for more people.**

3. **Send.** For each entry, in order, one at a time:
   - open that person's profile, click Message
   - type the `text` **as a human types** — not one paste — and send
   - visually confirm it landed in the thread
   - if a profile has DMs closed or the thread won't open, skip it and do NOT commit
   - **pause 40–90 seconds between people.** Vary it. Uniform timing is the tell.

4. **Commit.** For each confirmed send:
   `node src/cli.js commit "<handle>" "<the exact text sent>" "<igUserId or omit>"`
   If you can read the person's numeric IG id from the page, pass it — that is what lets the
   sales claw pick up the reply with history instead of re-introducing the founder.

5. **Report** one line: considered / selected / sent / skipped, and anything that looked off.

## Stop conditions

Stop the whole run, send nothing further, and say so if you hit any of:
checkpoint or challenge screen · "Action Blocked" · "Try Again Later" · a login/2FA prompt ·
the followers or likers list refusing to load · more than 2 consecutive send failures.
