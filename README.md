# Website Blocker (Ubuntu)

Block distracting websites on Ubuntu by managing entries in `/etc/hosts`, with a
React UI for adding sites, setting daily unblock allowances, and temporarily
unblocking them.

## Features

- **Add a site to block** — blocks the whole domain (bare plus `www.`, `m.`,
  `mobile.`, `old.`, `new.`, `np.` subdomains) by pointing it at `0.0.0.0`.
- **Unblock** — temporarily unblocks a site for a configured duration.
- **Daily allowance** — set how many times a site can be unblocked per day and
  for how long each time. Once you run out, the site stays blocked until the
  next day (local midnight).
- **Edit / delete** — change the domain, daily limit, or duration at any time.
- **Local sudo password** — stored locally so the app can write `/etc/hosts`.

## How it works

The server keeps a managed block inside `/etc/hosts` delimited by markers:

```
# === BLOCKER MANAGED START (do not edit this block) ===
0.0.0.0 reddit.com
0.0.0.0 www.reddit.com
0.0.0.0 m.reddit.com
# === BLOCKER MANAGED END ===
```

Everything outside those markers is left untouched, **except** pre-existing
entries (commented or not) that target a domain the app manages — those are
removed so the managed block is the single source of truth (otherwise a leftover
manual `127.0.0.1 reddit.com` line would keep a site blocked even after you
unblock it). The original `/etc/hosts` is backed up once to
`server/data/hosts.backup` before the first modification.

A background scheduler re-blocks sites when their temporary unblock expires and
resets daily counters at midnight.

## Setup

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
locally under `server/data/config.json`), then start adding sites.

## Notes & caveats

- **Security:** the sudo password is stored in plaintext in `server/data/`
  (which is gitignored). This is a local-only convenience tool; treat the file
  accordingly. Hardening (encryption / OS keychain) is a planned improvement.
- `/etc/hosts` blocking does not stop traffic that bypasses DNS (e.g. apps using
  hardcoded IPs or DoH). The app flushes the systemd-resolved cache on changes,
  but browsers may still cache DNS/connections briefly.
- Run the server as your normal user — it calls `sudo` itself to edit
  `/etc/hosts`; do not run the whole app as root.

## Project structure

```
server/   Express API + /etc/hosts manager + scheduler
client/   Vite + React UI (styled with Tailwind CSS v4)
```
