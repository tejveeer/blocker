import express from "express";
import cors from "cors";
import { BlockerService } from "./blocker.js";
import { verifySudoPassword } from "./sudo.js";

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
