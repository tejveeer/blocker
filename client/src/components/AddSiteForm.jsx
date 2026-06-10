import { useState } from "react";
import { api } from "../api.js";

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
    <section className="card">
      <h2>Block a website</h2>
      <form className="add-form" onSubmit={submit}>
        <label className="field grow">
          <span>Domain</span>
          <input
            type="text"
            placeholder="e.g. reddit.com"
            value={form.domain}
            onChange={update("domain")}
            required
          />
        </label>

        <label className="field">
          <span>Unblocks / day</span>
          <input
            type="number"
            min="0"
            max="100"
            value={form.dailyUnblockLimit}
            onChange={update("dailyUnblockLimit")}
          />
        </label>

        <label className="field">
          <span>Each unblock lasts</span>
          <div className="duration">
            <input
              type="number"
              min="1"
              value={form.durationValue}
              onChange={update("durationValue")}
            />
            <select value={form.durationUnit} onChange={update("durationUnit")}>
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
            </select>
          </div>
        </label>

        <button className="btn primary" type="submit" disabled={saving}>
          {saving ? "Adding…" : "Add"}
        </button>
      </form>
    </section>
  );
}
