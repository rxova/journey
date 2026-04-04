import { describe, expect, it } from "vitest";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";
import { createReplayPlugin, serializeReplaySession } from "@rxova/journey-core/replay";

type StepId = "start" | "review";
type EventMap = { fail: { reason: string } };
type Context = { count: number };

const createJourney = (): JourneyDefinition<Context, StepId, EventMap> => ({
  initial: "start",
  context: { count: 0 },
  steps: {
    start: {},
    review: {}
  },
  transitions: {
    start: {
      goToNextStep: [{ id: "start-review", to: "review" }],
      fail: [
        {
          id: "fail-start",
          to: "review",
          when: () => {
            throw new Error("boom");
          }
        }
      ]
    }
  }
});

describe("replay plugin", () => {
  it("captures snapshots and lifecycle events into a replay session", async () => {
    const machine = createJourneyMachine(createJourney(), {
      plugins: [createReplayPlugin()] as const
    });

    await machine.startJourney();
    await machine.send({ type: "goToNextStep" });

    const session = machine.getReplaySession();

    expect(session.version).toBe(1);
    expect(session.initialSnapshot?.currentStepId).toBe("start");
    expect(
      session.entries.some((entry) => entry.kind === "snapshot" && entry.reason === "start")
    ).toBe(true);
    expect(
      session.entries.some(
        (entry) =>
          entry.kind === "event" &&
          entry.event.type === "transition.success" &&
          entry.event.transitionId === "start-review"
      )
    ).toBe(true);
  });

  it("serializes replay sessions with safe error output", async () => {
    const machine = createJourneyMachine(createJourney(), {
      plugins: [createReplayPlugin()] as const
    });

    await machine.startJourney();
    await machine.send({ type: "fail", payload: { reason: "test" } });

    const exported = machine.exportReplaySession({ pretty: true });
    const parsed = JSON.parse(exported) as {
      entries: Array<{
        kind: string;
        event?: { type: string; error?: { message?: string } };
      }>;
    };

    expect(parsed.entries.some((entry) => entry.kind === "event")).toBe(true);
    expect(
      parsed.entries.some(
        (entry) => entry.event?.type === "transition.error" && entry.event.error?.message === "boom"
      )
    ).toBe(true);

    expect(() => serializeReplaySession(machine.getReplaySession())).not.toThrow();
  });

  it("resets the replay buffer and honors maxEntries", async () => {
    const machine = createJourneyMachine(createJourney(), {
      plugins: [createReplayPlugin({ maxEntries: 2 })] as const
    });

    await machine.startJourney();
    await machine.send({ type: "goToNextStep" });

    const beforeClear = machine.getReplaySession();
    expect(beforeClear.truncated).toBe(true);
    expect(beforeClear.entries).toHaveLength(2);

    machine.clearReplaySession();

    const session = machine.getReplaySession();
    expect(session.entries).toEqual([]);
    expect(session.truncated).toBe(false);
    expect(session.initialSnapshot?.currentStepId).toBe("review");
  });

  it("supports capture flags and cleans up replay subscriptions on dispose", async () => {
    const snapshotsOnly = createJourneyMachine(createJourney(), {
      plugins: [createReplayPlugin({ captureEvents: false, maxEntries: 0.25 })] as const
    });

    await snapshotsOnly.startJourney();
    await snapshotsOnly.send({ type: "goToNextStep" });

    const snapshotSession = snapshotsOnly.getReplaySession();
    expect(snapshotSession.entries).toHaveLength(1);
    expect(snapshotSession.truncated).toBe(true);
    expect(snapshotSession.entries.every((entry) => entry.kind === "snapshot")).toBe(true);
    expect(() => snapshotsOnly.dispose()).not.toThrow();

    const eventsOnly = createJourneyMachine(createJourney(), {
      plugins: [createReplayPlugin({ captureSnapshots: false })] as const
    });

    await eventsOnly.startJourney();
    await eventsOnly.send({ type: "goToNextStep" });

    const eventSession = eventsOnly.getReplaySession();
    expect(eventSession.entries.length).toBeGreaterThan(0);
    expect(eventSession.entries.every((entry) => entry.kind === "event")).toBe(true);
    expect(() => eventsOnly.dispose()).not.toThrow();
  });

  it("falls back to the default replay buffer size for non-finite maxEntries", async () => {
    const machine = createJourneyMachine(createJourney(), {
      plugins: [
        createReplayPlugin({
          captureEvents: false,
          maxEntries: Number.POSITIVE_INFINITY
        })
      ] as const
    });

    await machine.startJourney();

    for (let index = 0; index < 505; index += 1) {
      await machine.updateContext((context) => ({
        ...context,
        count: context.count + 1
      }));
    }

    const session = machine.getReplaySession();
    expect(session.entries).toHaveLength(500);
    expect(session.truncated).toBe(true);
  });

  it("serializes circular and unsupported replay values safely", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const error = new Error("boom");
    Reflect.deleteProperty(error, "stack");

    const serialized = serializeReplaySession(
      {
        version: 1,
        initialSnapshot: null,
        truncated: false,
        entries: [
          {
            kind: "event",
            timestamp: 0,
            event: {
              type: "debug",
              payload: {
                list: [1, undefined, 2n],
                big: 12n,
                missing: undefined,
                fn: () => "ignored",
                sym: Symbol("debug"),
                date: new Date("2024-01-02T03:04:05.000Z"),
                error,
                circular
              }
            }
          }
        ]
      } as never,
      { pretty: true }
    );

    const parsed = JSON.parse(serialized) as {
      entries: Array<{
        event: {
          payload: {
            list: unknown[];
            big: string;
            missing: null;
            fn: string;
            sym: string;
            date: string;
            error: { name: string; message: string; stack?: string };
            circular: { self: string };
          };
        };
      }>;
    };

    expect(parsed.entries[0]?.event.payload.list).toEqual([1, null, "2"]);
    expect(parsed.entries[0]?.event.payload.big).toBe("12");
    expect(parsed.entries[0]?.event.payload.missing).toBeNull();
    expect(parsed.entries[0]?.event.payload.fn).toBe("[unsupported:function]");
    expect(parsed.entries[0]?.event.payload.sym).toBe("[unsupported:symbol]");
    expect(parsed.entries[0]?.event.payload.date).toBe("2024-01-02T03:04:05.000Z");
    expect(parsed.entries[0]?.event.payload.error).toEqual({
      name: "Error",
      message: "boom"
    });
    expect(parsed.entries[0]?.event.payload.circular.self).toBe("[circular]");
  });
});
