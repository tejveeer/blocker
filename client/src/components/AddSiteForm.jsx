import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { api } from "../api.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULTS = { domain: "", dailyUnblockLimit: 3, durationValue: 30, durationUnit: "minutes" };

export default function AddSiteForm({ onAdded, onError }) {
  const [form, setForm] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const updateValue = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const minutes =
        form.durationUnit === "hours"
          ? Number(form.durationValue) * 60
          : Number(form.durationValue);
      await api.addSite({
        domain: form.domain,
        dailyUnblockLimit: Number(form.dailyUnblockLimit),
        unblockDurationMinutes: minutes,
      });
      setForm(DEFAULTS);
      onAdded();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle className="text-lg">Block a website</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-wrap items-end gap-3.5" onSubmit={submit}>
          <div className="flex flex-1 basis-52 flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Domain</Label>
            <Input
              type="text"
              placeholder="e.g. reddit.com"
              value={form.domain}
              onChange={update("domain")}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Unblocks / day</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={form.dailyUnblockLimit}
              onChange={update("dailyUnblockLimit")}
              className="w-28"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Each unblock lasts</Label>
            <div className="flex gap-1.5">
              <Input
                type="number"
                min="1"
                value={form.durationValue}
                onChange={update("durationValue")}
                className="w-20"
              />
              <Select value={form.durationUnit} onValueChange={updateValue("durationUnit")}>
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

          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {saving ? "Adding…" : "Add"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
