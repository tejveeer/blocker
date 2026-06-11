import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, Scale, XCircle } from "lucide-react";

import { api } from "../api.js";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fadeInUp, springSoft } from "@/lib/motion";

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="inline-flex w-fit gap-1 self-start rounded-lg border bg-muted/40 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function UnblockRequest({ sites, onChanged, onError }) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [mode, setMode] = useState("temporary");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Verdicts are keyed by site id so the result card is tied to its site:
  // switching sites shows that site's last verdict (or nothing).
  const [verdicts, setVerdicts] = useState({});
  const verdict = verdicts[siteId] ?? null;

  const selected = useMemo(() => sites.find((s) => s.id === siteId) ?? null, [sites, siteId]);

  const isPermanent = mode === "permanent";
  const currentLimit = selected?.dailyUnblockLimit ?? 0;
  const hasAmount = amount !== "" && !Number.isNaN(Number(amount));

  // Temporary mode asks for "how many more"; permanent mode asks for the new
  // total daily limit, from which we derive the increment (negative = decrease).
  const increment = isPermanent
    ? (hasAmount ? Number(amount) : currentLimit) - currentLimit
    : Math.abs(Number(amount) || 0);
  const isDecrease = isPermanent && hasAmount && increment < 0;
  const reasonRequired = !isDecrease;

  const amountLabel = isPermanent
    ? "New daily limit"
    : "How many more unblocks do you want today?";

  const submit = async (e) => {
    e.preventDefault();
    const requestSiteId = siteId;
    setSubmitting(true);
    setVerdicts((prev) => ({ ...prev, [requestSiteId]: null }));
    try {
      const result = await api.requestUnblocks(requestSiteId, {
        mode,
        increment,
        reason: reasonRequired ? reason : "",
      });
      setVerdicts((prev) => ({ ...prev, [requestSiteId]: result }));
      onChanged();
    } catch (err) {
      onError(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (sites.length === 0) {
    return (
      <p className="mt-7 text-center text-muted-foreground">
        No sites to request unblocks for yet. Add one on the Sites page first.
      </p>
    );
  }

  return (
    <div className="mt-5 flex flex-col gap-5">
      <motion.div {...fadeInUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scale className="size-5 text-primary" />
              Request a change
            </CardTitle>
            <CardDescription>
              The teacher grants access only for genuine necessity — never for desire. Reducing
              your own limits is always permitted instantly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Site</Label>
                <Select value={siteId} onValueChange={setSiteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Mode</Label>
                <SegmentedControl
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "temporary", label: "Temporary (today)" },
                    { value: "permanent", label: "Permanent (daily limit)" },
                  ]}
                />
              </div>

              <div className="flex flex-wrap items-end gap-4">
                {selected && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {isPermanent ? "Current daily limit" : "Available today"}
                    </Label>
                    <div className="flex h-9 w-40 items-center rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground">
                      {isPermanent
                        ? `${selected.dailyUnblockLimit} / day`
                        : `${selected.unblocksRemaining} of ${selected.dailyUnblockLimit} left`}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">{amountLabel}</Label>
                  <Input
                    type="number"
                    min={isPermanent ? "0" : "1"}
                    max="100"
                    placeholder={isPermanent ? String(currentLimit) : "0"}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-40"
                    required
                  />
                </div>
              </div>

              {reasonRequired ? (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Reason</Label>
                  <Textarea
                    placeholder="What concrete, external obligation requires this? Desire, convenience, and entertainment will be refused."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Reducing your daily limit needs no justification and is applied immediately.
                </p>
              )}

              <div>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {isDecrease ? "Applying…" : "Asking the teacher…"}
                    </>
                  ) : isDecrease ? (
                    "Reduce limit"
                  ) : (
                    "Submit request"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <AnimatePresence mode="wait">
        {verdict && (
          <motion.div
            key={`${siteId}-${verdict.validated ? "granted" : "denied"}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: springSoft }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card
              className={
                verdict.validated
                  ? "border-success/40 bg-success/5"
                  : "border-destructive/40 bg-destructive/5"
              }
            >
              <CardContent className="flex gap-3 p-5">
                {verdict.validated ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                )}
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">{verdictTitle(verdict)}</p>
                  <p className="text-sm text-muted-foreground">{verdict.reason}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function verdictTitle(verdict) {
  if (!verdict.validated) return "Request denied";
  const n = Math.abs(verdict.increment);
  const unit = `unblock${n === 1 ? "" : "s"}`;
  if (verdict.increment < 0) return `Daily limit reduced by ${n} ${unit}`;
  if (verdict.mode === "permanent") return `Granted — daily limit raised by ${n} ${unit}`;
  return `Granted — ${n} extra ${unit} added for today`;
}
