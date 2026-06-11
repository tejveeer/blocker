async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  status: () => request("/api/status"),
  setPassword: (password) =>
    request("/api/password", { method: "POST", body: JSON.stringify({ password }) }),
  addSite: (payload) =>
    request("/api/sites", { method: "POST", body: JSON.stringify(payload) }),
  updateSite: (id, payload) =>
    request(`/api/sites/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  removeSite: (id) => request(`/api/sites/${id}`, { method: "DELETE" }),
  unblock: (id) => request(`/api/sites/${id}/unblock`, { method: "POST" }),
  reblock: (id) => request(`/api/sites/${id}/reblock`, { method: "POST" }),
  requestUnblocks: (id, payload) =>
    request(`/api/sites/${id}/unblock-request`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
