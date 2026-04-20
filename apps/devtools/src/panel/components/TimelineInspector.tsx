import React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { JourneyDevtoolsSerializableSnapshot } from "@rxova/journey-devtools-bridge";
import type { JourneyPanelStructuredDiff } from "../diff";
import type { JourneyPanelTimelineEntry } from "../store";
import { selectVisibleTimelineEntries } from "../store";

const LazyJsonBlock = React.lazy(() => import("./JsonBlock"));

type TimelineTabId = "action" | "state" | "diff";

const tabList: readonly { id: TimelineTabId; label: string }[] = [
  { id: "action", label: "Action" },
  { id: "state", label: "Snapshot" },
  { id: "diff", label: "Diff" }
];

const TIMELINE_FALLBACK_ROW_HEIGHT_PX = 48;
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
  const [isTimelineOpen, setIsTimelineOpen] = React.useState(true);
  const [timelineListElement, setTimelineListElement] = React.useState<HTMLDivElement | null>(null);

  const visibleEntries = React.useMemo(
    () => selectVisibleTimelineEntries(entries, displayLimit),
    [entries, displayLimit]
  );
  const visibleStartIndex = Math.max(0, entries.length - visibleEntries.length);

  // TanStack Virtual is intentionally used here for timeline windowing.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: visibleEntries.length,
    getScrollElement: () => timelineListElement,
    estimateSize: () => TIMELINE_FALLBACK_ROW_HEIGHT_PX,
    overscan: TIMELINE_OVERSCAN_ROWS,
    scrollToFn: (offset) => {
      if (!timelineListElement) {
        return;
      }

      timelineListElement.scrollTop = offset;
    },
    observeElementRect: (_instance, callback) => {
      const element = timelineListElement;
      if (!element) {
        return undefined;
      }

      const emit = () => {
        callback({
          width: element.clientWidth,
          height: element.clientHeight || TIMELINE_FALLBACK_VIEWPORT_HEIGHT_PX
        });
      };

      emit();

      if (typeof ResizeObserver !== "function") {
        window.addEventListener("resize", emit);
        return () => {
          window.removeEventListener("resize", emit);
        };
      }

      const observer = new ResizeObserver(() => {
        emit();
      });
      observer.observe(element);

      return () => {
        observer.unobserve(element);
        observer.disconnect();
      };
    },
    observeElementOffset: (_instance, callback) => {
      const element = timelineListElement;
      if (!element) {
        return undefined;
      }

      let timeoutId: number | null = null;

      const emit = (isScrolling: boolean) => {
        callback(element.scrollTop, isScrolling);
      };

      const handleScroll = () => {
        emit(true);

        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }

        timeoutId = window.setTimeout(() => {
          emit(false);
          timeoutId = null;
        }, 150);
      };

      emit(false);
      element.addEventListener("scroll", handleScroll, { passive: true });

      return () => {
        element.removeEventListener("scroll", handleScroll);
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      };
    },
    initialRect: {
      width: 0,
      height: TIMELINE_FALLBACK_VIEWPORT_HEIGHT_PX
    }
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

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
    if (!followLatest || visibleEntries.length === 0) {
      return;
    }

    rowVirtualizer.scrollToIndex(visibleEntries.length - 1, { align: "end" });
  }, [followLatest, rowVirtualizer, visibleEntries.length]);

  return (
    <section className="panel-card timeline-card">
      <div className={isTimelineOpen ? "timeline-header with-content" : "timeline-header"}>
        <h2>Timeline</h2>
        <div className="timeline-header-actions">
          <span className="muted">
            Showing {visibleEntries.length} / {entries.length}
            {retentionCap ? ` (retaining latest ${retentionCap})` : ""}
          </span>
          <button
            type="button"
            className="section-toggle"
            aria-label={isTimelineOpen ? "Collapse Timeline" : "Expand Timeline"}
            title={isTimelineOpen ? "Collapse Timeline" : "Expand Timeline"}
            onClick={() => setIsTimelineOpen((open) => !open)}
          >
            {isTimelineOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {isTimelineOpen ? (
        <>
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
            <div className="timeline-list" ref={setTimelineListElement} role="list">
              <div
                className="timeline-virtual-spacer"
                style={{ height: rowVirtualizer.getTotalSize() }}
              >
                {virtualRows.map((virtualRow) => {
                  const entry = visibleEntries[virtualRow.index];
                  if (!entry) {
                    return null;
                  }

                  const absoluteIndex = visibleStartIndex + virtualRow.index;
                  const isSelected = absoluteIndex === selectedIndex;

                  return (
                    <div
                      key={entry.id}
                      className="timeline-item"
                      role="listitem"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
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
                    </div>
                  );
                })}
              </div>
            </div>

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
        </>
      ) : null}
    </section>
  );
};
