import { useState } from "react";
import { api } from "../api.js";
import { btn, card, input } from "../ui.js";

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
      <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-muted">
        <span>Sudo password is stored. Blocking is active.</span>
        <button
          onClick={() => setOpen(true)}
          className="cursor-pointer text-sm text-primary hover:underline"
        >
          Update password
        </button>
      </div>
    );
  }

  return (
    <section className={`mt-5 ${card}`}>
      <h2 className="mb-3 text-lg font-semibold">
        {hasPassword ? "Update sudo password" : "Set up sudo password"}
      </h2>
      <p className="mb-3 text-muted">
        Editing <code className="rounded bg-surface2 px-1.5 py-0.5 text-[0.85em]">/etc/hosts</code>{" "}
        requires sudo. The password is stored locally on this machine and used to apply blocking
        rules.
      </p>
      <form className="flex flex-wrap items-center gap-2.5" onSubmit={save}>
        <input
          type="password"
          placeholder="sudo password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className={`${input} flex-1`}
        />
        <button className={btn.primary} type="submit" disabled={saving || !password}>
          {saving ? "Verifying…" : "Save"}
        </button>
        {hasPassword && (
          <button type="button" className={btn.ghost} onClick={() => setOpen(false)}>
            Cancel
          </button>
        )}
      </form>
    </section>
  );
}
