import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, Scale, XCircle } from "lucide-react";

import { api } from "../api.js";
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

export default function UnblockRequest({ sites, onChanged, onError }) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [requestedTotal, setRequestedTotal] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verdict, setVerdict] = useState(null);

  const selected = useMemo(
    () => sites.find((s) => s.id === siteId) ?? null,
    [sites, siteId]
  );
  const current = selected?.unblocksRemaining ?? 0;

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setVerdict(null);
    try {
      const result = await api.requestUnblocks(siteId, {
        requestedTotal: Number(requestedTotal),
        reason,
      });
      setVerdict(result);
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
              Request extra unblocks
            </CardTitle>
            <CardDescription>
              Your request is reviewed by a teacher who weighs it against your practice. Necessity
              may be granted; entertainment will not. Be honest.
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

              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Unblocks you have today</Label>
                  <div className="flex h-9 w-40 items-center rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground">
                    {current} of {selected?.dailyUnblockLimit ?? 0} left
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Total you want today</Label>
                  <Input
                    type="number"
                    min={current + 1}
                    max="100"
                    placeholder={`> ${current}`}
                    value={requestedTotal}
                    onChange={(e) => setRequestedTotal(e.target.value)}
                    className="w-40"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Why do you need them?</Label>
                <Textarea
                  placeholder="Explain the necessity. Vague or entertainment-driven reasons will be denied."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Asking the teacher…
                    </>
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
            key={verdict.validated ? "granted" : "denied"}
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
                  <p className="font-semibold">
                    {verdict.validated
                      ? `Granted — ${verdict.increment} extra unblock${
                          verdict.increment === 1 ? "" : "s"
                        } added for today`
                      : "Request denied"}
                  </p>
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
