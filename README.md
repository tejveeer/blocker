# Website Blocker (Ubuntu)

Block distracting websites on Ubuntu using a local **dnsmasq** resolver, with a
React UI for adding sites, setting daily unblock allowances, and temporarily
unblocking them. dnsmasq gives true **wildcard** blocking (a domain *and* all of
its subdomains) from a single rule.

## Features

- **Add a site to block** — blocks the whole domain and every subdomain via a
  dnsmasq wildcard (`address=/reddit.com/0.0.0.0`), sinking both IPv4 and IPv6.
- **Unblock** — temporarily unblocks a site for a configured duration.
- **Daily allowance** — set how many times a site can be unblocked per day and
  for how long each time. Once you run out, the site stays blocked until the
  next day (local midnight).
- **Edit / delete** — change the domain, daily limit, or duration at any time.
- **Local sudo password** — stored locally so the app can update dnsmasq.

## How it works

The server owns a single dnsmasq config file, `/etc/dnsmasq.d/blocker-managed.conf`,
and rewrites it whenever blocking changes:

```
# Managed by the Blocker app - do not edit by hand.
address=/reddit.com/0.0.0.0
address=/reddit.com/::
```

`address=/domain/...` is a wildcard, so `reddit.com`, `www.reddit.com`,
`old.reddit.com`, etc. are all blocked by one rule. Because `address=` lines live
in the config (not a hosts file), dnsmasq is **restarted** to apply changes —
`SIGHUP`/reload would not pick them up.

A background scheduler re-blocks sites when their temporary unblock expires and
resets daily counters at midnight.

## One-time system setup

This makes dnsmasq the system resolver (behind systemd-resolved). It is
reversible (see below).

```bash
sudo ./scripts/setup-dnsmasq.sh
```

The script:

1. installs `dnsmasq` + `nftables` and writes the dnsmasq base config
   (loopback-only, upstream `1.1.1.1` / `8.8.8.8`),
2. points systemd-resolved at dnsmasq via `/etc/systemd/resolved.conf.d/blocker.conf`,
3. removes any old `/etc/hosts` blocking lines for your managed domains (backing
   up `/etc/hosts` to `/etc/hosts.blocker.bak`) — otherwise `nsswitch` checks
   `files` before `dns` and those lines would override dnsmasq,
4. installs an nftables ruleset + `blocker-doh.service` that prevents bypassing
   the resolver (see below),
5. enables and restarts the services.

### No browser changes needed

Browsers can normally sidestep system DNS via DNS-over-HTTPS (DoH). The setup
closes that without touching browser settings, using three layers:

- **Firefox canary:** dnsmasq returns `NXDOMAIN` for `use-application-dns.net`,
  which is Mozilla's documented signal for Firefox to disable automatic DoH.
- **Block DoH/DoT (nftables):** rejects DNS-over-TLS (port 853) and connections
  to known DoH resolver IPs on port 443.
- **Force port-53 DNS (nftables):** redirects all plaintext DNS to the local
  dnsmasq, so apps/VPNs with hardcoded DNS servers still go through it.

The firewall rules live in `/etc/blocker/doh.nft` and are applied on boot by
`blocker-doh.service`.

To revert everything:

```bash
sudo ./scripts/uninstall-dnsmasq.sh          # keep dnsmasq installed
sudo ./scripts/uninstall-dnsmasq.sh --purge  # also remove the package
```

## Setup (app)

Requires Node.js 18+ (tested on Node 22).

```bash
# from the project root
npm install                # installs concurrently (root)
npm run install:all        # installs server + client deps
```

## Run (development)

```bash
npm run dev
```

- Server: http://localhost:4000
- Client: http://localhost:5173 (proxies `/api` to the server)

Open the client, enter your sudo password once (it is verified and stored
locally under `server/data/config.json`), then start adding sites. Verify a
block with `dig reddit.com @127.0.0.1` (returns `0.0.0.0` when blocked).

## Notes & caveats

- **Security:** the sudo password is stored in plaintext in `server/data/`
  (which is gitignored). This is a local-only convenience tool; treat the file
  accordingly. Hardening (encryption / OS keychain) is a planned improvement.
- Browser DoH, DoT, and hardcoded plaintext DNS are handled by the setup script
  (see "No browser changes needed"). The DoH IP list covers the major providers
  (Cloudflare, Google, Quad9, OpenDNS, AdGuard, Mozilla); an obscure custom DoH
  endpoint could still slip through and can be added to `/etc/blocker/doh.nft`.
- DNS-based blocking still can't stop traffic that avoids domain resolution
  entirely (e.g. an app with a hardcoded IP address, or a full VPN tunnel).
- **Re-blocking is not instant for already-open pages.** DNS only controls *new*
  name lookups; it can't close TCP/QUIC connections the browser already has open.
  After you unblock a site, the browser caches its IP and keeps connections
  alive, so right after re-blocking an open tab (or a new tab that reuses the
  live connection) can still load it. The setup caps DNS TTL (`max-ttl=30`) so
  fresh lookups are blocked within ~30s; for an immediate block, close the
  site's tabs (or restart the browser).
- Run the server as your normal user — it calls `sudo` itself; do not run the
  whole app as root.

## Project structure

```
server/   Express API + dnsmasq manager + scheduler
client/   Vite + React UI (styled with Tailwind CSS v4)
scripts/  One-time dnsmasq + DoH-blocking setup / uninstall helpers
```
