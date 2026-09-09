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
  const [error, setError] = useState("");
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
      const list = (r.sessions || []) as Session[];
      setSessions(list);
      setChecked(new Set());
      if (!list.some((s) => s.id === sel)) {
        setSel("");
        setFiles([]);
      }
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

  async function open(id: string) {
    setSel(id);
    setError("");
    try {
      const r = await api.session(id);
      setFiles(r.files || []);
    } catch (e: any) {
      setError(e.data?.error || String(e.message || e));
    }
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("session");
    api.sessions()
      .then((r) => {
        const list = (r.sessions || []) as Session[];
        setSessions(list);
        if (q) {
          open(q);
        } else if (list.length) {
          open(list[0].id);
        }
      })
      .catch((e) => setError(String(e.message || e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1>Reports</h1>
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
            {!sessions.length && !error && <div className="shimmer" style={{ height: 120 }} />}
            {!sessions.length && !error ? null : sessions.length ? null : (
              <p className="dim">No sessions yet.</p>
            )}
          </div>
        </div>
        <div className="panel col" style={{ flex: 2 }}>
          <h2>{sel ? `Reports — ${sel}` : "Select a session"}</h2>
          {!sel && <p className="dim">Pick a session to view its reports.</p>}
          <div className="scroll" style={{ maxHeight: "70vh" }}>
            {files.map((f) => (
              <details key={f.path} className="session" open={files.length <= 3}>
                <summary>{f.path}</summary>
                <div className="files">
                  {f.path.endsWith(".md") ? (
                    <div className="md">
                      <ReactMarkdown>{f.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{f.content}</pre>
                  )}
                  {f.truncated && <p className="dim">(truncated tail)</p>}
                </div>
              </details>
            ))}
            {sel && !files.length && !error && <div className="shimmer" style={{ height: 120 }} />}
          </div>
        </div>
      </div>
    </div>
  );
}
