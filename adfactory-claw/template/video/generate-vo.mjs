import { writeFileSync, mkdirSync } from "fs";

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error("ELEVENLABS_API_KEY not set"); process.exit(1); }

const VOICE = "TX3LPaxmHKxFdv7VOQHJ"; // Liam
const MODEL = "eleven_multilingual_v2";

const SCRIPT = "Your founder friends are imaginary. I'm serious. So I joined a community where they're real. Founders who get it. Warm intros. Demo days. They put your story in front of thousands of other builders. Because the only people who actually understand the grind... are other founders. Join free at varritech dot com slash community.";

const SETTINGS = { stability: 0.4, similarity_boost: 0.75, style: 0.45, speed: 1.04 };

const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
  method: "POST",
  headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
  body: JSON.stringify({ text: SCRIPT, model_id: MODEL, voice_settings: SETTINGS }),
});

if (!res.ok) { console.error("ElevenLabs error", res.status, await res.text()); process.exit(1); }

mkdirSync("public", { recursive: true });
const buf = Buffer.from(await res.arrayBuffer());
writeFileSync("public/vo.mp3", buf);
console.log(`Wrote public/vo.mp3 (${buf.length} bytes)`);
