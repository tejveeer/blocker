import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import PasswordGate from "./components/PasswordGate.jsx";
import AddSiteForm from "./components/AddSiteForm.jsx";
import SiteCard from "./components/SiteCard.jsx";

export default function App() {
  const [hasPassword, setHasPassword] = useState(true);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const status = await api.status();
      setHasPassword(status.hasPassword);
      setSites(status.sites);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleError = (err) => setError(err.message || String(err));

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-center text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Website Blocker</h1>
        <p className="mt-1 text-muted">
          Block distractions on Ubuntu via <code className="rounded bg-surface2 px-1.5 py-0.5 text-[0.85em]">/etc/hosts</code>.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-[#ffb4b4]"
        >
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            aria-label="dismiss"
            className="cursor-pointer text-xl leading-none"
          >
            ×
          </button>
        </div>
      )}

      <PasswordGate hasPassword={hasPassword} onSaved={refresh} onError={handleError} />

      {hasPassword && (
        <>
          <AddSiteForm onAdded={refresh} onError={handleError} />

          <section className="mt-5 flex flex-col gap-3">
            {sites.length === 0 ? (
              <p className="mt-7 text-center text-muted">
                No sites yet. Add one above to start blocking.
              </p>
            ) : (
              sites.map((site) => (
                <SiteCard
                  key={site.id}
                  site={site}
                  onChanged={refresh}
                  onError={handleError}
                />
              ))
            )}
          </section>
        </>
      )}

      <footer className="mt-7 text-center text-sm text-muted">
        {sites.length} site{sites.length === 1 ? "" : "s"} managed
      </footer>
    </div>
  );
}
