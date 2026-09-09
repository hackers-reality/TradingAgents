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

/** Edge tabs, middle-right: half-hidden flashing pill per live run.
 *  Hover slides out the ticker peek; click expands that run's feed. */
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
  const liveIds = new Set(live.map((r) => r.id));
  const openIds = Object.keys(open).filter((id) => open[id] && liveIds.has(id));
  const minimized = live.filter((r) => !open[r.id]);
  if (!live.length) return null;

  return (
    <>
      {minimized.length > 0 && (
        <div className="edgetabs" title="Live runs — hover to peek, click to expand">
          {minimized.map((r) => (
            <button key={r.id} className="edgetab" onClick={() => setOpen((o) => ({ ...o, [r.id]: true }))}>
              <span className="dot" />
              <span className="tick">{r.ticker}</span>
              <span>{r.date}</span>
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
