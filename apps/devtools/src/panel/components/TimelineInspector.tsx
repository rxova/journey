import React from "react";
import type { JourneyDevtoolsSerializableSnapshot } from "@rxova/journey-devtools-bridge";
import type { JourneyPanelStructuredDiff } from "../diff";
import type { JourneyPanelTimelineEntry } from "../store";
import { selectVisibleTimelineEntries } from "../store";
import panelStyles from "./panelPrimitives.module.css";
import styles from "./timeline/timeline.module.css";
import { TimelineHeader } from "./timeline/TimelineHeader";
import { TimelineToolbar } from "./timeline/TimelineToolbar";
import { TimelineList } from "./timeline/TimelineList";
import { TimelineDetails } from "./timeline/TimelineDetails";

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
  const [isTimelineOpen, setIsTimelineOpen] = React.useState(true);

  const visibleEntries = React.useMemo(
    () => selectVisibleTimelineEntries(entries, displayLimit),
    [entries, displayLimit]
  );
  const visibleStartIndex = Math.max(0, entries.length - visibleEntries.length);

  return (
    <section className={`${panelStyles.card} ${styles.card}`}>
      <TimelineHeader
        entriesCount={entries.length}
        visibleEntriesCount={visibleEntries.length}
        retentionCap={retentionCap}
        isOpen={isTimelineOpen}
        onToggle={() => setIsTimelineOpen((open) => !open)}
      />

      {isTimelineOpen ? (
        <>
          <TimelineToolbar
            followLatest={followLatest}
            displayLimit={displayLimit}
            onFollowLatestChange={onFollowLatestChange}
            onDisplayLimitChange={onDisplayLimitChange}
            onPrune={onPrune}
          />

          <div className={styles.layout}>
            <TimelineList
              visibleEntries={visibleEntries}
              visibleStartIndex={visibleStartIndex}
              selectedIndex={selectedIndex}
              followLatest={followLatest}
              onSelectEntry={onSelectEntry}
            />
            <TimelineDetails
              selectedEntry={selectedEntry}
              displayedSnapshot={displayedSnapshot}
              selectedDiff={selectedDiff}
            />
          </div>
        </>
      ) : null}
    </section>
  );
};
