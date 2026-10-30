import type { GraphDefinition, LinearJourneyDefinition } from "@rxova/journey-core";

export type PluginDemoKind =
  "analytics" | "diagnostics" | "execution-paths" | "persistence" | "replay";

export type PluginStepId = "profile" | "review" | "done";

export type PluginContext = {
  name: string;
  email: string;
  notes: string;
};

export type StructureStepId = "start" | "address" | "review" | "blocked" | "done" | "orphan";

export type StructureEvent = { type: "next" } | { type: "reject" };

export const pluginStorageKey = (runtime: "core" | "react", kind: PluginDemoKind) =>
  `journey.example.${runtime}.${kind}`;

export const pluginDefinition = {
  context: {
    name: "",
    email: "",
    notes: "",
  },
  steps: [
    { id: "profile", nodeMeta: { label: "Profile" } },
    { id: "review", nodeMeta: { label: "Review" } },
    { id: "done", nodeMeta: { label: "Done" } },
  ],
} satisfies LinearJourneyDefinition<PluginStepId, PluginContext>;

type StructureBag = {
  context: Record<string, never>;
  stepId: StructureStepId;
  events: StructureEvent;
  meta: { label: string };
};

// The structure is intentionally imperfect so the diagnostics plugin has
// something to report: the second "next" candidates are shadowed by earlier
// unconditional ones, "orphan" is unreachable, and review ⇄ address cycles.
export const structureDefinition = {
  initial: "start",
  context: {},
  steps: {
    start: {
      nodeMeta: { label: "Start" },
      on: { next: [{ to: "address" }, { to: "review" }] },
    },
    address: {
      nodeMeta: { label: "Address" },
      on: { next: [{ to: "review" }, { to: "done" }], reject: "blocked" },
    },
    review: {
      nodeMeta: { label: "Review" },
      on: { next: "done", reject: "address" },
    },
    blocked: { nodeMeta: { label: "Blocked" } },
    done: { nodeMeta: { label: "Done" } },
    orphan: { nodeMeta: { label: "Orphan" } },
  },
} satisfies GraphDefinition<StructureBag>;

export const pluginTitles: Record<PluginDemoKind, string> = {
  analytics: "Analytics Plugin",
  diagnostics: "Structure Analysis",
  "execution-paths": "Execution Paths Plugin",
  persistence: "Persistence Plugin",
  replay: "Replay Plugin",
};
