/**
 * Type-level assertions for the React tiers. Never executed — verified by
 * `pnpm typecheck` (matches no vitest include pattern).
 * Unused aliases are the assertion mechanism here.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type React from "react";
import {
  createLinearJourney,
  createGraphJourney as coreCreateGraphJourney
} from "@rxova/journey-core";
import { createSubscriptionEnhancerPlugin } from "@rxova/journey-core/subscription-enhancer";
import { createLinearJourney as createLinearJourneyBundle } from "@rxova/journey-react";
import { createGraphJourney } from "@rxova/journey-react/graph";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

const Component = (): null => null;

// ── createLinearJourney infers TContext and the step-id union from the definition ──

export function linearJourneyTypes() {
  const initialContext: { email: string } = { email: "" };
  const bundle = createLinearJourneyBundle({
    context: initialContext,
    steps: ["intro", { id: "details" }, "done"]
  });

  type Snapshot = ReturnType<typeof bundle.useSnapshot>;
  type _ids = Expect<
    Equal<NonNullable<Snapshot["currentStep"]>["id"], "intro" | "details" | "done">
  >;
  type _context = Expect<Equal<ReturnType<typeof bundle.useContext>, { email: string }>>;
  type _machine = Expect<Equal<typeof bundle.machine, ReturnType<typeof bundle.useMachine>>>;
  type _gate = Expect<
    Equal<Parameters<typeof bundle.useStepHandler>[0], "intro" | "details" | "done">
  >;

  // The hooks' snapshot IS the machine's snapshot — no reshaped/widened copy.
  type _verbatimSnapshot = Expect<Equal<Snapshot, ReturnType<typeof bundle.machine.getSnapshot>>>;

  // Step handlers see the narrow id union, not string.
  type Handler = Parameters<typeof bundle.useStepHandler<void>>[1];
  type _handlerIds = Expect<
    Equal<Parameters<Handler["run"]>[0]["to"], "intro" | "details" | "done">
  >;

  type Views = Parameters<typeof bundle.Provider>[0]["views"];
  type _views = Expect<Equal<keyof Views, "intro" | "details" | "done">>;

  // @ts-expect-error views must cover the declared step ids
  const incomplete: Views = { intro: null, details: null };
  void incomplete;

  const withTypo: Views = {
    intro: null,
    details: null,
    done: null,
    // @ts-expect-error undeclared view keys are rejected
    typo: null
  };
  void withTypo;

  return bundle;
}

// ── graph bundles carry the definition's ids into views and hooks ───────────

export function graphBundleTypes() {
  const bundle = createGraphJourney({
    steps: { form: {}, review: {} },
    transitions: { SUBMIT: { from: "form", to: "review" } },
    initial: "form",
    context: { attempts: 0 }
  });

  type Views = React.ComponentProps<typeof bundle.Provider>["views"];
  type _views = Expect<Equal<keyof Views, "form" | "review">>;

  type Snapshot = ReturnType<typeof bundle.useSnapshot>;
  type _kind = Expect<Equal<Snapshot["type"], "graph">>;
  type _context = Expect<Equal<Snapshot["context"], { attempts: number }>>;
  type _machine = Expect<Equal<typeof bundle.machine, ReturnType<typeof bundle.useMachine>>>;

  // @ts-expect-error views must cover the declared step ids
  const incomplete: Views = { form: null };
  void incomplete;

  return bundle;
}

// ── plugin apis flow from the options into machine.plugins ──────────────────

export function pluginThreadingTypes() {
  const bundle = createLinearJourneyBundle(
    { context: { n: 0 }, steps: ["a", "b"] },
    { plugins: [createSubscriptionEnhancerPlugin()] }
  );

  type _pluginApis = Expect<
    Equal<keyof ReturnType<typeof bundle.useMachine>["plugins"], "subscription-enhancer">
  >;

  return bundle;
}

// ── caller-owned core machines type through their own snapshots ─────────────

export function ownedMachineTypes() {
  const linear = createLinearJourney({ steps: ["a", "b"], context: { n: 0 } });
  const graph = coreCreateGraphJourney({
    steps: { x: {}, y: {} },
    transitions: { GO: { from: "x", to: "y" } },
    initial: "x",
    context: {}
  });

  type _linearSnapshotKind = Expect<Equal<ReturnType<typeof linear.getSnapshot>["type"], "linear">>;
  type _graphSnapshotKind = Expect<Equal<ReturnType<typeof graph.getSnapshot>["type"], "graph">>;
}
