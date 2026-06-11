import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, ShieldBan, X } from "lucide-react";

import { api } from "./api.js";
import { cn } from "@/lib/utils";
import PasswordGate from "./components/PasswordGate.jsx";
import AddSiteForm from "./components/AddSiteForm.jsx";
import SiteCard from "./components/SiteCard.jsx";
import UnblockRequest from "./components/UnblockRequest.jsx";
import ThemeToggle from "@/components/theme-toggle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { fadeInUp, listContainer, listItem } from "@/lib/motion";

const NAV = [
  { id: "sites", label: "Sites" },
  { id: "requests", label: "Unblock requests" },
];

export default function App() {
  const [hasPassword, setHasPassword] = useState(true);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState("sites");

  const refresh = useCallback(async () => {
    try {
      const status = await api.status();
      setHasPassword(status.hasPassword);
      setSites(status.sites);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleError = (err) => setError(err.message || String(err));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <motion.header
        {...fadeInUp}
        className="flex items-start justify-between gap-4"
      >
        <div className="flex items-start gap-3">
          <motion.div
            initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.05 }}
            className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary"
          >
            <ShieldBan className="size-6" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Website Blocker</h1>
            <p className="mt-1 text-muted-foreground">
              Block distractions on Ubuntu via{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-[0.85em]">dnsmasq</code>.
            </p>
          </div>
        </div>
        <ThemeToggle />
      </motion.header>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-5"
          >
            <Alert variant="destructive" className="flex items-center justify-between gap-3">
              <AlertDescription>{error}</AlertDescription>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setError("")}
                aria-label="Dismiss error"
                className="size-7 text-destructive hover:bg-destructive/10"
              >
                <X className="size-4" />
              </Button>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.08 }}>
        <PasswordGate hasPassword={hasPassword} onSaved={refresh} onError={handleError} />
      </motion.div>

      {hasPassword && (
        <>
          <motion.nav
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="mt-6 inline-flex gap-1 rounded-lg border bg-muted/40 p-1"
          >
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={cn(
                  "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                  page === item.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </motion.nav>

          {page === "sites" ? (
            <>
              <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.12 }}>
                <AddSiteForm onAdded={refresh} onError={handleError} />
              </motion.div>

              <motion.section
                className="mt-5 flex flex-col gap-3"
                variants={listContainer}
                initial="initial"
                animate="animate"
              >
                <AnimatePresence mode="popLayout">
                  {sites.length === 0 ? (
                    <motion.p
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mt-7 text-center text-muted-foreground"
                    >
                      No sites yet. Add one above to start blocking.
                    </motion.p>
                  ) : (
                    sites.map((site) => (
                      <motion.div key={site.id} variants={listItem} layout exit="exit">
                        <SiteCard site={site} onChanged={refresh} onError={handleError} />
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </motion.section>
            </>
          ) : (
            <UnblockRequest sites={sites} onChanged={refresh} onError={handleError} />
          )}
        </>
      )}

      <footer className="mt-7 text-center text-sm text-muted-foreground">
        {sites.length} site{sites.length === 1 ? "" : "s"} managed
      </footer>
    </div>
  );
}
