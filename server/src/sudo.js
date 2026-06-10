import { spawn } from "node:child_process";

/**
 * Run a command via sudo, feeding the password to `sudo -S` over stdin.
 * `-k` ignores any cached credentials so a wrong stored password fails fast.
 */
export function runSudo(args, password) {
  return new Promise((resolve, reject) => {
    const child = spawn("sudo", ["-S", "-k", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      const msg = stderr.toLowerCase();
      if (msg.includes("incorrect password") || msg.includes("sorry, try again")) {
        return reject(new Error("Incorrect sudo password."));
      }
      reject(new Error(stderr.trim() || `sudo exited with code ${code}`));
    });
    child.stdin.write(password + "\n");
    child.stdin.end();
  });
}

/** Verify the sudo password works without changing anything. */
export async function verifySudoPassword(password) {
  await runSudo(["true"], password);
  return true;
}

/** Best-effort DNS cache flush; ignore failures (not all systems have it). */
export async function flushResolved(password) {
  try {
    await runSudo(["resolvectl", "flush-caches"], password);
  } catch {
    /* ignore */
  }
}
