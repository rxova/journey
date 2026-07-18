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
import { createLinearJourney as createLinearJourneyBundle } from "@rxova/journey-react";
import { createGraphJourney } from "@rxova/journey-react/graph";
import type { AnyJourneyMachine, SnapshotOf, StepIdOf } from "@rxova/journey-react/headless";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

const Component = (): null => null;

// ── createLinearJourney curries the context type and the step-id union ──────

export function linearJourneyTypes() {
  const bundle = createLinearJourneyBundle<{ email: string }>()(["intro", "details", "done"]);

  type Hook = ReturnType<typeof bundle.useLinearJourney>;
  type _ids = Expect<
    Equal<NonNullable<Hook["snapshot"]["currentStep"]>["id"], "intro" | "details" | "done">
  >;
  type _context = Expect<Equal<Hook["snapshot"]["context"], { email: string }>>;

  type Props = Parameters<typeof bundle.LinearJourney>[0];
  type _start = Expect<Equal<Props["startAt"], "intro" | "details" | "done" | undefined>>;

  const definition = bundle.toGraphDefinition({ email: "" });
  type _initial = Expect<Equal<typeof definition.initial, "intro" | "details" | "done">>;

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

  // @ts-expect-error views must cover the declared step ids
  const incomplete: Views = { form: Component };
  void incomplete;

  return bundle;
}

// ── every core machine satisfies the headless structural surface ────────────

export function headlessTypes() {
  const linear = createLinearJourney({ steps: ["a", "b"], context: { n: 0 } });
  const graph = coreCreateGraphJourney({
    steps: { x: {}, y: {} },
    transitions: { GO: { from: "x", to: "y" } },
    initial: "x",
    context: {}
  });

  const acceptsAny = (machine: AnyJourneyMachine) => machine;
  acceptsAny(linear);
  acceptsAny(graph);

  type _linearStepIds = Expect<Equal<StepIdOf<typeof linear>, "a" | "b">>;
  type _graphStepIds = Expect<Equal<StepIdOf<typeof graph>, "x" | "y">>;
  type _linearSnapshotKind = Expect<Equal<SnapshotOf<typeof linear>["type"], "linear">>;
}
