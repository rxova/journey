import { classNames } from "../../utils/classNames";
import styles from "./timeline.module.css";

type TimelineToolbarProps = {
  followLatest: boolean;
  displayLimit: number | null;
  onFollowLatestChange: (value: boolean) => void;
  onDisplayLimitChange: (value: number | null) => void;
  onPrune: () => void;
};

export const parseDisplayLimit = (value: string): number | null | undefined => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.max(1, Math.trunc(parsed));
};

export const updateDisplayLimit = (
  value: string,
  onDisplayLimitChange: (value: number | null) => void
): void => {
  const displayLimitValue = parseDisplayLimit(value);
  if (displayLimitValue !== undefined) {
    onDisplayLimitChange(displayLimitValue);
  }
};

export const TimelineToolbar = ({
  followLatest,
  displayLimit,
  onFollowLatestChange,
  onDisplayLimitChange,
  onPrune
}: TimelineToolbarProps) => (
  <div className={styles.toolbar}>
    <button
      type="button"
      className={classNames(followLatest && styles.followButtonActive)}
      onClick={() => onFollowLatestChange(!followLatest)}
    >
      {followLatest ? "Following latest" : "Follow latest"}
    </button>

    <label className={styles.toolbarLabel}>
      <span>Display limit</span>
      <input
        type="number"
        min={1}
        value={displayLimit ?? ""}
        placeholder="unbounded"
        onChange={(event) => updateDisplayLimit(event.target.value, onDisplayLimitChange)}
      />
    </label>

    <button type="button" onClick={onPrune}>
      Prune to limit
    </button>
  </div>
);
