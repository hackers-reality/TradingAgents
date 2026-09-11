export function apiBase(): string {
  if (typeof window !== "undefined") {
    // ?api= (printed by the CLI launcher) pins this session's API port.
    const q = new URLSearchParams(window.location.search).get("api");
    if (q) {
      window.localStorage.setItem("ta_api_base", q.replace(/\/$/, ""));
      window.history.replaceState(null, "", window.location.pathname);
      return q.replace(/\/$/, "");
    }
    const saved = window.localStorage.getItem("ta_api_base");
    if (saved) return saved.replace(/\/$/, "");
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8787";
}

export const API_BASE = apiBase();

async function req(path: string, init?: RequestInit) {
  const r = await fetch(`${apiBase()}${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || `HTTP ${r.status}`), { data, status: r.status });
  return data;
}

export const api = {
  options: () => req("/api/options"),
  models: (provider: string, mode = "quick") =>
    req(`/api/models?provider=${encodeURIComponent(provider)}&mode=${mode}`),
  keys: () => req("/api/settings/keys"),
  saveKey: (env: string, value: string) =>
    req("/api/settings/keys", { method: "POST", body: JSON.stringify({ env, value }) }),
  testKey: (provider: string, key?: string) =>
    req("/api/settings/test", { method: "POST", body: JSON.stringify({ provider, key }) }),
  sessions: () => req("/api/sessions"),
  session: (id: string) => req(`/api/session?id=${encodeURIComponent(id)}`),
  deleteSession: (id: string) => req(`/api/session?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
  openFolder: (id: string) => req("/api/session/open", { method: "POST", body: JSON.stringify({ id }) }),
  runs: () => req("/api/runs"),
  startRun: (selections: Record<string, unknown>) =>
    req("/api/runs", { method: "POST", body: JSON.stringify(selections) }),
  runState: (id: string) => req(`/api/runs/${id}/state`),
  stopRun: (id: string) => req(`/api/runs/${id}`, { method: "DELETE" }),
  answerRun: (id: string, answer: string) =>
    req(`/api/runs/${id}/answer`, { method: "POST", body: JSON.stringify({ answer }) }),
  runReport: (id: string) => req(`/api/runs/${id}/report`),
  liveState: () => req("/api/state"),
  tablesStatus: (session: string) => req(`/api/tables/status?session=${encodeURIComponent(session)}`),
  generateTables: (session_id: string, provider: string, model: string, backend_url?: string) =>
    req("/api/sessions/tables", { method: "POST", body: JSON.stringify({ session_id, provider, model, backend_url }) }),
  quote: (ticker: string) => req(`/api/quote?ticker=${encodeURIComponent(ticker)}`),
};

export type Provider = {
  display: string;
  key: string;
  url: string | null;
  keyEnv: string | null;
  keyOptional: boolean;
  keySet: boolean;
};
