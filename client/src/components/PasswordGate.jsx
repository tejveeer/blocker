import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Lock, ShieldCheck } from "lucide-react";

import { api } from "../api.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { springSoft } from "@/lib/motion";

export default function PasswordGate({ hasPassword, onSaved, onError }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.setPassword(password);
      setPassword("");
      setOpen(false);
      onSaved();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  if (hasPassword && !open) {
    return (
      <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-muted-foreground">
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-success" />
          Sudo password is stored. Blocking is active.
        </span>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setOpen(true)}>
          Update password
        </Button>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="gate"
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1, transition: springSoft }}
        className="mt-5"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="size-4 text-primary" />
              {hasPassword ? "Update sudo password" : "Set up sudo password"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Updating{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-[0.85em]">dnsmasq</code> requires
              sudo. The password is stored locally on this machine and used to apply blocking rules.
            </p>
            <form className="flex flex-wrap items-center gap-2.5" onSubmit={save}>
              <Input
                type="password"
                placeholder="sudo password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="flex-1"
              />
              <Button type="submit" disabled={saving || !password}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving ? "Verifying…" : "Save"}
              </Button>
              {hasPassword && (
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
