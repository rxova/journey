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

const TIMELINE_FALLBACK_ROW_HEIGHT_PX = 48;
const TIMELINE_ROW_GAP_PX = 6;
const TIMELINE_OVERSCAN_ROWS = 6;
const TIMELINE_FALLBACK_VIEWPORT_HEIGHT_PX = 320;

const formatTime = (timestamp: number): string => new Date(timestamp).toLocaleTimeString();

const badgeLabelByKind: Record<JourneyPanelTimelineEntry["kind"], string> = {
  init: "INIT",
  snapshot: "SNAP",
  command: "CMD",
  query: "QRY",
  event: "EVT",
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
  const firstVirtualRowRef = React.useRef<HTMLLIElement | null>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [rowHeight, setRowHeight] = React.useState(TIMELINE_FALLBACK_ROW_HEIGHT_PX);
  const [viewportHeight, setViewportHeight] = React.useState(TIMELINE_FALLBACK_VIEWPORT_HEIGHT_PX);

  const visibleEntries = React.useMemo(
    () => selectVisibleTimelineEntries(entries, displayLimit),
    [entries, displayLimit]
  );
  const visibleStartIndex = Math.max(0, entries.length - visibleEntries.length);
  const visibleRowCount = Math.max(
    1,
    Math.ceil(viewportHeight / rowHeight) + TIMELINE_OVERSCAN_ROWS * 2
  );
  const virtualStartIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - TIMELINE_OVERSCAN_ROWS);
  const virtualEndIndex = Math.min(visibleEntries.length, virtualStartIndex + visibleRowCount);
  const virtualEntries = visibleEntries.slice(virtualStartIndex, virtualEndIndex);
  const virtualPaddingTop = virtualStartIndex * rowHeight;
  const virtualPaddingBottom = Math.max(0, visibleEntries.length - virtualEndIndex) * rowHeight;

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
    const timelineList = timelineListRef.current!;

    const measureViewport = () => {
      const nextHeight = timelineList.clientHeight;
      if (nextHeight > 0) {
        setViewportHeight(nextHeight);
      }
    };

    measureViewport();

    if (typeof ResizeObserver !== "function") {
      window.addEventListener("resize", measureViewport);
      return () => {
        window.removeEventListener("resize", measureViewport);
      };
    }

    const observer = new ResizeObserver(measureViewport);
    observer.observe(timelineList);
    return () => {
      observer.disconnect();
    };
  }, []);

  React.useEffect(() => {
    const firstVirtualRow = firstVirtualRowRef.current;
    if (!firstVirtualRow) {
      return;
    }

    const measureRowHeight = () => {
      const nextHeight = firstVirtualRow.getBoundingClientRect().height + TIMELINE_ROW_GAP_PX;
      if (nextHeight > TIMELINE_ROW_GAP_PX) {
        setRowHeight(nextHeight);
      }
    };

    measureRowHeight();

    if (typeof ResizeObserver !== "function") {
      window.addEventListener("resize", measureRowHeight);
      return () => {
        window.removeEventListener("resize", measureRowHeight);
      };
    }

    const observer = new ResizeObserver(measureRowHeight);
    observer.observe(firstVirtualRow);
    return () => {
      observer.disconnect();
    };
  }, [virtualEntries]);

  React.useEffect(() => {
    if (!followLatest || !timelineListRef.current) {
      return;
    }

    const nextScrollTop = Math.max(
      0,
      timelineListRef.current.scrollHeight - timelineListRef.current.clientHeight
    );
    timelineListRef.current.scrollTop = timelineListRef.current.scrollHeight;
    setScrollTop(nextScrollTop);
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
        <ol
          className="timeline-list"
          ref={timelineListRef}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          style={{
            paddingTop: virtualPaddingTop,
            paddingBottom: virtualPaddingBottom + 8
          }}
        >
          {virtualEntries.map((entry, visibleIndex) => {
            const absoluteIndex = visibleStartIndex + virtualStartIndex + visibleIndex;
            const isSelected = absoluteIndex === selectedIndex;

            return (
              <li key={entry.id} ref={visibleIndex === 0 ? firstVirtualRowRef : null}>
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
