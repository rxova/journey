import React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { classNames } from "../../utils/classNames";
import type { JourneyPanelTimelineEntry } from "../../store";
import styles from "./timeline.module.css";

const TIMELINE_FALLBACK_ROW_HEIGHT_PX = 48;
const TIMELINE_OVERSCAN_ROWS = 6;
const TIMELINE_FALLBACK_VIEWPORT_HEIGHT_PX = 320;

const badgeLabelByKind: Record<JourneyPanelTimelineEntry["kind"], string> = {
  init: "INIT",
  snapshot: "SNAP",
  operation: "OP",
  event: "EVT",
  error: "ERR"
};

const badgeClassByKind: Record<JourneyPanelTimelineEntry["kind"], string | undefined> = {
  init: styles.kindInit,
  snapshot: styles.kindSnapshot,
  operation: styles.kindOperation,
  event: styles.kindEvent,
  error: styles.kindError
};

const formatTime = (timestamp: number): string => new Date(timestamp).toLocaleTimeString();

const getOutcomeLabel = (entry: JourneyPanelTimelineEntry): string | null => {
  if (entry.envelopeKind !== "operationResult" || entry.meta.transitioned === undefined) {
    return null;
  }

  return entry.meta.transitioned ? "OK" : "NOOP";
};

export const observeTimelineElementRect = (
  element: HTMLDivElement | null,
  callback: (rect: { width: number; height: number }) => void
): (() => void) | undefined => {
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
    return () => window.removeEventListener("resize", emit);
  }

  const observer = new ResizeObserver(emit);
  observer.observe(element);

  return () => {
    observer.unobserve(element);
    observer.disconnect();
  };
};

export const observeTimelineElementOffset = (
  element: HTMLDivElement | null,
  callback: (offset: number, isScrolling: boolean) => void
): (() => void) | undefined => {
  if (!element) {
    return undefined;
  }

  let timeoutId: number | null = null;
  const emit = (isScrolling: boolean) => callback(element.scrollTop, isScrolling);

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
};

type TimelineListProps = {
  visibleEntries: readonly JourneyPanelTimelineEntry[];
  visibleStartIndex: number;
  selectedIndex: number;
  followLatest: boolean;
  onSelectEntry: (index: number) => void;
};

export const TimelineList = ({
  visibleEntries,
  visibleStartIndex,
  selectedIndex,
  followLatest,
  onSelectEntry
}: TimelineListProps) => {
  const [timelineListElement, setTimelineListElement] = React.useState<HTMLDivElement | null>(null);

  // TanStack Virtual is intentionally used here for timeline windowing.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: visibleEntries.length,
    getScrollElement: () => timelineListElement,
    estimateSize: () => TIMELINE_FALLBACK_ROW_HEIGHT_PX,
    overscan: TIMELINE_OVERSCAN_ROWS,
    scrollToFn: (offset) => {
      if (timelineListElement) {
        timelineListElement.scrollTop = offset;
      }
    },
    observeElementRect: (_instance, callback) =>
      observeTimelineElementRect(timelineListElement, callback),
    observeElementOffset: (_instance, callback) =>
      observeTimelineElementOffset(timelineListElement, callback),
    initialRect: {
      width: 0,
      height: TIMELINE_FALLBACK_VIEWPORT_HEIGHT_PX
    }
  });

  React.useEffect(() => {
    if (followLatest && visibleEntries.length > 0) {
      rowVirtualizer.scrollToIndex(visibleEntries.length - 1, { align: "end" });
    }
  }, [followLatest, rowVirtualizer, visibleEntries.length]);

  return (
    <div className={styles.list} ref={setTimelineListElement} role="list">
      <div className={styles.virtualSpacer} style={{ height: rowVirtualizer.getTotalSize() }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const entry = visibleEntries[virtualRow.index];
          if (!entry) {
            return null;
          }
          const outcomeLabel = getOutcomeLabel(entry);

          const absoluteIndex = visibleStartIndex + virtualRow.index;
          const isSelected = absoluteIndex === selectedIndex;

          return (
            <div
              key={entry.id}
              className={styles.item}
              role="listitem"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <button
                type="button"
                className={classNames(styles.row, isSelected && styles.rowSelected)}
                onClick={() => onSelectEntry(absoluteIndex)}
              >
                <span className={styles.index}>{absoluteIndex + 1}</span>
                <span className={classNames(styles.kind, badgeClassByKind[entry.kind])}>
                  {badgeLabelByKind[entry.kind]}
                </span>
                <span className={styles.label}>{entry.label}</span>
                {outcomeLabel ? (
                  <span
                    className={classNames(
                      styles.outcome,
                      entry.meta.transitioned ? styles.outcomeSuccess : styles.outcomeNoop
                    )}
                  >
                    {outcomeLabel}
                  </span>
                ) : null}
                <time className={styles.time}>{formatTime(entry.timestamp)}</time>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
