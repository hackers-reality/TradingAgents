"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";

type Run = {
  id: string;
  ticker: string;
  date: string;
  provider: string;
  status: string;
  error?: string | null;
  elapsed_seconds?: number;
  llm_calls?: number;
  tool_calls?: number;
  reports_completed?: number;
  reports_total?: number;
  analysts?: string[];
  shallow_thinker?: string;
  deep_thinker?: string;
  save_path?: string | null;
  session_id?: string | null;
  finished_at?: number | null;
};

function basename(p: string) {
  const parts = p.split(/[/\\]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : p;
}

function sessionFor(r: Run) {
  // Direct session link first (disk sessions), then saved folder, then run dir.
  if (r.session_id) return r.session_id;
  if (r.save_path) return `saved|${basename(r.save_path)}`;
  return `run|${r.ticker}|${r.date}`;
}

function pillClass(status: string) {
  if (status === "done" || status === "completed") return "pill-completed";
  if (status === "error") return "pill-error";
  if (status === "running" || status === "starting") return "pill-in_progress";
  return "pill-pending";
}

function fmtElapsed(s?: number) {
  const v = s || 0;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

export default function History() {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.runs()
      .then((r) => setRuns(r.runs || []))
      .catch((e) => setError(String(e.message || e)));
  }, []);

  return (
    <div>
      <h1>History</h1>
      {error && <p className="err">{error}</p>}
      <div className="panel">
        <div className="scroll" style={{ maxHeight: "75vh" }}>
          <table className="grid" style={{ tableLayout: "fixed", width: "100%" }}>
            <colgroup>
              <col style={{ width: 70 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 60 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 60 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 60 }} />
              <col style={{ width: 120 }} />
            </colgroup>
            <thead>
              <tr>
                <th>ticker</th>
                <th>date</th>
                <th>provider</th>
                <th>models</th>
                <th>analysts</th>
                <th>elapsed</th>
                <th>llm/tools</th>
                <th>reports</th>
                <th>status</th>
                <th>src</th>
                <th>error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/reports?session=${encodeURIComponent(sessionFor(r))}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td><b>{r.ticker}</b></td>
                  <td title={r.date} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.date}</td>
                  <td>{r.provider || "–"}</td>
                  <td className="dim" title={[r.shallow_thinker, r.deep_thinker].filter(Boolean).join(" / ")} style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {[r.shallow_thinker, r.deep_thinker].filter(Boolean).join(" / ") || "–"}
                  </td>
                  <td style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={(r.analysts || []).join(", ")}>{(r.analysts || []).join(", ") || "–"}</td>
                  <td>{fmtElapsed(r.elapsed_seconds)}</td>
                  <td>{r.llm_calls ?? "–"}/{r.tool_calls ?? "–"}</td>
                  <td>{r.reports_completed ?? 0}/{r.reports_total ?? 0}</td>
                  <td><span className={`pill ${pillClass(r.status)}`}>{r.status}</span></td>
                  <td className="dim" style={{ fontSize: 12 }}>{(r as any).src || "–"}</td>
                  <td style={{ fontSize: 12 }}>
                    {r.error ? (
                      <details>
                        <summary className="err" style={{ cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {(r.error || "").split("\n")[0].slice(0, 60)}
                        </summary>
                        <pre className="err" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "4px 0 0", maxHeight: 200, overflowY: "auto" }}>{r.error}</pre>
                      </details>
                    ) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!runs.length && !error && <div className="shimmer" style={{ height: 120, marginTop: 8 }} />}
          {!runs.length && !error ? null : runs.length ? null : <p className="dim">No runs yet.</p>}
        </div>
      </div>
    </div>
  );
}
