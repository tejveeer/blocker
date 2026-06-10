import { useState } from "react";
import { api } from "../api.js";
import { btn, card, fieldLabel, input } from "../ui.js";

const DEFAULTS = { domain: "", dailyUnblockLimit: 3, durationValue: 30, durationUnit: "minutes" };

export default function AddSiteForm({ onAdded, onError }) {
  const [form, setForm] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

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
    <section className={`mt-5 ${card}`}>
      <h2 className="mb-3 text-lg font-semibold">Block a website</h2>
      <form className="flex flex-wrap items-end gap-3.5" onSubmit={submit}>
        <label className={`${fieldLabel} flex-1 basis-52`}>
          <span>Domain</span>
          <input
            type="text"
            placeholder="e.g. reddit.com"
            value={form.domain}
            onChange={update("domain")}
            required
            className={input}
          />
        </label>

        <label className={fieldLabel}>
          <span>Unblocks / day</span>
          <input
            type="number"
            min="0"
            max="100"
            value={form.dailyUnblockLimit}
            onChange={update("dailyUnblockLimit")}
            className={`${input} w-28`}
          />
        </label>

        <label className={fieldLabel}>
          <span>Each unblock lasts</span>
          <div className="flex gap-1.5">
            <input
              type="number"
              min="1"
              value={form.durationValue}
              onChange={update("durationValue")}
              className={`${input} w-20`}
            />
            <select value={form.durationUnit} onChange={update("durationUnit")} className={input}>
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
            </select>
          </div>
        </label>

        <button className={btn.primary} type="submit" disabled={saving}>
          {saving ? "Adding…" : "Add"}
        </button>
      </form>
    </section>
  );
}
