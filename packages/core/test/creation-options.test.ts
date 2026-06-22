import { afterEach, describe, expect, it, vi } from "vitest";
import { createGraphJourney, createHeadlessJourney } from "@rxova/journey-core";
import type { GraphJourneyDefinition } from "@rxova/journey-core";

type Context = { plan: string | null };
type StepId = "verify" | "approved" | "blocked";
type EventMap = { type: "submit"; payload?: undefined };

// ─── Handler overrides at creation (options.handlers) ────────────────────────

describe("handler overrides at machine creation", () => {
  type Handlers = { allow: () => boolean; track: () => void };

  // A guard reads both handlers: `track` records that it ran, `allow` gates the
  // transition. Whether the machine lands on "approved" tells us which `allow`
  // implementation was injected.
  const buildDefinition = (
    handlers: Handlers
  ): GraphJourneyDefinition<Context, StepId, EventMap, unknown, Handlers> => ({
    initial: "verify",
    context: { plan: null },
    handlers,
    steps: { verify: {}, approved: {}, blocked: {} },
    transitions: {
      verify: {
        submit: [
          {
            to: "approved",
            when: ({ handlers: h }) => {
              h.track();
              return h.allow();
            }
          }
        ]
      }
    }
  });

  it("uses the creation-time handler in place of the definition's", async () => {
    const machine = createGraphJourney(
      buildDefinition({ allow: () => false, track: () => undefined }),
      { handlers: { allow: () => true } }
    );

    await machine.startJourney();
    await machine.send({ type: "submit" });

    // Definition would have blocked (allow → false); the override let it through.
    expect(machine.getSnapshot().currentStepId).toBe("approved");
    machine.dispose();
  });

  it("shallow-merges per key — omitted keys fall back to the definition", async () => {
    let definitionTrackCalls = 0;
    let overrideTrackCalls = 0;

    const machine = createGraphJourney(
      // Definition `allow` returns true and must survive the partial override.
      buildDefinition({ allow: () => true, track: () => (definitionTrackCalls += 1) }),
      { handlers: { track: () => (overrideTrackCalls += 1) } }
    );

    await machine.startJourney();
    await machine.send({ type: "submit" });

    // `allow` came from the definition (transition fired); `track` was overridden.
    expect(machine.getSnapshot().currentStepId).toBe("approved");
    expect(overrideTrackCalls).toBe(1);
    expect(definitionTrackCalls).toBe(0);
    machine.dispose();
  });

  it("does not mutate the definition's handlers, so a second machine is unaffected", async () => {
    const definition = buildDefinition({ allow: () => false, track: () => undefined });

    const overridden = createGraphJourney(definition, { handlers: { allow: () => true } });
    await overridden.startJourney();
    await overridden.send({ type: "submit" });
    expect(overridden.getSnapshot().currentStepId).toBe("approved");
    overridden.dispose();

    // Same definition, no override: the original `allow` (false) must still gate.
    const pristine = createGraphJourney(definition);
    await pristine.startJourney();
    await pristine.send({ type: "submit" });
    expect(pristine.getSnapshot().currentStepId).toBe("verify");
    pristine.dispose();
  });
});

// ─── No-match observability (options.onNoMatch) ──────────────────────────────

describe("no-match observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const guardedDefinition: GraphJourneyDefinition<Context, StepId, EventMap> = {
    initial: "verify",
    context: { plan: null },
    steps: { verify: {}, approved: {}, blocked: {} },
    transitions: {
      verify: {
        submit: [{ to: "approved", when: () => false }]
      }
    }
  };

  it("calls onNoMatch when every candidate transition is guarded and none pass", async () => {
    const onNoMatch = vi.fn();
    const machine = createGraphJourney(guardedDefinition, { onNoMatch });

    await machine.startJourney();
    const result = await machine.send({ type: "submit" });

    expect(result.transitioned).toBe(false);
    expect(onNoMatch).toHaveBeenCalledTimes(1);
    expect(onNoMatch).toHaveBeenCalledWith({ from: "verify", eventType: "submit" });
    machine.dispose();
  });

  it("calls onNoMatch when no transition is declared for the event", async () => {
    const onNoMatch = vi.fn();
    const machine = createGraphJourney<Context, StepId, EventMap>(
      {
        initial: "verify",
        context: { plan: null },
        steps: { verify: {}, approved: {}, blocked: {} },
        transitions: {}
      } satisfies GraphJourneyDefinition<Context, StepId, EventMap>,
      { onNoMatch }
    );

    await machine.startJourney();
    await machine.send({ type: "submit" });

    expect(onNoMatch).toHaveBeenCalledWith({ from: "verify", eventType: "submit" });
    machine.dispose();
  });

  it("does not call onNoMatch when the event matches a passing transition", async () => {
    const onNoMatch = vi.fn();
    const machine = createGraphJourney<Context, StepId, EventMap>(
      {
        initial: "verify",
        context: { plan: null },
        steps: { verify: {}, approved: {}, blocked: {} },
        transitions: { verify: { submit: [{ to: "approved" }] } }
      } satisfies GraphJourneyDefinition<Context, StepId, EventMap>,
      { onNoMatch }
    );

    await machine.startJourney();
    await machine.send({ type: "submit" });

    expect(machine.getSnapshot().currentStepId).toBe("approved");
    expect(onNoMatch).not.toHaveBeenCalled();
    machine.dispose();
  });

  it("calls onNoMatch when goToStepById finds no matching transition", async () => {
    const onNoMatch = vi.fn();
    const machine = createGraphJourney(guardedDefinition, { onNoMatch });

    await machine.startJourney();
    await machine.goToStepById("approved");

    expect(onNoMatch).toHaveBeenCalledWith({ from: "verify", eventType: "goToStepById" });
    machine.dispose();
  });

  it("falls back to a development warning when no onNoMatch is provided", async () => {
    const devGlobal = globalThis as typeof globalThis & { __DEV__?: unknown };
    const previousDev = devGlobal.__DEV__;
    devGlobal.__DEV__ = true; // force the dev-only warning path under NODE_ENV=test
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const machine = createGraphJourney(guardedDefinition);
      await machine.startJourney();
      await machine.send({ type: "submit" });

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain("matched no enabled transition");
      machine.dispose();
    } finally {
      devGlobal.__DEV__ = previousDev;
    }
  });

  it("does not warn or fire onNoMatch for a normal goToStepById transition", async () => {
    const onNoMatch = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const machine = createHeadlessJourney<Context, StepId>(
      {
        initial: "verify",
        context: { plan: null },
        steps: { verify: {}, approved: {}, blocked: {} }
      },
      { onNoMatch }
    );

    await machine.startJourney();
    await machine.goToStepById("approved");

    expect(machine.getSnapshot().currentStepId).toBe("approved");
    expect(onNoMatch).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    machine.dispose();
  });
});
