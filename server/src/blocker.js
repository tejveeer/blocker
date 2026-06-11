import { randomUUID } from "node:crypto";
import { loadConfig, saveConfig } from "./store.js";
import { applyBlockedDomains, normalizeDomain } from "./dns.js";

/** Local date key like "2026-06-09" used to detect day rollover. */
function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function now() {
  return Date.now();
}

/** A site is temporarily unblocked if it has a future expiry timestamp. */
function isTemporarilyUnblocked(site) {
  return site.unblockExpiresAt != null && now() < site.unblockExpiresAt;
}

/**
 * Mutate sites in place to reflect the passage of time:
 * - reset daily counters at midnight
 * - clear expired temporary unblocks
 * Returns true if anything changed.
 */
function reconcileTime(sites) {
  let changed = false;
  const key = todayKey();
  for (const site of sites) {
    if (site.lastResetDate !== key) {
      site.lastResetDate = key;
      site.unblocksUsedToday = 0;
      changed = true;
    }
    if (site.unblockExpiresAt != null && now() >= site.unblockExpiresAt) {
      site.unblockExpiresAt = null;
      changed = true;
    }
  }
  return changed;
}

/** Domains that should currently be present in /etc/hosts (i.e. blocked). */
function blockedDomains(sites) {
  return sites.filter((s) => !isTemporarilyUnblocked(s)).map((s) => s.domain);
}

/** Shape a site for the API/UI, including derived runtime state. */
function toView(site) {
  const tempUnblocked = isTemporarilyUnblocked(site);
  const remaining = Math.max(0, site.dailyUnblockLimit - site.unblocksUsedToday);
  let status;
  if (tempUnblocked) status = "unblocked";
  else if (remaining === 0) status = "locked"; // out of unblocks until tomorrow
  else status = "blocked";
  return {
    id: site.id,
    domain: site.domain,
    dailyUnblockLimit: site.dailyUnblockLimit,
    unblockDurationMinutes: site.unblockDurationMinutes,
    unblocksUsedToday: site.unblocksUsedToday,
    unblocksRemaining: remaining,
    unblockExpiresAt: tempUnblocked ? site.unblockExpiresAt : null,
    status,
  };
}

export class BlockerService {
  constructor() {
    this.config = loadConfig();
    this.persist(); // normalize file on first boot
  }

  persist() {
    saveConfig(this.config);
  }

  hasPassword() {
    return Boolean(this.config.sudoPassword);
  }

  setSudoPassword(password) {
    this.config.sudoPassword = password || "";
    this.persist();
  }

  /** Recompute time-based state and push the result to /etc/hosts if needed. */
  async sync({ force = false } = {}) {
    const changed = reconcileTime(this.config.sites);
    if (changed || force) {
      // Apply the DNS rules first; only persist once the write succeeds so a
      // failed write never leaves config.json out of sync with the system.
      await applyBlockedDomains(blockedDomains(this.config.sites), this.config.sudoPassword);
      this.persist();
    }
    return this.listSites();
  }

  listSites() {
    reconcileTime(this.config.sites);
    return this.config.sites.map(toView);
  }

  getSiteOrThrow(id) {
    const site = this.config.sites.find((s) => s.id === id);
    if (!site) throw new Error("Site not found.");
    return site;
  }

  /** Current UI-shaped view of a single site (with up-to-date counters). */
  getSiteView(id) {
    reconcileTime(this.config.sites);
    return toView(this.getSiteOrThrow(id));
  }

  async addSite({ domain, dailyUnblockLimit, unblockDurationMinutes }) {
    const normalized = normalizeDomain(domain);
    if (!normalized) throw new Error("A valid domain is required.");
    if (this.config.sites.some((s) => s.domain === normalized)) {
      throw new Error(`"${normalized}" is already in the list.`);
    }
    const site = {
      id: randomUUID(),
      domain: normalized,
      dailyUnblockLimit: clampInt(dailyUnblockLimit, 0, 100, 3),
      unblockDurationMinutes: clampInt(unblockDurationMinutes, 1, 24 * 60, 30),
      unblocksUsedToday: 0,
      lastResetDate: todayKey(),
      unblockExpiresAt: null,
    };
    this.config.sites.push(site);
    try {
      await this.sync({ force: true });
    } catch (err) {
      // Roll back the in-memory addition if we couldn't write /etc/hosts.
      this.config.sites = this.config.sites.filter((s) => s.id !== site.id);
      throw err;
    }
    return toView(site);
  }

  async updateSite(id, { domain, dailyUnblockLimit, unblockDurationMinutes }) {
    const site = this.getSiteOrThrow(id);
    if (domain !== undefined) {
      const normalized = normalizeDomain(domain);
      if (!normalized) throw new Error("A valid domain is required.");
      if (this.config.sites.some((s) => s.domain === normalized && s.id !== id)) {
        throw new Error(`"${normalized}" is already in the list.`);
      }
      site.domain = normalized;
    }
    if (dailyUnblockLimit !== undefined) {
      site.dailyUnblockLimit = clampInt(dailyUnblockLimit, 0, 100, site.dailyUnblockLimit);
    }
    if (unblockDurationMinutes !== undefined) {
      site.unblockDurationMinutes = clampInt(
        unblockDurationMinutes,
        1,
        24 * 60,
        site.unblockDurationMinutes
      );
    }
    await this.sync({ force: true });
    return toView(site);
  }

  async removeSite(id) {
    const idx = this.config.sites.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Site not found.");
    this.config.sites.splice(idx, 1);
    await this.sync({ force: true });
  }

  /** Temporarily unblock a site if the user still has unblocks left today. */
  async unblockSite(id) {
    const site = this.getSiteOrThrow(id);
    reconcileTime(this.config.sites);
    if (isTemporarilyUnblocked(site)) {
      return toView(site); // already unblocked
    }
    const remaining = site.dailyUnblockLimit - site.unblocksUsedToday;
    if (remaining <= 0) {
      throw new Error(
        `No unblocks left for "${site.domain}" today. It stays blocked until tomorrow.`
      );
    }
    site.unblocksUsedToday += 1;
    site.unblockExpiresAt = now() + site.unblockDurationMinutes * 60 * 1000;
    await this.sync({ force: true });
    return toView(site);
  }

  /**
   * Grant extra unblocks for *today only* by crediting back used unblocks.
   * This raises today's remaining count without changing the standing daily
   * limit, so the grant naturally disappears at the next midnight reset.
   */
  async grantExtraUnblocks(id, increment) {
    const site = this.getSiteOrThrow(id);
    reconcileTime(this.config.sites);
    const amount = Math.max(0, Math.trunc(increment));
    if (amount > 0) {
      site.unblocksUsedToday = Math.max(0, site.unblocksUsedToday - amount);
      await this.sync({ force: true });
    }
    return toView(site);
  }

  /**
   * Permanently change the standing daily unblock limit by `delta` (may be
   * negative to reduce it). Clamped to [0, 100].
   */
  async changeDailyLimit(id, delta) {
    const site = this.getSiteOrThrow(id);
    reconcileTime(this.config.sites);
    const next = Math.min(100, Math.max(0, site.dailyUnblockLimit + Math.trunc(delta)));
    if (next !== site.dailyUnblockLimit) {
      site.dailyUnblockLimit = next;
      await this.sync({ force: true });
    }
    return toView(site);
  }

  /** Re-block a site immediately, ending any active temporary unblock early. */
  async reblockSite(id) {
    const site = this.getSiteOrThrow(id);
    site.unblockExpiresAt = null;
    await this.sync({ force: true });
    return toView(site);
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
