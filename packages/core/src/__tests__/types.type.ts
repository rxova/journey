/**
 * Type-level assertions for the public API. This file is never executed —
 * it is verified by `pnpm typecheck` (it matches no vitest include pattern).
 * Unused aliases and bare expressions are the assertion mechanism here.
 */
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unused-expressions */
import {
  createGraphJourney,
  createGraphJourneyBuilder,
  createLinearJourney
} from "@rxova/journey-core";
import type {
  GraphSnapshot,
  JourneyPlugin,
  LinearSnapshot,
  NavigationResult
} from "@rxova/journey-core";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

// ── linear: literal step ids, order-only snapshot, no send ─────────────────

export function linearTypes() {
  const machine = createLinearJourney({
    steps: ["intro", { id: "details" }, "done"],
    context: { n: 0 }
  });

  type StepId = Parameters<typeof machine.navigate.goToStepById>[0];
  type _stepIds = Expect<Equal<StepId, "intro" | "details" | "done">>;

  const snapshot = machine.getSnapshot();
  type _kind = Expect<Equal<typeof snapshot.type, "linear">>;
  type _order = Expect<
    Equal<typeof snapshot.steps.stepOrder, readonly ("intro" | "details" | "done")[]>
  >;
  type _context = Expect<Equal<typeof snapshot.context, { n: number }>>;

  // linear machines have no events — send's absence is the discriminant
  // @ts-expect-error linear machines expose no send verb
  machine.send;

  // currentStep is null while idle — direct access must not typecheck
  // @ts-expect-error currentStep may be null
  snapshot.currentStep.id;

  return machine;
}

// ── graph: declared events type send exactly; no order fields ──────────────

type LoginEvents = { type: "submit"; payload: { code: string } } | { type: "reset" };

export function graphTypes() {
  const { createStep, to, build } = createGraphJourneyBuilder<{
    context: { attempts: number };
    stepId: "form" | "done";
    events: LoginEvents;
  }>();

  const machine = createGraphJourney(
    build({
      initial: "form",
      context: { attempts: 0 },
      steps: [
        createStep("form", {
          on: {
            submit: ({ to: scoped }) => [
              scoped("done").onTransition(({ event }) => {
                // the callback form narrows the event to the scoped type
                type _payload = Expect<
                  Equal<NonNullable<typeof event>["payload"], { code: string }>
                >;
              })
            ]
          }
        }),
        createStep("done", {})
      ]
    })
  );

  void machine.send("submit", { code: "1234" });
  void machine.send("reset");
  // @ts-expect-error unknown event type
  void machine.send("nope");
  // @ts-expect-error submit requires its payload
  void machine.send("submit");
  // @ts-expect-error reset declares no payload
  void machine.send("reset", { code: "1234" });

  const snapshot = machine.getSnapshot();
  type _kind = Expect<Equal<typeof snapshot.type, "graph">>;
  type _events = Expect<Equal<typeof snapshot.availableEvents, readonly ("submit" | "reset")[]>>;

  // linear-only fields don't exist on graph snapshots (absent, not undefined)
  // @ts-expect-error graph snapshots have no stepOrder
  snapshot.steps.stepOrder;
  // @ts-expect-error graph snapshots have no declared-order index
  snapshot.currentStep?.index;

  return machine;
}

// ── snapshot union discriminates on `type`; results discriminate on `ok` ───

export function discriminants(
  snapshot:
    | LinearSnapshot<{ n: number }, "a" | "b", unknown>
    | GraphSnapshot<{ n: number }, "a" | "b", unknown>,
  result: NavigationResult<"a" | "b">
) {
  if (snapshot.type === "linear") {
    type _linear = Expect<Equal<typeof snapshot.steps.stepOrder, readonly ("a" | "b")[]>>;
  } else {
    type _graph = Expect<Equal<typeof snapshot.availableSteps, readonly ("a" | "b")[]>>;
  }

  if (result.ok) {
    type _to = Expect<Equal<typeof result.to, "a" | "b">>;
    // @ts-expect-error successful results carry no reason
    result.reason;
  } else {
    type _reason = Expect<Equal<typeof result.ok, false>>;
  }
}

// ── plugin tuples type machine.plugins by name ──────────────────────────────

export function pluginTypes() {
  const counter: JourneyPlugin<"counter", { count(): number }, { count: number }> = {
    name: "counter",
    setup: () => ({ api: { count: () => 0 } })
  };
  const machine = createLinearJourney(
    { steps: ["a"], context: {} },
    { plugins: [counter] as const }
  );

  type _api = Expect<Equal<typeof machine.plugins.counter, { count(): number }>>;
  // @ts-expect-error unregistered plugin names don't exist on the machine
  machine.plugins.other;

  return machine;
}
