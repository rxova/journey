import { describe, expect, it } from "vitest";

import { createJourneyBuilder, createJourneyMachine } from "@rxova/journey-core";

type Context = { count: number; role: string };
type StepId = "start" | "review" | "admin" | "done" | "blocked";
type EventMap = { submit: { origin: string }; back: unknown };

describe("createJourneyBuilder", () => {
  it("returns createStep, to, and build", () => {
    const builder = createJourneyBuilder<Context, StepId, EventMap>();
    expect(typeof builder.createStep).toBe("function");
    expect(typeof builder.to).toBe("function");
    expect(typeof builder.build).toBe("function");
  });

  describe("createStep", () => {
    it("creates a step with only meta — no transitions", () => {
      const { createStep, build } = createJourneyBuilder<Context, StepId, EventMap>();

      const startStep = createStep("start", { meta: { label: "Start" } as unknown });
      const doneStep = createStep("done");

      const definition = build({
        initial: "start",
        context: { count: 0, role: "user" },
        steps: [startStep, doneStep]
      });

      expect(definition.steps.start).toEqual({ meta: { label: "Start" } });
      expect(definition.steps.done).toEqual({});
      expect((definition.transitions as Record<string, unknown>).start).toBeUndefined();
    });

    it("creates a step with on transitions", () => {
      const { createStep, to, build } = createJourneyBuilder<Context, StepId, EventMap>();

      const startStep = createStep("start", {
        on: { submit: [to("review"), to("blocked")] }
      });
      const reviewStep = createStep("review");
      const blockedStep = createStep("blocked");

      const definition = build({
        initial: "start",
        context: { count: 0, role: "user" },
        steps: [startStep, reviewStep, blockedStep]
      });

      const transitions = definition.transitions as Record<string, Record<string, unknown[]>>;
      expect(transitions["start"]!["submit"]).toHaveLength(2);
      expect(transitions["start"]!["submit"]![0]).toMatchObject({ to: "review" });
      expect(transitions["start"]!["submit"]![1]).toMatchObject({ to: "blocked" });
    });
  });

  describe("to()", () => {
    it("creates a basic edge with just a target", () => {
      const { to } = createJourneyBuilder<Context, StepId, EventMap>();
      const builder = to("review");
      expect(builder._candidate._to).toBe("review");
      expect(builder._candidate._when).toBeUndefined();
      expect(builder._candidate._updateContext).toBeUndefined();
    });

    it(".when() stores the guard and returns a new builder", () => {
      const { to } = createJourneyBuilder<Context, StepId, EventMap>();
      const guard = ({ context }: { context: Context }) => context.count > 0;
      const builder = to("review").when(guard);
      expect(builder._candidate._when).toBe(guard);
    });

    it(".updateContext() stores the effect and returns a new builder", () => {
      const { to } = createJourneyBuilder<Context, StepId, EventMap>();
      const effect = ({ context }: { context: Context }) => ({
        ...context,
        count: context.count + 1
      });
      const builder = to("review").updateContext(effect);
      expect(builder._candidate._updateContext).toBe(effect);
    });

    it(".id() stores the id", () => {
      const { to } = createJourneyBuilder<Context, StepId, EventMap>();
      const builder = to("review").id("my-transition");
      expect(builder._candidate._id).toBe("my-transition");
    });

    it(".timeoutMs() stores the timeout", () => {
      const { to } = createJourneyBuilder<Context, StepId, EventMap>();
      const builder = to("review").timeoutMs(5000);
      expect(builder._candidate._timeoutMs).toBe(5000);
    });

    it("chains are immutable — original is unchanged", () => {
      const { to } = createJourneyBuilder<Context, StepId, EventMap>();
      const base = to("review");
      const withGuard = base.when(() => true);
      expect(base._candidate._when).toBeUndefined();
      expect(withGuard._candidate._when).toBeDefined();
    });

    it("chains all modifiers together", () => {
      const { to } = createJourneyBuilder<Context, StepId, EventMap>();
      const guard = () => true;
      const effect = ({ context }: { context: Context }) => context;
      const builder = to("review").when(guard).updateContext(effect).id("t1").timeoutMs(3000);
      expect(builder._candidate).toMatchObject({
        _to: "review",
        _when: guard,
        _updateContext: effect,
        _id: "t1",
        _timeoutMs: 3000
      });
    });

    it("keeps runtime overwrite semantics if duplicate modifiers are forced through", () => {
      const { to } = createJourneyBuilder<Context, StepId, EventMap>();
      const firstGuard = () => true;
      const secondGuard = () => false;
      const firstUpdate = ({ context }: { context: Context }) => ({ ...context, count: 1 });
      const secondUpdate = ({ context }: { context: Context }) => ({ ...context, count: 2 });

      const builder = (
        to("review")
          .when(firstGuard)
          .updateContext(firstUpdate)
          .id("first")
          .timeoutMs(100) as unknown as {
          when: (guard: typeof secondGuard) => {
            updateContext: (fn: typeof secondUpdate) => {
              id: (id: string) => { timeoutMs: (ms: number) => { _candidate: unknown } };
            };
          };
        }
      )
        .when(secondGuard)
        .updateContext(secondUpdate)
        .id("second")
        .timeoutMs(200) as { _candidate: Record<string, unknown> };

      expect(builder._candidate).toMatchObject({
        _to: "review",
        _when: secondGuard,
        _updateContext: secondUpdate,
        _id: "second",
        _timeoutMs: 200
      });
    });
  });

  describe("build()", () => {
    it("passes through initial and context", () => {
      const { build } = createJourneyBuilder<Context, StepId, EventMap>();
      const context = { count: 42, role: "admin" };
      const definition = build({
        initial: "start",
        context,
        steps: []
      });
      expect(definition.initial).toBe("start");
      expect(definition.context).toBe(context);
    });

    it("includes id and timeoutMs in edge when set", () => {
      const { createStep, to, build } = createJourneyBuilder<Context, StepId, EventMap>();

      const startStep = createStep("start", {
        on: { submit: [to("review").id("start-submit").timeoutMs(1000)] }
      });

      const definition = build({
        initial: "start",
        context: { count: 0, role: "user" },
        steps: [startStep, createStep("review")]
      });

      const transitions = definition.transitions as Record<string, Record<string, unknown[]>>;
      expect(transitions["start"]!["submit"]![0]).toMatchObject({
        to: "review",
        id: "start-submit",
        timeoutMs: 1000
      });
    });

    it("assembles global.completeJourney: true", () => {
      const { build } = createJourneyBuilder<Context, StepId, EventMap>();

      const definition = build({
        initial: "start",
        context: { count: 0, role: "user" },
        steps: [],
        global: { completeJourney: true, terminateJourney: true }
      });

      const transitions = definition.transitions as Record<string, Record<string, unknown>>;
      expect(transitions.global?.completeJourney).toBe(true);
      expect(transitions.global?.terminateJourney).toBe(true);
    });

    it("serializes step terminal candidates with guards, effects, ids, and timeouts", () => {
      const { createStep, build } = createJourneyBuilder<Context, StepId, EventMap>();
      const when = ({ context }: { context: Context }) => context.role === "admin";
      const effect = ({ context }: { context: Context }) => ({
        ...context,
        count: context.count + 1
      });

      const definition = build({
        initial: "start",
        context: { count: 0, role: "user" },
        steps: [
          createStep("start", {
            on: {
              completeJourney: [{ when, updateContext: effect, id: "finish-start", timeoutMs: 250 }]
            }
          })
        ]
      });

      const transitions = definition.transitions as Record<string, Record<string, unknown[]>>;
      expect(transitions["start"]!["completeJourney"]).toEqual([
        { when, updateContext: effect, id: "finish-start", timeoutMs: 250 }
      ]);
    });

    it("serializes global terminal candidate arrays", () => {
      const { build } = createJourneyBuilder<Context, StepId, EventMap>();
      const when = ({ context }: { context: Context }) => context.count > 0;
      const effect = ({ context }: { context: Context }) => ({
        ...context,
        count: context.count + 1
      });

      const definition = build({
        initial: "start",
        context: { count: 0, role: "user" },
        steps: [],
        global: {
          completeJourney: [{ when, updateContext: effect, id: "global-complete", timeoutMs: 500 }],
          terminateJourney: []
        }
      });

      const transitions = definition.transitions as Record<string, Record<string, unknown>>;
      expect(transitions.global?.completeJourney).toEqual([
        { when, updateContext: effect, id: "global-complete", timeoutMs: 500 }
      ]);
      expect(transitions.global?.terminateJourney).toEqual([]);
    });

    it("produces a definition that createJourneyMachine accepts", () => {
      const { createStep, to, build } = createJourneyBuilder<Context, StepId, EventMap>();

      const startStep = createStep("start", {
        on: { submit: [to("review")] }
      });
      const reviewStep = createStep("review");

      const definition = build({
        initial: "start",
        context: { count: 0, role: "user" },
        steps: [startStep, reviewStep],
        global: { completeJourney: true, terminateJourney: true }
      });

      expect(() => createJourneyMachine(definition)).not.toThrow();
    });
  });

  describe("end-to-end with createJourneyMachine", () => {
    it("guard fires on send — matching guard allows transition", async () => {
      const { createStep, to, build } = createJourneyBuilder<Context, StepId, EventMap>();

      const startStep = createStep("start", {
        on: {
          submit: [to("admin").when(({ context }) => context.role === "admin"), to("review")]
        }
      });

      const definition = build({
        initial: "start",
        context: { count: 0, role: "admin" },
        steps: [startStep, createStep("review"), createStep("admin")],
        global: { completeJourney: true, terminateJourney: true }
      });

      const machine = createJourneyMachine(definition);
      await machine.start();
      const result = await machine.send({ type: "submit" });

      expect(result.transitioned).toBe(true);
      expect(result.snapshot.currentStepId).toBe("admin");
    });

    it("guard fires on send — non-matching guard falls through to next candidate", async () => {
      const { createStep, to, build } = createJourneyBuilder<Context, StepId, EventMap>();

      const startStep = createStep("start", {
        on: {
          submit: [to("admin").when(({ context }) => context.role === "admin"), to("review")]
        }
      });

      const definition = build({
        initial: "start",
        context: { count: 0, role: "user" },
        steps: [startStep, createStep("review"), createStep("admin")],
        global: { completeJourney: true, terminateJourney: true }
      });

      const machine = createJourneyMachine(definition);
      await machine.start();
      const result = await machine.send({ type: "submit" });

      expect(result.transitioned).toBe(true);
      expect(result.snapshot.currentStepId).toBe("review");
    });

    it("updateContext mutates context on transition", async () => {
      const { createStep, to, build } = createJourneyBuilder<Context, StepId, EventMap>();

      const startStep = createStep("start", {
        on: {
          submit: [
            to("review").updateContext(({ context }) => ({ ...context, count: context.count + 10 }))
          ]
        }
      });

      const definition = build({
        initial: "start",
        context: { count: 0, role: "user" },
        steps: [startStep, createStep("review")],
        global: { completeJourney: true, terminateJourney: true }
      });

      const machine = createJourneyMachine(definition);
      await machine.start();
      const result = await machine.send({ type: "submit" });

      expect(result.snapshot.currentStepId).toBe("review");
      expect(result.snapshot.context.count).toBe(10);
    });

    it("step terminal entries run guards and effects at runtime", async () => {
      const { createStep, to, build } = createJourneyBuilder<Context, StepId, EventMap>();

      const definition = build({
        initial: "start",
        context: { count: 1, role: "admin" },
        steps: [
          createStep("start", {
            on: {
              submit: [to("review")]
            }
          }),
          createStep("review", {
            on: {
              completeJourney: [
                {
                  when: ({ context }) => context.role === "admin",
                  updateContext: ({ context }) => ({ ...context, count: context.count + 4 }),
                  id: "review-complete"
                }
              ]
            }
          })
        ]
      });

      const machine = createJourneyMachine(definition);
      await machine.start();
      await machine.send({ type: "submit" });
      const result = await machine.completeJourney();

      expect(result.transitioned).toBe(true);
      expect(result.transitionId).toBe("review-complete");
      expect(result.snapshot.status).toBe("completed");
      expect(result.snapshot.context.count).toBe(5);
    });

    it("global non-terminal event routes correctly", async () => {
      const { createStep, to, build } = createJourneyBuilder<Context, StepId, EventMap>();

      const definition = build({
        initial: "start",
        context: { count: 0, role: "user" },
        steps: [createStep("start"), createStep("review"), createStep("blocked")],
        global: {
          completeJourney: true,
          terminateJourney: true,
          back: [to("blocked")]
        }
      });

      const machine = createJourneyMachine(definition);
      await machine.start();
      const result = await machine.send({ type: "back" });

      expect(result.transitioned).toBe(true);
      expect(result.snapshot.currentStepId).toBe("blocked");
    });
  });
});
