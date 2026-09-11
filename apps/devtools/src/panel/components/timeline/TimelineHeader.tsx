import { ChevronDown, ChevronRight } from "lucide-react";
import { classNames } from "../../utils/classNames";
import panelStyles from "../panelPrimitives.module.css";
import styles from "./timeline.module.css";

type TimelineHeaderProps = {
  entriesCount: number;
  visibleEntriesCount: number;
  retentionCap: number | undefined;
  isOpen: boolean;
  onToggle: () => void;
};

export const TimelineHeader = ({
  entriesCount,
  visibleEntriesCount,
  retentionCap,
  isOpen,
  onToggle
}: TimelineHeaderProps) => (
  <div
    className={classNames(
      panelStyles.sectionHeader,
      isOpen && panelStyles.sectionHeaderWithContent
    )}
  >
    <h2 className={`${panelStyles.title} ${panelStyles.inlineTitle}`}>Timeline</h2>
    <div className={styles.headerActions}>
      <span className={panelStyles.muted}>
        Showing {visibleEntriesCount} / {entriesCount}
        {retentionCap ? ` (retaining latest ${retentionCap})` : ""}
      </span>
      <button
        type="button"
        className={panelStyles.iconButton}
        aria-label={isOpen ? "Collapse Timeline" : "Expand Timeline"}
        title={isOpen ? "Collapse Timeline" : "Expand Timeline"}
        onClick={onToggle}
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
    </div>
  </div>
);
