import React from "react";

import type { JourneyDevtoolsSerializableSnapshot } from "@rxova/journey-devtools-bridge";
import type { JourneyPanelStructuredDiff } from "../diff";
import type { JourneyPanelTimelineEntry } from "../store";
import { selectVisibleTimelineEntries } from "../store";

const LazyJsonBlock = React.lazy(() => import("./JsonBlock"));

type TimelineTabId = "action" | "state" | "diff";

const tabList: readonly { id: TimelineTabId; label: string }[] = [
  { id: "action", label: "Action" },
  { id: "state", label: "State" },
  { id: "diff", label: "Diff" }
];

const formatTime = (timestamp: number): string => new Date(timestamp).toLocaleTimeString();

const badgeLabelByKind: Record<JourneyPanelTimelineEntry["kind"], string> = {
  init: "INIT",
  snapshot: "SNAP",
  command: "CMD",
  error: "ERR"
};

type TimelineInspectorProps = {
  entries: readonly JourneyPanelTimelineEntry[];
  selectedIndex: number;
  selectedEntry: JourneyPanelTimelineEntry | null;
  displayedSnapshot: JourneyDevtoolsSerializableSnapshot | null;
  selectedDiff: JourneyPanelStructuredDiff;
  followLatest: boolean;
  displayLimit: number | null;
  retentionCap?: number;
  onSelectEntry: (index: number) => void;
  onFollowLatestChange: (value: boolean) => void;
  onDisplayLimitChange: (value: number | null) => void;
  onPrune: () => void;
};

export const TimelineInspector = ({
  entries,
  selectedIndex,
  selectedEntry,
  displayedSnapshot,
  selectedDiff,
  followLatest,
  displayLimit,
  retentionCap,
  onSelectEntry,
  onFollowLatestChange,
  onDisplayLimitChange,
  onPrune
}: TimelineInspectorProps) => {
  const [activeTab, setActiveTab] = React.useState<TimelineTabId>("action");
  const timelineListRef = React.useRef<HTMLOListElement | null>(null);

  const visibleEntries = React.useMemo(
    () => selectVisibleTimelineEntries(entries, displayLimit),
    [entries, displayLimit]
  );
  const visibleStartIndex = Math.max(0, entries.length - visibleEntries.length);

  const detailsPayload = React.useMemo(() => {
    if (activeTab === "action") {
      return selectedEntry?.actionPayload ?? { message: "No action selected." };
    }
    if (activeTab === "state") {
      return displayedSnapshot ?? { message: "No state available for this timeline entry." };
    }
    return selectedDiff;
  }, [activeTab, displayedSnapshot, selectedDiff, selectedEntry]);

  React.useEffect(() => {
    if (!followLatest || !timelineListRef.current) {
      return;
    }

    timelineListRef.current.scrollTop = timelineListRef.current.scrollHeight;
  }, [followLatest, visibleEntries.length]);

  return (
    <section className="panel-card timeline-card">
      <div className="timeline-header">
        <h2>Timeline</h2>
        <span className="muted">
          Showing {visibleEntries.length} / {entries.length}
          {retentionCap ? ` (retaining latest ${retentionCap})` : ""}
        </span>
      </div>

      <div className="timeline-toolbar">
        <button
          type="button"
          className={followLatest ? "follow-button active" : "follow-button"}
          onClick={() => onFollowLatestChange(!followLatest)}
        >
          {followLatest ? "Following latest" : "Follow latest"}
        </button>

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

      <div className="timeline-layout">
        <ol className="timeline-list" ref={timelineListRef}>
          {visibleEntries.map((entry, visibleIndex) => {
            const absoluteIndex = visibleStartIndex + visibleIndex;
            const isSelected = absoluteIndex === selectedIndex;

            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className={isSelected ? "timeline-row selected" : "timeline-row"}
                  onClick={() => onSelectEntry(absoluteIndex)}
                >
                  <span className="timeline-index">{absoluteIndex + 1}</span>
                  <span className={`timeline-kind kind-${entry.kind}`}>
                    {badgeLabelByKind[entry.kind]}
                  </span>
                  <span className="timeline-label">{entry.label}</span>
                  <time className="timeline-time">{formatTime(entry.timestamp)}</time>
                </button>
              </li>
            );
          })}
        </ol>

        <section className="timeline-details">
          <div className="tab-row">
            {tabList.map((tab) => (
              <button
                key={tab.id}
                className={tab.id === activeTab ? "tab-button active" : "tab-button"}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <React.Suspense fallback={<p className="muted">Loading inspector…</p>}>
            <LazyJsonBlock value={detailsPayload} />
          </React.Suspense>
        </section>
      </div>
    </section>
  );
};
