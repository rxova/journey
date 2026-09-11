import { createGraphJourneyBuilder, type LinearJourneyDefinition } from "@rxova/journey-core";

export type PluginDemoKind =
  | "analytics"
  | "autosave"
  | "diagnostics"
  | "execution-paths"
  | "persistence"
  | "replay";

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
    notes: ""
  },
  steps: [
    { id: "profile", metadata: { label: "Profile" } },
    { id: "review", metadata: { label: "Review" } },
    { id: "done", metadata: { label: "Done" } }
  ]
} satisfies LinearJourneyDefinition<PluginStepId, PluginContext>;

const { createStep, to, build } = createGraphJourneyBuilder<{
  context: Record<string, never>;
  stepId: StructureStepId;
  events: StructureEvent;
  meta: { label: string };
}>();

// The structure is intentionally imperfect so the diagnostics plugin has
// something to report: the second "next" candidates are shadowed by earlier
// unconditional ones, "orphan" is unreachable, and review ⇄ address cycles.
const start = createStep("start", {
  metadata: { label: "Start" },
  on: {
    next: [to("address"), to("review")]
  }
});

const address = createStep("address", {
  metadata: { label: "Address" },
  on: {
    next: [to("review"), to("done")],
    reject: [to("blocked")]
  }
});

const review = createStep("review", {
  metadata: { label: "Review" },
  on: {
    next: [to("done")],
    reject: [to("address")]
  }
});

const blocked = createStep("blocked", {
  metadata: { label: "Blocked" }
});

const done = createStep("done", {
  metadata: { label: "Done" }
});

const orphan = createStep("orphan", {
  metadata: { label: "Orphan" }
});

export const structureDefinition = build({
  initial: "start",
  context: {},
  steps: [start, address, review, blocked, done, orphan]
});

export const pluginTitles: Record<PluginDemoKind, string> = {
  analytics: "Analytics Plugin",
  autosave: "Autosave Plugin",
  diagnostics: "Diagnostics Plugin",
  "execution-paths": "Execution Paths Plugin",
  persistence: "Persistence Plugin",
  replay: "Replay Plugin"
};
