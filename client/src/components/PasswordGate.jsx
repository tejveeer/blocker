import { useState } from "react";
import { api } from "../api.js";

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
      <div className="banner subtle">
        <span>Sudo password is stored. Blocking is active.</span>
        <button className="link-btn" onClick={() => setOpen(true)}>
          Update password
        </button>
      </div>
    );
  }

  return (
    <section className="card password-card">
      <h2>{hasPassword ? "Update sudo password" : "Set up sudo password"}</h2>
      <p className="muted">
        Editing <code>/etc/hosts</code> requires sudo. The password is stored locally on
        this machine and used to apply blocking rules.
      </p>
      <form className="row" onSubmit={save}>
        <input
          type="password"
          placeholder="sudo password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <button className="btn primary" type="submit" disabled={saving || !password}>
          {saving ? "Verifying…" : "Save"}
        </button>
        {hasPassword && (
          <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
        )}
      </form>
    </section>
  );
}
