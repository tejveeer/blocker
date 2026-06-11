import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Lock, Pencil, ShieldOff, Timer, Trash2, Unlock } from "lucide-react";

import { api } from "../api.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { springSoft } from "@/lib/motion";

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
  const [editing, setEditing] = useState(false);
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

  const status = STATUS[site.status];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <AnimatePresence mode="wait" initial={false}>
          {editing ? (
            <motion.div
              key="edit"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto", transition: springSoft }}
              exit={{ opacity: 0, height: 0 }}
            >
              <EditSiteForm
                site={site}
                onCancel={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  onChanged();
                }}
                onError={onError}
              />
            </motion.div>
          ) : (
            <motion.div
              key="view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
                <Button variant="outline" size="icon" disabled={busy} onClick={() => setEditing(true)}>
                  <Pencil className="size-4" />
                </Button>
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
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function EditSiteForm({ site, onCancel, onSaved, onError }) {
  const isHours = site.unblockDurationMinutes % 60 === 0;
  const [domain, setDomain] = useState(site.domain);
  const [limit, setLimit] = useState(site.dailyUnblockLimit);
  const [durationValue, setDurationValue] = useState(
    isHours ? site.unblockDurationMinutes / 60 : site.unblockDurationMinutes
  );
  const [durationUnit, setDurationUnit] = useState(isHours ? "hours" : "minutes");
  const [saving, setSaving] = useState(false);

  // Once today's unblocks are all used up, the daily limit is locked until the
  // counter resets tomorrow (no editing your way around being out of unblocks).
  const unblocksDepleted = site.unblocksRemaining === 0;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const minutes =
        durationUnit === "hours" ? Number(durationValue) * 60 : Number(durationValue);
      await api.updateSite(site.id, {
        domain,
        dailyUnblockLimit: Number(limit),
        unblockDurationMinutes: minutes,
      });
      onSaved();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="flex flex-wrap items-end gap-3.5" onSubmit={save}>
      <div className="flex flex-1 basis-52 flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Domain</Label>
        <Input value={domain} onChange={(e) => setDomain(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Unblocks / day</Label>
        <Input
          type="number"
          min="0"
          max="100"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          disabled={unblocksDepleted}
          title={unblocksDepleted ? "No unblocks left today — locked until tomorrow" : ""}
          className="w-28"
        />
        {unblocksDepleted && (
          <span className="text-xs text-muted-foreground">Locked until tomorrow</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Each unblock lasts</Label>
        <div className="flex gap-1.5">
          <Input
            type="number"
            min="1"
            value={durationValue}
            onChange={(e) => setDurationValue(e.target.value)}
            className="w-20"
          />
          <Select value={durationUnit} onValueChange={setDurationUnit}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">minutes</SelectItem>
              <SelectItem value="hours">hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
