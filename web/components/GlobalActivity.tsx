"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import ActivityCard, { FeedMsg } from "./ActivityCard";

type Run = { id: string; ticker: string; date: string; status: string };

function isLive(status: string) {
  return status === "starting" || status === "running";
}

function RunFeed({
  runId,
  label,
  offset,
  onMinimize,
}: {
  runId: string;
  label: string;
  offset: number;
  onMinimize: () => void;
}) {
  const [messages, setMessages] = useState<FeedMsg[]>([]);
  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const s = await api.runState(runId);
        if (alive) setMessages((s.messages || []) as FeedMsg[]);
      } catch {
        /* run may have finished; keep last messages */
      }
    }
    tick();
    const t = setInterval(tick, 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [runId]);
  return (
    <ActivityCard
      messages={messages}
      title={`Live activity — ${label}`}
      onMinimize={onMinimize}
      style={offset ? { bottom: 16 + offset } : undefined}
    />
  );
}

/** Global live-run tickers: minimized buttons fixed on the right on every page.
 *  Clicking one expands that run's floating ActivityCard feed. */
export default function GlobalActivity() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const r = await api.runs();
        if (alive) setRuns((r.runs || []) as Run[]);
      } catch {
        /* API down: hide */
      }
    }
    poll();
    const t = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const live = runs.filter((r) => isLive(r.status));
  // Drop open flags for runs that are no longer live.
  const liveIds = new Set(live.map((r) => r.id));
  const openIds = Object.keys(open).filter((id) => open[id] && liveIds.has(id));
  const minimized = live.filter((r) => !open[r.id]);
  if (!live.length) return null;

  return (
    <>
      {minimized.length > 0 && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 56,
            display: "flex",
            flexDirection: "column",
            zIndex: 60,
          }}
        >
          {minimized.map((r, i) => (
            <button
              key={r.id}
              className="ghost"
              onClick={() => setOpen((o) => ({ ...o, [r.id]: true }))}
              title={`${r.ticker} ${r.date} — ${r.status} (click to expand activity)`}
              style={{
                marginTop: i === 0 ? 0 : -6,
                borderColor: "#ea580c",
                background: "#fff7ed",
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
            >
              <span className="pill pill-in_progress" style={{ marginRight: 6 }}>
                live
              </span>
              {r.ticker} {r.date}
            </button>
          ))}
        </div>
      )}
      {openIds.map((id, i) => {
        const r = live.find((x) => x.id === id);
        if (!r) return null;
        return (
          <RunFeed
            key={id}
            runId={id}
            label={`${r.ticker} ${r.date}`}
            offset={i * 60}
            onMinimize={() => setOpen((o) => ({ ...o, [id]: false }))}
          />
        );
      })}
    </>
  );
}
