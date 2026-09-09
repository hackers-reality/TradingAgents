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
};

function basename(p: string) {
  const parts = p.split(/[/\\]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : p;
}

function sessionFor(r: Run) {
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
          <table className="grid">
            <thead>
              <tr>
                <th>ticker</th>
                <th>date</th>
                <th>provider</th>
                <th>models</th>
                <th>analysts</th>
                <th>elapsed</th>
                <th>LLM</th>
                <th>tools</th>
                <th>reports</th>
                <th>status</th>
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
                  <td>{r.date}</td>
                  <td>{r.provider}</td>
                  <td className="dim" style={{ fontSize: 12 }}>
                    {[r.shallow_thinker, r.deep_thinker].filter(Boolean).join(" / ") || "–"}
                  </td>
                  <td style={{ fontSize: 12 }}>{(r.analysts || []).join(", ") || "–"}</td>
                  <td>{fmtElapsed(r.elapsed_seconds)}</td>
                  <td>{r.llm_calls ?? "–"}</td>
                  <td>{r.tool_calls ?? "–"}</td>
                  <td>{r.reports_completed ?? 0}/{r.reports_total ?? 0}</td>
                  <td><span className={`pill ${pillClass(r.status)}`}>{r.status}</span></td>
                  <td className="err" style={{ fontSize: 12, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.error || ""}
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
