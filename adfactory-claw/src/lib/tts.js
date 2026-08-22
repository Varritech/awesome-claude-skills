// ElevenLabs Liam VO. Writes mp3 to outPath. On no-key/failure writes a short
// silent mp3 so the render still has an audio track (never hard-fails the build).
import fs from "node:fs";
import path from "node:path";
import { sh } from "./sh.js";
import { config } from "../config.js";

export async function ttsLiam(text, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const key = config.eleven.apiKey;
  if (key && text) {
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${config.eleven.voiceId}`,
        {
          method: "POST",
          headers: { "xi-api-key": key, "content-type": "application/json" },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2_5",
            voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.3 },
          }),
        }
      );
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(outPath, buf);
        return outPath;
      }
      console.error("[tts] eleven failed", res.status, (await res.text()).slice(0, 200));
    } catch (e) {
      console.error("[tts] eleven error", e.message);
    }
  }
  // fallback: 29.5s silent track
  await sh("ffmpeg", [
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
    "-t", "29.5", "-q:a", "9", "-y", outPath, "-loglevel", "error",
  ]);
  return outPath;
}
