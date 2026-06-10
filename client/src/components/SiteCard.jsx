import { useEffect, useState } from "react";
import { api } from "../api.js";
import { btn, card, fieldLabel, input } from "../ui.js";

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
  blocked: { label: "Blocked", dot: "bg-danger", pill: "bg-danger/15 text-[#ff9b9b]" },
  unblocked: { label: "Unblocked", dot: "bg-green", pill: "bg-green/15 text-green" },
  locked: { label: "Locked until tomorrow", dot: "bg-muted", pill: "bg-muted/15 text-muted" },
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

  const status = STATUS[site.status];

  return (
    <article className={`${card} flex flex-wrap items-center justify-between gap-4`}>
      <div>
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
          <h3 className="text-lg font-semibold">{site.domain}</h3>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide ${status.pill}`}
          >
            {status.label}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
          <span>
            {site.unblocksRemaining} of {site.dailyUnblockLimit} unblocks left today
          </span>
          <span>·</span>
          <span>{formatDuration(site.unblockDurationMinutes)} each</span>
          {site.status === "unblocked" && (
            <>
              <span>·</span>
              <span className="tabular-nums text-warn">re-blocks in {formatMs(remaining)}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {site.status === "unblocked" ? (
          <button className={btn.warn} disabled={busy} onClick={() => run(() => api.reblock(site.id))}>
            Block now
          </button>
        ) : (
          <button
            className={btn.primary}
            disabled={busy || site.status === "locked"}
            onClick={() => run(() => api.unblock(site.id))}
            title={site.status === "locked" ? "No unblocks left today" : ""}
          >
            Unblock
          </button>
        )}
        <button className={btn.ghost} disabled={busy} onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          className={btn.danger}
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
    <article className={card}>
      <form className="flex flex-wrap items-end gap-3.5" onSubmit={save}>
        <label className={`${fieldLabel} flex-1 basis-52`}>
          <span>Domain</span>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} required className={input} />
        </label>
        <label className={fieldLabel}>
          <span>Unblocks / day</span>
          <input
            type="number"
            min="0"
            max="100"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className={`${input} w-28`}
          />
        </label>
        <label className={fieldLabel}>
          <span>Each unblock lasts</span>
          <div className="flex gap-1.5">
            <input
              type="number"
              min="1"
              value={durationValue}
              onChange={(e) => setDurationValue(e.target.value)}
              className={`${input} w-20`}
            />
            <select
              value={durationUnit}
              onChange={(e) => setDurationUnit(e.target.value)}
              className={input}
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
            </select>
          </div>
        </label>
        <div className="flex gap-2">
          <button className={btn.primary} type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className={btn.ghost} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </article>
  );
}
