import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { DATA_DIR } from "./store.js";

const HOSTS_PATH = "/etc/hosts";
const MARK_START = "# === BLOCKER MANAGED START (do not edit this block) ===";
const MARK_END = "# === BLOCKER MANAGED END ===";
const REDIRECT_IP = "0.0.0.0";

// Subdomain prefixes we add for every blocked domain so the "whole domain" is
// covered as much as /etc/hosts allows (it has no wildcard support).
const SUBDOMAIN_PREFIXES = ["", "www.", "m."];

/**
 * Normalize user input into a bare registrable-ish domain.
 * Strips scheme, path, port and a leading "www.".
 */
export function normalizeDomain(input) {
  if (!input) return "";
  let d = String(input).trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0];
  d = d.split(":")[0];
  d = d.replace(/^www\./, "");
  return d.trim();
}

/** Expand a bare domain into all the host entries we want to block. */
export function expandDomain(domain) {
  const bare = normalizeDomain(domain);
  if (!bare) return [];
  return SUBDOMAIN_PREFIXES.map((p) => `${p}${bare}`);
}

/** Read the current /etc/hosts contents (readable without sudo). */
function readHosts() {
  return fs.readFileSync(HOSTS_PATH, "utf8");
}

/** Remove our managed block from arbitrary hosts text. */
function stripManagedBlock(text) {
  const startIdx = text.indexOf(MARK_START);
  const endIdx = text.indexOf(MARK_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return text.replace(/\s+$/, "") + "\n";
  }
  const before = text.slice(0, startIdx);
  const after = text.slice(endIdx + MARK_END.length);
  const combined = (before.replace(/\s+$/, "") + "\n" + after.replace(/^\s+/, "")).replace(
    /\s+$/,
    ""
  );
  return combined + "\n";
}

/** Build the managed block text for the given list of blocked domains. */
function buildManagedBlock(domains) {
  const lines = [MARK_START];
  for (const domain of domains) {
    for (const host of expandDomain(domain)) {
      lines.push(`${REDIRECT_IP} ${host}`);
    }
  }
  lines.push(MARK_END);
  return lines.join("\n") + "\n";
}

/**
 * Run a command via sudo, feeding the password to `sudo -S` over stdin.
 */
function runSudo(args, password) {
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

/**
 * Write the desired set of blocked domains into /etc/hosts, preserving every
 * line outside our managed block.
 */
export async function applyBlockedDomains(domains, sudoPassword) {
  if (!sudoPassword) {
    throw new Error("Sudo password is not set. Set it in Settings first.");
  }
  const current = readHosts();
  const base = stripManagedBlock(current);
  const managed = buildManagedBlock(domains);
  const next = base.replace(/\s+$/, "") + "\n\n" + managed;

  const tmpPath = path.join(DATA_DIR, "hosts.new");
  fs.writeFileSync(tmpPath, next, { mode: 0o600 });

  await runSudo(["cp", tmpPath, HOSTS_PATH], sudoPassword);
  fs.rmSync(tmpPath, { force: true });

  // Best-effort DNS cache flush; ignore failures (not all systems have these).
  flushDns(sudoPassword).catch(() => {});
}

async function flushDns(sudoPassword) {
  try {
    await runSudo(["resolvectl", "flush-caches"], sudoPassword);
  } catch {
    /* ignore */
  }
}

/** Verify the sudo password works without changing anything. */
export async function verifySudoPassword(password) {
  await runSudo(["true"], password);
  return true;
}
