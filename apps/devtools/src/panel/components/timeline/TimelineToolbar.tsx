import { classNames } from "../../utils/classNames";
import styles from "./timeline.module.css";

type TimelineToolbarProps = {
  followLatest: boolean;
  displayLimit: number | null;
  onFollowLatestChange: (value: boolean) => void;
  onDisplayLimitChange: (value: number | null) => void;
  onPrune: () => void;
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
);
