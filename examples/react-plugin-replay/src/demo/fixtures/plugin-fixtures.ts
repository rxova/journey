import {
  createGraphJourneyBuilder,
  type JourneyDefinition,
  type JourneyJsonObject
} from "@rxova/journey-core";

export type PluginDemoKind =
  | "analytics"
  | "autosave"
  | "diagnostics"
  | "execution-paths"
  | "persistence"
  | "replay";

export type PluginStepId = "profile" | "review" | "done";

export type PluginContext = JourneyJsonObject & {
  name: string;
  email: string;
  notes: string;
};

export type StructureStepId = "start" | "address" | "review" | "blocked" | "done" | "orphan";

export type StructureEventMap = { type: "next" } | { type: "reject" };

export const pluginStorageKey = (runtime: "core" | "react", kind: PluginDemoKind) =>
  `journey.example.${runtime}.${kind}`;

export const pluginDefinition: JourneyDefinition<PluginContext, PluginStepId> = {
  context: {
    name: "",
    email: "",
    notes: ""
  },
  steps: {
    profile: {
      meta: { label: "Profile" }
    },
    review: {
      meta: { label: "Review" }
    },
    done: {
      meta: { label: "Done" }
    }
  },
  transitions: ["profile", "review", "done"]
};

const { createStep, to, build } = createGraphJourneyBuilder<{
  context: JourneyJsonObject;
  stepId: StructureStepId;
  events: StructureEventMap;
  meta: { label: string };
}>();

const start = createStep("start", {
  meta: { label: "Start" },
  on: {
    next: [to("address").label("to-address"), to("review").label("shadowed-direct-review")]
  }
});

const address = createStep("address", {
  meta: { label: "Address" },
  on: {
    next: [to("review").label("to-review"), to("done").label("shadowed-done")],
    reject: [to("blocked").label("address-reject")]
  }
});

const review = createStep("review", {
  meta: { label: "Review" },
  on: {
    next: [to("done").label("finish")],
    reject: [to("address").label("review-cycle")]
  }
});

const blocked = createStep("blocked", {
  meta: { label: "Blocked" }
});

const done = createStep("done", {
  meta: { label: "Done" }
});

const orphan = createStep("orphan", {
  meta: { label: "Orphan" }
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
