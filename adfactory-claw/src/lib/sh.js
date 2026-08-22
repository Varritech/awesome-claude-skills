// Tiny promisified shell runner.
import { spawn } from "node:child_process";

export function sh(cmd, args, { cwd, env, capture } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let out = "",
      err = "";
    if (capture) {
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (err += d));
    }
    p.on("close", (code) =>
      code === 0 ? resolve(out.trim()) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`))
    );
    p.on("error", reject);
  });
}
