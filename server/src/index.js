import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// Load server/.env (key=value lines) into process.env if present. Uses Node's
// built-in env-file loader, so no extra dependency is required.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
  // No .env file is fine — env vars may be set another way.
}

import express from "express";
import cors from "cors";
import { BlockerService } from "./blocker.js";
import { verifySudoPassword } from "./sudo.js";
import { evaluateUnblockRequest } from "./llm.js";

const PORT = process.env.PORT || 4000;
const service = new BlockerService();

const app = express();
app.use(cors());
app.use(express.json());

// Wrap async handlers so thrown errors become JSON responses.
const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error(err);
    res.status(400).json({ error: err.message || "Something went wrong." });
  });

app.get("/api/status", (req, res) => {
  res.json({
    hasPassword: service.hasPassword(),
    sites: service.listSites(),
  });
});

app.get("/api/sites", (req, res) => {
  res.json(service.listSites());
});

app.post(
  "/api/sites",
  wrap(async (req, res) => {
    const site = await service.addSite(req.body || {});
    res.status(201).json(site);
  })
);

app.put(
  "/api/sites/:id",
  wrap(async (req, res) => {
    const site = await service.updateSite(req.params.id, req.body || {});
    res.json(site);
  })
);

app.delete(
  "/api/sites/:id",
  wrap(async (req, res) => {
    await service.removeSite(req.params.id);
    res.json({ ok: true });
  })
);

app.post(
  "/api/sites/:id/unblock",
  wrap(async (req, res) => {
    const site = await service.unblockSite(req.params.id);
    res.json(site);
  })
);

app.post(
  "/api/sites/:id/reblock",
  wrap(async (req, res) => {
    const site = await service.reblockSite(req.params.id);
    res.json(site);
  })
);

app.post(
  "/api/sites/:id/unblock-request",
  wrap(async (req, res) => {
    const { requestedTotal, reason } = req.body || {};
    const site = service.getSiteView(req.params.id);

    const requested = Number.parseInt(requestedTotal, 10);
    if (Number.isNaN(requested) || requested <= site.unblocksRemaining) {
      throw new Error(
        "Ask for more unblocks than you currently have available, or there is nothing to grant."
      );
    }
    if (!reason || !reason.trim()) {
      throw new Error("Please explain why you need the extra unblocks.");
    }

    const verdict = await evaluateUnblockRequest({
      domain: site.domain,
      currentRemaining: site.unblocksRemaining,
      dailyLimit: site.dailyUnblockLimit,
      requestedTotal: requested,
      reason: reason.trim(),
    });

    let updated = site;
    if (verdict.validated && verdict.increment > 0) {
      updated = await service.grantExtraUnblocks(site.id, verdict.increment);
    }

    res.json({ ...verdict, site: updated });
  })
);

app.post(
  "/api/password",
  wrap(async (req, res) => {
    const { password } = req.body || {};
    if (!password) throw new Error("Password is required.");
    await verifySudoPassword(password);
    service.setSudoPassword(password);
    // Re-apply current rules now that we can run sudo.
    await service.sync({ force: true });
    res.json({ ok: true });
  })
);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, async () => {
  console.log(`Blocker server listening on http://localhost:${PORT}`);
  // Reconcile + push DNS rules on boot if a password is stored.
  if (service.hasPassword()) {
    try {
      await service.sync({ force: true });
      console.log("Applied blocking rules to dnsmasq on startup.");
    } catch (err) {
      console.error("Could not apply rules on startup:", err.message);
    }
  } else {
    console.log("No sudo password stored yet. Set it from the UI to start blocking.");
  }
});

// Background scheduler: every 15s reconcile time (expiries, midnight reset)
// and push changes to dnsmasq.
setInterval(() => {
  if (!service.hasPassword()) return;
  service.sync().catch((err) => console.error("Scheduler sync failed:", err.message));
}, 15 * 1000);
