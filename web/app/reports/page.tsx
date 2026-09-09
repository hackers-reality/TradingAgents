"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../../lib/api";

type Session = { id: string; kind: string; ticker: string; date: string };
type FileEntry = { path: string; content: string; truncated?: boolean };

export default function Reports() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sel, setSel] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [view, setView] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function reload() {
    try {
      const r = await api.sessions();
      setSessions(r.sessions);
      setChecked(new Set());
      if (!r.sessions.some((s: Session) => s.id === sel)) {
        setSel("");
        setFiles([]);
        setView("");
      }
    } catch (e: any) {
      setError(e.data?.error || String(e.message || e));
    }
  }

  async function open(id: string) {
    setSel(id);
    setError("");
    try {
      const r = await api.session(id);
      setFiles(r.files);
      const complete = r.files.find((f: FileEntry) => f.path.endsWith("complete_report.md"));
      setView(complete ? complete.path : r.files[0]?.path || "");
    } catch (e: any) {
      setError(e.data?.error || String(e.message || e));
    }
  }

  async function bulkDelete() {
    if (!checked.size) return;
    if (!window.confirm(`Delete ${checked.size} session(s)? This removes their folders from disk.`)) return;
    setError("");
    for (const id of checked) {
      try {
        await api.deleteSession(id);
      } catch (e: any) {
        setError(e.data?.error || String(e.message || e));
        break;
      }
    }
    reload();
  }

  async function openFolder(id: string) {
    try {
      await api.openFolder(id);
    } catch (e: any) {
      setError(e.data?.error || String(e.message || e));
    }
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("session");
    // Default reports location is auto-loaded: ?session= wins, else most recent.
    api.sessions()
      .then((r) => {
        setSessions(r.sessions);
        const target = q || r.sessions[0]?.id || "";
        if (target) open(target);
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = files.find((f) => f.path === view);

  return (
    <div>
      <h1>Reports &amp; sessions</h1>
      {error && <p className="err">{error}</p>}
      <div className="row">
        <div className="panel col" style={{ maxWidth: 380 }}>
          <h2>
            Sessions{" "}
            <label className="dim" style={{ fontSize: 11 }}>
              <input
                type="checkbox"
                checked={sessions.length > 0 && checked.size === sessions.length}
                onChange={(e) => setChecked(e.target.checked ? new Set(sessions.map((s) => s.id)) : new Set())}
              />{" "}all
            </label>
          </h2>
          {checked.size > 0 && (
            <button className="ghost" style={{ marginBottom: 8, borderColor: "#dc2626", color: "#dc2626" }} onClick={bulkDelete}>
              Delete selected ({checked.size})
            </button>
          )}
          <div className="scroll" style={{ maxHeight: "70vh" }}>
            {sessions.map((s) => (
              <div key={s.id} style={{ marginBottom: 6, display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={checked.has(s.id)} onChange={() => toggle(s.id)} />
                <button
                  className="ghost"
                  style={{ flex: 1, borderColor: s.id === sel ? "#ea580c" : undefined }}
                  onClick={() => open(s.id)}
                >
                  {s.ticker} · {s.date} <span className="dim">({s.kind})</span>
                </button>
                <button className="ghost" title="Open folder in Explorer" onClick={() => openFolder(s.id)}>
                  📁
                </button>
              </div>
            ))}
            {loading && <div className="shimmer" style={{ height: 120 }} />}
            {!loading && !sessions.length && <span className="dim">No sessions found.</span>}
          </div>
        </div>
        <div className="panel col" style={{ flex: 2 }}>
          <h2>{sel || "Select a session"}</h2>
          {files.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {files.map((f) => (
                <button
                  key={f.path}
                  className="ghost"
                  style={{ marginRight: 6, marginBottom: 6, borderColor: f.path === view ? "#ea580c" : undefined }}
                  onClick={() => setView(f.path)}
                >
                  {f.path}
                </button>
              ))}
            </div>
          )}
          <div className="scroll md" style={{ maxHeight: "65vh" }}>
            {current ? (
              current.path.endsWith(".md")
                ? <ReactMarkdown>{current.content}</ReactMarkdown>
                : <pre style={{ whiteSpace: "pre-wrap" }}>{current.content}</pre>
            ) : (
              <span className="dim">Pick a session, then a file.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
