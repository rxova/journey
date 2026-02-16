import React from "react";

import type { JourneyDevtoolsSerializableSnapshot } from "@rxova/journey-devtools-bridge";

const LazyJsonBlock = React.lazy(() => import("./JsonBlock"));

type SnapshotTabId = "summary" | "context" | "history" | "visited" | "async";

const tabList: readonly { id: SnapshotTabId; label: string }[] = [
  { id: "summary", label: "Current/Status" },
  { id: "context", label: "Context" },
  { id: "history", label: "History" },
  { id: "visited", label: "Visited" },
  { id: "async", label: "Async" }
];

export const SnapshotTabs = ({ snapshot }: { snapshot: JourneyDevtoolsSerializableSnapshot }) => {
  const [activeTab, setActiveTab] = React.useState<SnapshotTabId>("summary");

  const tabPayload = React.useMemo(() => {
    if (activeTab === "summary") {
      return {
        current: snapshot.current,
        status: snapshot.status,
        isLoading: snapshot.async.isLoading
      };
    }
    if (activeTab === "context") {
      return snapshot.context;
    }
    if (activeTab === "history") {
      return snapshot.history;
    }
    if (activeTab === "visited") {
      return snapshot.visited;
    }
    return snapshot.async;
  }, [activeTab, snapshot]);

  return (
    <section className="panel-card">
      <h2>Snapshot</h2>
      <div className="tab-row">
        {tabList.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={tab.id === activeTab ? "tab-button active" : "tab-button"}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <React.Suspense fallback={<p className="muted">Loading inspector…</p>}>
        <LazyJsonBlock value={tabPayload} />
      </React.Suspense>
    </section>
  );
};
