#!/usr/bin/env python3
"""
Higgsfield nano_banana_pro driver — EDIT an existing ad creative, don't generate a new one.

The claw's variant loop needs a small *visual* delta on a proven creative, not a fresh
composition. nano_banana_pro takes the live ad as an image reference and changes one
named element while holding everything else, which is the image-model equivalent of the
CSS clean-plate edit in [[meta-ad-inplace-variants]].

Every trap below cost a round trip at least once; they are all load-bearing.

  ⛔ AUTH: refresh, don't re-auth. The access token is 3600s but the refresh token is 7
     days (refresh_expires_in 604800). Always try POST /refresh with the stored
     refresh_token before sending anyone through the 15-minute device-code dance.
     The rotation MUST be persisted or the next refresh fails.

  ⛔ ARG NESTING differs per tool. generate_* nests under {"params": {...}}; every other
     tool is flat. Getting it wrong on some tools fails silently with a 200 and a
     plausible-looking wrong response, so the rule is expressed as a predicate, never an
     allow-list (an allow-list rots and then blames your arguments).

  ⛔ job_status takes `jobId` (camelCase). `job_id` fails validation.

  ⛔ Responses are SSE (`data: ` prefixed) AND the JSON is followed by trailing prose, so
     json.loads dies with "Extra data". Use raw_decode and keep the remainder.

  ⛔ The finished job's response ECHOES THE INPUT image URL alongside the output. A naive
     "first https URL" regex downloads the source back and it looks like a no-op edit —
     byte-identical size is the tell. Exclude the known input URLs explicitly.

  ⛔ ASPECT/RESOLUTION are NOT inherited from the source. Omit them and a 4:5 ad comes
     back as the model's own 3:4 1k default — a silently cropped, downscaled ad.
     nano_banana_pro's real media role is `image_references`, not `image`.

  ⛔ RESOLUTION 4k, not the 2k default, whenever the image carries text. At 2k this model
     drifts glyphs ("Badges" -> "Radges"); 4k holds them. An ad is all text.

  ⛔ The PRESET GATE: a prompt resembling a stock preset returns a recommendation instead
     of a job, spends nothing, and still contains a UUID — so a naive UUID grab polls a
     preset forever. Detect the notice and retry with declined_preset_id.
"""
import json, os, re, subprocess, sys, time

MCP = "https://mcp.higgsfield.ai/mcp"
AUTH = "https://fnf-device-auth.higgsfield.ai"
TOKEN_FILE = os.environ.get("HF_TOKEN_FILE", "/tmp/hf-token.json")
DEC = json.JSONDecoder()


def _curl(url, payload, headers):
    cmd = ["curl", "-s", "-X", "POST", url]
    for h in headers:
        cmd += ["-H", h]
    cmd += ["--data-binary", "@-"]
    p = subprocess.run(cmd, input=json.dumps(payload), capture_output=True, text=True)
    return p.stdout


def refresh_token():
    """Rotate the stored token. Returns the fresh access token."""
    with open(TOKEN_FILE) as f:
        tok = json.load(f)
    out = _curl(f"{AUTH}/refresh", {"refresh_token": tok["refresh_token"]},
                ["Content-Type: application/json"])
    new = json.loads(out)
    if "access_token" not in new:
        raise RuntimeError(f"refresh failed: {out[:300]}")
    with open(TOKEN_FILE, "w") as f:
        json.dump(new, f)          # persist the ROTATED refresh_token or the next call dies
    return new["access_token"]


def access_token():
    with open(TOKEN_FILE) as f:
        return json.load(f)["access_token"]


def call(tool, args, token):
    # generate_* nests; everything else is flat. A predicate, not a list — see docstring.
    arguments = {"params": args} if tool.startswith("generate_") else args
    payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
               "params": {"name": tool, "arguments": arguments}}
    raw = _curl(MCP, payload, [
        f"Authorization: Bearer {token}",
        "Content-Type: application/json",
        "Accept: application/json, text/event-stream",
    ])
    body = "\n".join(l[6:] if l.startswith("data: ") else l for l in raw.splitlines())
    body = "\n".join(l for l in body.splitlines() if l.startswith("{"))
    if not body.strip():
        return ""
    obj, _ = DEC.raw_decode(body)
    if "error" in obj and obj.get("error"):
        raise RuntimeError(f"{tool}: {obj['error']}")
    return obj["result"]["content"][0]["text"]


