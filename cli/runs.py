"""Parallel run orchestration for web/API-driven analyses.

Each run is a subprocess (``tradingagents analyze --from-json ... --job-dir
...``), so the CLI's module-global ``message_buffer`` is never shared.
All cross-process state is file-backed under
``<results>/_jobs/<run_id>/``:

- ``selections.json`` — validated run input
- ``prompt.json``      — post-run Q&A (API writes ``answer``)
- ``status.json``      — agent statuses, stats, heartbeat (run writes)
- ``run.log``          — subprocess stdout/stderr

Live panels (agent log tail, report sections) are read from the standard
session dirs, so parallel runs on different tickers/dates never collide.
The same ticker+date twice is rejected (409) — they'd share one log.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

MAX_PARALLEL_DEFAULT = 3


def _jobs_root() -> Path:
    from tradingagents.default_config import DEFAULT_CONFIG

    root = Path(DEFAULT_CONFIG["results_dir"]) / "_jobs"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _max_parallel() -> int:
    try:
        return max(1, int(os.environ.get("TRADINGAGENTS_MAX_PARALLEL_RUNS", MAX_PARALLEL_DEFAULT)))
    except ValueError:
        return MAX_PARALLEL_DEFAULT


class RunRecord:
    """Mutable state for one web-driven subprocess run."""

    def __init__(self, selections: dict):
        self.id = uuid.uuid4().hex[:12]
        self.selections = selections
        self.status = "starting"
        self.error = None
        self.created = time.time()
        self.job_dir = _jobs_root() / self.id
        self.proc = None
        # In-process hub (unused by subprocess runs, kept for duck-typing).
        self.pending_prompt = {"question": None, "default": None, "answer": None}
        self.stats_handler = None
        self.start_time = self.created
        self.finished_at = None
        self.final_state = None

    def summary(self):
        sel = self.selections
        return {
            "id": self.id,
            "ticker": sel.get("ticker"),
            "date": sel.get("analysis_date"),
            "provider": sel.get("llm_provider"),
            "status": self.status,
            "awaiting_input": self._awaiting_input(),
            "created": self.created,
            "src": "web",
            "finished_at": self.finished_at,
            "error": self.error,
            "session_id": None,
        }

    def _awaiting_input(self) -> bool:
        if self.status not in ("starting", "running"):
            return False
        try:
            prompt = json.loads((self.job_dir / "prompt.json").read_text(encoding="utf-8"))
            return bool(prompt.get("question")) and prompt.get("answer") is None
        except Exception:
            return False

    def refresh_from_files(self):
        """Sync status/error/finished from status.json (best effort)."""
        try:
            data = json.loads((self.job_dir / "status.json").read_text(encoding="utf-8"))
        except Exception:
            return
        status = data.get("status")
        if status in ("done", "error"):
            self.status = status
            self.error = data.get("error")
            try:
                self.finished_at = float(data.get("updated_at") or self.created)
            except (TypeError, ValueError):
                pass
        elif self.proc is not None and self.proc.poll() is not None:
            # Process exited without writing a terminal status: surface it.
            self.status = "error"
            self.error = f"run process exited (code {self.proc.poll()})"
            self.finished_at = time.time()


class RunManager:
    def __init__(self):
        self._lock = threading.Lock()
        self._runs: dict[str, RunRecord] = {}

    def _live(self):
        return [
            r for r in self._runs.values() if r.status in ("starting", "running")
        ]

    def active(self):
        with self._lock:
            live = self._live()
            return live[0] if live else None

    def start(self, raw_selections: dict) -> RunRecord:
        from cli.main import _normalize_selections
        from cli.utils import _llm_provider_table, provider_default_url

        with self._lock:
            live = self._live()
            if len(live) >= _max_parallel():
                raise BusyError(
                    f"{len(live)} runs already active (max {_max_parallel()}); "
                    "wait or raise TRADINGAGENTS_MAX_PARALLEL_RUNS"
                )
            for r in live:
                if (
                    r.selections.get("ticker") == str(raw_selections.get("ticker", "")).strip().upper()
                    and r.selections.get("analysis_date") == str(raw_selections.get("analysis_date", "")).strip()
                ):
                    raise BusyError(
                        f"same session already running: {r.id} "
                        f"({r.selections.get('ticker')} {r.selections.get('analysis_date')})"
                    )

        selections = _normalize_selections(dict(raw_selections))
        valid_providers = {pk for _, pk, _ in _llm_provider_table()}
        if selections["llm_provider"] not in valid_providers:
            raise ValueError(f"unknown llm_provider: {selections['llm_provider']}")
        selections.setdefault("backend_url", provider_default_url(selections["llm_provider"]))

        record = RunRecord(selections)
        record.job_dir.mkdir(parents=True, exist_ok=True)
        (record.job_dir / "selections.json").write_text(
            json.dumps(selections), encoding="utf-8"
        )
        (record.job_dir / "prompt.json").write_text("{}", encoding="utf-8")
        log_file = open(record.job_dir / "run.log", "a", encoding="utf-8")

        cmd = [
            sys.executable, "-m", "cli.main", "analyze",
            "--from-json", str(record.job_dir / "selections.json"),
            "--job-dir", str(record.job_dir),
        ]
        try:
            record.proc = subprocess.Popen(
                cmd,
                cwd=os.getcwd(),
                stdout=log_file,
                stderr=subprocess.STDOUT,
            )
        except Exception as exc:
            raise ValueError(f"could not launch run process: {exc}")
        record.status = "running"
        with self._lock:
            self._runs[record.id] = record
        return record

    def answer(self, run_id: str, answer: str) -> bool:
        """Deliver an answer to a run's pending prompt. False if none pending."""
        rec = self.get(run_id)
        if rec is None:
            return None
        path = rec.job_dir / "prompt.json"
        try:
            state = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        except Exception:
            state = {}
        if not state.get("question") or state.get("answer") is not None:
            return False
        state["answer"] = answer
        import tempfile

        try:
            with tempfile.NamedTemporaryFile(
                "w", encoding="utf-8", delete=False, dir=str(path.parent)
            ) as tmp:
                json.dump(state, tmp)
            os.replace(tmp.name, path)
        except OSError:
            return False
        return True

    def terminate(self, run_id: str) -> bool:
        """Kill a live run's process. Returns False when unknown/already done."""
        rec = self.get(run_id)
        if rec is None or rec.status not in ("starting", "running"):
            return False
        try:
            if rec.proc is not None and rec.proc.poll() is None:
                rec.proc.terminate()
        except Exception:
            pass
        rec.status = "error"
        rec.error = "terminated by user"
        rec.finished_at = time.time()
        return True

    def get(self, run_id: str) -> RunRecord | None:
        with self._lock:
            return self._runs.get(run_id)

    def all(self):
        with self._lock:
            records = sorted(self._runs.values(), key=lambda r: r.created, reverse=True)
        for r in records:
            if r.status in ("starting", "running"):
                r.refresh_from_files()
        return sorted(records, key=lambda r: r.created, reverse=True)


class BusyError(Exception):
    def __init__(self, message: str, run_id: str | None = None):
        super().__init__(message)
        self.run_id = run_id


MANAGER = RunManager()
