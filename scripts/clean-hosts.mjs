// Removes the Blocker v1 managed block and any manual host entries that target
// a managed domain (or its subdomains) from /etc/hosts. With dnsmasq doing the
// blocking, leftover /etc/hosts lines would override DNS (nsswitch checks
// "files" before "dns") and make unblock appear broken.
//
// Usage: node clean-hosts.mjs /path/to/config.json   (must run as root)

import fs from "node:fs";
import os from "node:os";

const HOSTS = "/etc/hosts";
const configPath = process.argv[2];

function normalize(input) {
  if (!input) return "";
  let d = String(input).trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0].split(":")[0].replace(/^www\./, "");
  return d.trim();
}

const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
const bare = [...new Set((cfg.sites || []).map((s) => normalize(s.domain)).filter(Boolean))];

function matches(host) {
  const h = String(host).toLowerCase().split("/")[0];
  return bare.some((d) => h === d || h.endsWith("." + d));
}

let text = fs.readFileSync(HOSTS, "utf8");
text = text.replace(/# === BLOCKER MANAGED START[\s\S]*?# === BLOCKER MANAGED END ===\n?/g, "");

const hostLine = /^\s*#?\s*\d{1,3}(?:\.\d{1,3}){3}\s+(\S+)/;
const kept = text.split("\n").filter((line) => {
  const m = line.match(hostLine);
  if (!m) return true;
  return !matches(m[1]);
});

let result = kept.join("\n").replace(/\s+$/, "");

// Make sure the standard loopback entries are present. Routing DNS through
// dnsmasq means localhost is no longer synthesized by systemd-resolved, so a
// missing "127.0.0.1 localhost" line breaks tools that resolve localhost.
if (!/^\s*[\d.]+\s+.*\blocalhost\b/m.test(result)) {
  const host = os.hostname();
  const loopback = [
    "127.0.0.1\tlocalhost",
    `127.0.1.1\t${host}`,
    "",
    "::1     ip6-localhost ip6-loopback",
    "fe00::0 ip6-localnet",
    "ff00::0 ip6-mcastprefix",
    "ff02::1 ip6-allnodes",
    "ff02::2 ip6-allrouters",
  ].join("\n");
  result = result ? `${loopback}\n\n${result}` : loopback;
  console.log("Restored standard localhost entries to /etc/hosts.");
}

fs.writeFileSync(HOSTS, result + "\n");
console.log(`Cleaned /etc/hosts of ${bare.length} managed domain(s).`);