def import_image(url, token):
    txt = call("media_import_url", {"url": url, "type": "image"}, token)
    # ⛔ The id comes back in PROSE, not JSON: "Imported and confirmed image URL. Pass
    # media_id <uuid> as medias[].value in generation tools." A JSON-shaped regex finds
    # nothing and the call looks like it failed when it actually succeeded.
    m = (re.search(r'media_id\s+([0-9a-f-]{36})', txt)
         or re.search(r'"(?:media_id|id)"\s*:\s*"([0-9a-f-]{36})"', txt)
         or re.search(r'([0-9a-f-]{36})', txt))
    if not m:
        raise RuntimeError(f"no media_id: {txt[:400]}")
    return m.group(1)


def submit_edit(media_id, prompt, token, aspect_ratio="4:5", resolution="4k",
                model="nano_banana_pro", declined=None):
    args = {
        "model": model,
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,   # NOT inherited from the source
        "resolution": resolution,       # 4k: this image is all text
        "medias": [{"value": media_id, "role": "image_references"}],
    }
    if declined:
        args["declined_preset_id"] = declined
    txt = call("generate_image", args, token)

    if "looks like the Higgsfield preset" in txt or "preset_recommendation" in txt:
        pid = re.search(r'[0-9a-f-]{36}', txt).group(0)
        return submit_edit(media_id, prompt, token, aspect_ratio, resolution, model, declined=pid)

    m = re.search(r'^-\s+([0-9a-f-]{36})', txt.split("Submitted", 1)[-1], re.M) \
        or re.search(r'"(?:job_id|id)"\s*:\s*"([0-9a-f-]{36})"', txt)
    if not m:
        raise RuntimeError(f"no job id: {txt[:400]}")
    return m.group(1)


def poll(job_id, token, exclude_urls=(), tries=90, every=8):
    """Wait for the edit. `exclude_urls` must contain the INPUT url — the finished job
    echoes it, and grabbing it looks exactly like an edit that changed nothing."""
    dead = 0
    for _ in range(tries):
        try:
            txt = call("job_status", {"jobId": job_id}, token)   # camelCase, flat
            dead = 0
        except Exception:
            dead += 1
            if dead >= 3:
                raise RuntimeError(f"job {job_id} errored 3x — treat as dead, resubmit")
            time.sleep(every)
            continue
        urls = [u for u in re.findall(r'https://[^\s"\\]+\.(?:png|jpg|jpeg|webp)', txt)
                if u not in exclude_urls]
        if urls and ("completed" in txt or "COMPLETED" in txt):
            return urls[-1]
        if "failed" in txt.lower() and "retryable" in txt.lower():
            raise RuntimeError(f"job {job_id} failed server-side")
        time.sleep(every)
    raise RuntimeError(f"job {job_id} silent past {tries*every}s — resubmit")


def edit_creative(src_url, prompt, dest, token=None, **kw):
    """Public entry: live ad URL + 'change only X' prompt -> local edited PNG."""
    token = token or refresh_token()
    mid = import_image(src_url, token)
    jid = submit_edit(mid, prompt, token, **kw)
    out = poll(jid, token, exclude_urls=(src_url,))
    subprocess.run(["curl", "-sL", "-o", dest, out], check=True)
    return {"media_id": mid, "job_id": jid, "url": out, "path": dest}


# The lock preamble. Without it the model re-composes the ad instead of editing it.
LOCK = (
    "This is an existing finished advertisement. Keep it EXACTLY as it is: identical "
    "layout, identical composition, identical framing, identical fonts, identical "
    "colours, identical spacing, identical logo. Reproduce every text label, number and "
    "word EXACTLY as in the source, character for character, with no rewording and no "
    "new text anywhere. Do not crop, do not zoom, do not re-render the layout. "
    "Change ONE thing only: "
)

if __name__ == "__main__":
    src, prompt, dest = sys.argv[1], sys.argv[2], sys.argv[3]
    print(json.dumps(edit_creative(src, LOCK + prompt, dest), indent=1))
