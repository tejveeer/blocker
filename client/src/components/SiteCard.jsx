import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, ShieldOff, Timer, Trash2, Unlock } from "lucide-react";

import { api } from "../api.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(() => calc(expiresAt));
  useEffect(() => {
    setRemaining(calc(expiresAt));
    if (!expiresAt) return;
    const id = setInterval(() => setRemaining(calc(expiresAt)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

function calc(expiresAt) {
  if (!expiresAt) return 0;
  return Math.max(0, expiresAt - Date.now());
}

function formatMs(ms) {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatDuration(minutes) {
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  return `${minutes} min`;
}

const STATUS = {
  blocked: { label: "Blocked", variant: "destructive", dot: "bg-destructive" },
  unblocked: { label: "Unblocked", variant: "success", dot: "bg-success" },
  locked: { label: "Locked until tomorrow", variant: "muted", dot: "bg-muted-foreground" },
};

export default function SiteCard({ site, onChanged, onError }) {
  const [busy, setBusy] = useState(false);
  const remaining = useCountdown(site.unblockExpiresAt);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  };

  // A 0/0 site has no unblock allowance at all — it's simply blocked, so don't
  // present it as "locked until tomorrow".
  const effectiveStatus =
    site.status === "locked" && site.dailyUnblockLimit === 0 ? "blocked" : site.status;
  const status = STATUS[effectiveStatus];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-2.5">
                {site.status === "unblocked" && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                )}
                <span className={`relative inline-flex size-2.5 rounded-full ${status.dot}`} />
              </span>
              <h3 className="text-lg font-semibold">{site.domain}</h3>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                {site.unblocksRemaining} of {site.dailyUnblockLimit} unblocks left today
              </span>
              <span>·</span>
              <span>{formatDuration(site.unblockDurationMinutes)} each</span>
              {site.status === "unblocked" && (
                <>
                  <span>·</span>
                  <motion.span
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-1 tabular-nums text-warning"
                  >
                    <Timer className="size-3.5" />
                    re-blocks in {formatMs(remaining)}
                  </motion.span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {site.status === "unblocked" ? (
              <Button
                variant="warning"
                disabled={busy}
                onClick={() => run(() => api.reblock(site.id))}
              >
                <ShieldOff className="size-4" />
                Block now
              </Button>
            ) : (
              <Button
                disabled={busy || site.status === "locked"}
                onClick={() => run(() => api.unblock(site.id))}
                title={site.status === "locked" ? "No unblocks left today" : ""}
              >
                {site.status === "locked" ? (
                  <Lock className="size-4" />
                ) : (
                  <Unlock className="size-4" />
                )}
                Unblock
              </Button>
            )}
            <Button
              variant="destructive"
              size="icon"
              disabled={busy}
              onClick={() => {
                if (confirm(`Remove ${site.domain} from the blocker?`)) {
                  run(() => api.removeSite(site.id));
                }
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
