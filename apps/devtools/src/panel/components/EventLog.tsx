import React from "react";

import type { JourneyPanelLogEntry } from "../store";

type EventLogProps = {
  logs: readonly JourneyPanelLogEntry[];
  totalCount: number;
  retentionCap?: number;
  displayLimit: number | null;
  onDisplayLimitChange: (value: number | null) => void;
  onPrune: () => void;
};

export const EventLog = ({
  logs,
  totalCount,
  retentionCap,
  displayLimit,
  onDisplayLimitChange,
  onPrune
}: EventLogProps) => {
  return (
    <section className="panel-card">
      <div className="log-header">
        <h2>Event Log</h2>
        <span className="muted">
          Showing {logs.length} / {totalCount}
          {retentionCap ? ` (retaining latest ${retentionCap})` : ""}
        </span>
      </div>

      <div className="log-controls">
        <label>
          Display limit
          <input
            type="number"
            min={1}
            value={displayLimit ?? ""}
            placeholder="unbounded"
            onChange={(event) => {
              const value = event.target.value.trim();
              if (value.length === 0) {
                onDisplayLimitChange(null);
                return;
              }
              const parsed = Number(value);
              if (!Number.isFinite(parsed)) {
                return;
              }
              onDisplayLimitChange(Math.max(1, Math.trunc(parsed)));
            }}
          />
        </label>
        <button type="button" onClick={onPrune}>
          Prune to limit
        </button>
      </div>

      <ul className="log-list">
        {logs.map((entry) => (
          <li key={entry.id} className="log-item">
            <time>{new Date(entry.timestamp).toLocaleTimeString()}</time>
            <span className="log-kind">{entry.kind}</span>
            <span>{entry.summary}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
