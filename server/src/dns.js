import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./store.js";
import { runSudo, flushResolved } from "./sudo.js";

// dnsmasq reads every *.conf in this directory. We own this one file.
const BLOCKLIST_PATH = "/etc/dnsmasq.d/blocker-managed.conf";

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

/**
 * Build the dnsmasq blocklist. `address=/domain/IP` is a wildcard: it matches
 * the domain AND every subdomain, so no prefix enumeration is needed. We sink
 * both IPv4 (0.0.0.0) and IPv6 (::) so IPv6-capable clients can't slip past.
 */
function buildBlocklist(domains) {
  const bare = [...new Set(domains.map(normalizeDomain).filter(Boolean))];
  const lines = ["# Managed by the Blocker app - do not edit by hand."];
  for (const d of bare) {
    lines.push(`address=/${d}/0.0.0.0`);
    lines.push(`address=/${d}/::`);
  }
  return lines.join("\n") + "\n";
}

/**
 * Write the dnsmasq blocklist and reload the service.
 *
 * @param {string[]} blockedDomains domains that should be blocked right now
 * @param {string}   sudoPassword
 */
export async function applyBlockedDomains(blockedDomains, sudoPassword) {
  if (!sudoPassword) {
    throw new Error("Sudo password is not set. Set it in the UI first.");
  }

  const content = buildBlocklist(blockedDomains);
  const tmpPath = path.join(DATA_DIR, "blocker-managed.conf");
  fs.writeFileSync(tmpPath, content, { mode: 0o644 });

  await runSudo(["cp", tmpPath, BLOCKLIST_PATH], sudoPassword);
  fs.rmSync(tmpPath, { force: true });

  // `address=` lines live in the config (not a hosts file), so a SIGHUP reload
  // won't pick them up — dnsmasq must be restarted to apply changes.
  try {
    await runSudo(["systemctl", "restart", "dnsmasq"], sudoPassword);
  } catch (err) {
    throw new Error(
      `Could not restart dnsmasq (${err.message}). Have you run scripts/setup-dnsmasq.sh?`
    );
  }

  flushResolved(sudoPassword).catch(() => {});
}
