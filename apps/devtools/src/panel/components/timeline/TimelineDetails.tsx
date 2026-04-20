import React from "react";
import { Copy } from "lucide-react";
import type { JourneyDevtoolsSerializableSnapshot } from "@rxova/journey-devtools-bridge";
import type { JourneyPanelStructuredDiff } from "../../diff";
import type { JourneyPanelTimelineEntry } from "../../store";
import { classNames } from "../../utils/classNames";
import panelStyles from "../panelPrimitives.module.css";
import styles from "./timeline.module.css";

const LazyJsonBlock = React.lazy(() => import("../JsonBlock"));

type TimelineTabId = "action" | "state" | "diff";

const tabList: readonly { id: TimelineTabId; label: string }[] = [
  { id: "action", label: "Action" },
  { id: "state", label: "Snapshot" },
  { id: "diff", label: "Diff" }
];

const buildActionDetailsPayload = (selectedEntry: JourneyPanelTimelineEntry | null): unknown => {
  if (!selectedEntry) {
    return { message: "No action selected." };
  }

  if (
    selectedEntry.envelopeKind === "operationResult" &&
    selectedEntry.meta.transitioned === false &&
    selectedEntry.invocation
  ) {
    return {
      ...((selectedEntry.actionPayload as Record<string, unknown>) ?? {}),
      summary: {
        status: "no-op",
        message: `${selectedEntry.invocation.operationId} did not produce a transition or state change.`
      }
    };
  }

  return selectedEntry.actionPayload;
};

const serializeCopyPayload = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const copyText = async (text: string): Promise<void> => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is unavailable in this environment.");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

type TimelineDetailsProps = {
  selectedEntry: JourneyPanelTimelineEntry | null;
  displayedSnapshot: JourneyDevtoolsSerializableSnapshot | null;
  selectedDiff: JourneyPanelStructuredDiff;
};

export const TimelineDetails = ({
  selectedEntry,
  displayedSnapshot,
  selectedDiff
}: TimelineDetailsProps) => {
  const [activeTab, setActiveTab] = React.useState<TimelineTabId>("action");
  const [copyState, setCopyState] = React.useState<"idle" | "copied" | "error">("idle");

  const detailsPayload = React.useMemo(() => {
    if (activeTab === "action") {
      return buildActionDetailsPayload(selectedEntry);
    }
    if (activeTab === "state") {
      return displayedSnapshot ?? { message: "No state available for this timeline entry." };
    }
    return selectedDiff;
  }, [activeTab, displayedSnapshot, selectedDiff, selectedEntry]);

  React.useEffect(() => {
    setCopyState("idle");
  }, [activeTab, detailsPayload]);

  const handleCopy = React.useCallback(async () => {
    try {
      await copyText(serializeCopyPayload(detailsPayload));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1600);
    }
  }, [detailsPayload]);

  return (
    <section className={styles.details}>
      <div className={styles.tabRow}>
        {tabList.map((tab) => (
          <button
            key={tab.id}
            className={classNames(styles.tabButton, tab.id === activeTab && styles.tabButtonActive)}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.jsonView}>
        <button
          type="button"
          className={styles.copyButton}
          aria-label="Copy current timeline payload"
          title={
            copyState === "copied"
              ? "Copied"
              : copyState === "error"
                ? "Copy failed"
                : "Copy current payload"
          }
          onClick={() => {
            void handleCopy();
          }}
        >
          <Copy size={14} />
          <span>{copyState === "copied" ? "Copied" : "Copy"}</span>
        </button>
        <React.Suspense fallback={<p className={panelStyles.muted}>Loading inspector...</p>}>
          <LazyJsonBlock value={detailsPayload} />
        </React.Suspense>
      </div>
    </section>
  );
};
