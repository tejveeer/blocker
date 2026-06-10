import { useEffect, useState } from "react";
import { api } from "../api.js";

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

  if (editing) {
    return (
      <EditSiteForm
        site={site}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
        onError={onError}
      />
    );
  }

  const statusLabel = {
    blocked: "Blocked",
    unblocked: "Unblocked",
    locked: "Locked until tomorrow",
  }[site.status];

  return (
    <article className={`card site status-${site.status}`}>
      <div className="site-main">
        <div className="site-head">
          <span className={`dot ${site.status}`} />
          <h3>{site.domain}</h3>
          <span className={`pill ${site.status}`}>{statusLabel}</span>
        </div>

        <div className="site-meta muted">
          <span>{site.unblocksRemaining} of {site.dailyUnblockLimit} unblocks left today</span>
          <span>·</span>
          <span>{formatDuration(site.unblockDurationMinutes)} each</span>
          {site.status === "unblocked" && (
            <>
              <span>·</span>
              <span className="countdown">re-blocks in {formatMs(remaining)}</span>
            </>
          )}
        </div>
      </div>

      <div className="site-actions">
        {site.status === "unblocked" ? (
          <button
            className="btn warn"
            disabled={busy}
            onClick={() => run(() => api.reblock(site.id))}
          >
            Block now
          </button>
        ) : (
          <button
            className="btn primary"
            disabled={busy || site.status === "locked"}
            onClick={() => run(() => api.unblock(site.id))}
            title={site.status === "locked" ? "No unblocks left today" : ""}
          >
            Unblock
          </button>
        )}
        <button className="btn ghost" disabled={busy} onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          className="btn danger ghost"
          disabled={busy}
          onClick={() => {
            if (confirm(`Remove ${site.domain} from the blocker?`)) {
              run(() => api.removeSite(site.id));
            }
          }}
        >
          Delete
        </button>
      </div>
    </article>
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
    <article className="card site editing">
      <form className="add-form" onSubmit={save}>
        <label className="field grow">
          <span>Domain</span>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} required />
        </label>
        <label className="field">
          <span>Unblocks / day</span>
          <input
            type="number"
            min="0"
            max="100"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Each unblock lasts</span>
          <div className="duration">
            <input
              type="number"
              min="1"
              value={durationValue}
              onChange={(e) => setDurationValue(e.target.value)}
            />
            <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value)}>
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
            </select>
          </div>
        </label>
        <div className="edit-actions">
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </article>
  );
}
