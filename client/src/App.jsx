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
      <div className="app">
        <p className="muted center">Loading…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Website Blocker</h1>
          <p className="muted">Block distractions on Ubuntu via <code>/etc/hosts</code>.</p>
        </div>
      </header>

      {error && (
        <div className="banner error" role="alert">
          <span>{error}</span>
          <button className="icon-btn" onClick={() => setError("")} aria-label="dismiss">
            ×
          </button>
        </div>
      )}

      <PasswordGate
        hasPassword={hasPassword}
        onSaved={refresh}
        onError={handleError}
      />

      {hasPassword && (
        <>
          <AddSiteForm onAdded={refresh} onError={handleError} />

          <section className="sites">
            {sites.length === 0 ? (
              <p className="muted center empty">
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

      <footer className="footer muted">
        <span>{sites.length} site{sites.length === 1 ? "" : "s"} managed</span>
      </footer>
    </div>
  );
}
