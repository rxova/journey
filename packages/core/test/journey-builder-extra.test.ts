import { describe, expect, it } from "vitest";

import { createJourneyBuilder } from "@rxova/journey-core";

type Context = { count: number; role: string };
type StepId = "start" | "review" | "done";
type EventMap = { submit: { source: string } };

describe("createJourneyBuilder extra coverage", () => {
  it("chains lifecycle modifiers on transition builders", () => {
    const { to } = createJourneyBuilder<Context, StepId, EventMap>();
    const when = () => true;
    const updateContext = ({ context }: { context: Context }) => context;
    const onEnter = () => undefined;
    const onLeave = () => undefined;

    const builder = to("review")
      .when(when)
      .updateContext(updateContext)
      .onEnter(onEnter)
      .onLeave(onLeave)
      .label("submit-review")
      .timeoutMs(500);

    expect(builder._candidate).toMatchObject({
      _to: "review",
      _when: when,
      _updateContext: updateContext,
      _onEnter: onEnter,
      _onLeave: onLeave,
      _label: "submit-review",
      _timeoutMs: 500
    });
  });

  it("serializes step hooks and function-based entries", () => {
    const { createStep, build } = createJourneyBuilder<Context, StepId, EventMap>();
    const stepOnEnter = () => undefined;
    const stepOnLeave = () => undefined;
    const transitionOnEnter = () => undefined;
    const transitionOnLeave = () => undefined;

    const definition = build({
      initial: "start",
      context: { count: 0, role: "user" },
      steps: [
        createStep("start", {
          onEnter: stepOnEnter,
          onLeave: stepOnLeave,
          on: {
            submit: ({ to }) => [
              to("review")
                .onEnter(transitionOnEnter)
                .onLeave(transitionOnLeave)
                .label("submit-review")
            ]
          }
        }),
        createStep("review"),
        createStep("done")
      ]
    });

    const transitions = definition.transitions as Record<string, Record<string, unknown[]>>;
    expect(definition.steps.start).toMatchObject({
      onEnter: stepOnEnter,
      onLeave: stepOnLeave
    });
    expect(transitions.start?.submit).toEqual([
      {
        to: "review",
        onEnter: transitionOnEnter,
        onLeave: transitionOnLeave,
        label: "submit-review"
      }
    ]);
  });

  it("serializes terminal candidate lifecycle hooks", () => {
    const { createStep, build } = createJourneyBuilder<Context, StepId, EventMap>();
    const when = ({ context }: { context: Context }) => context.role === "admin";
    const updateContext = ({ context }: { context: Context }) => ({
      ...context,
      count: context.count + 1
    });
    const onEnter = () => undefined;
    const onLeave = () => undefined;

    const definition = build({
      initial: "start",
      context: { count: 0, role: "user" },
      steps: [
        createStep("start"),
        createStep("review", {
          on: {
            completeJourney: [
              { when, updateContext, onEnter, onLeave, label: "finish", timeoutMs: 250 }
            ]
          }
        }),
        createStep("done")
      ],
      global: {
        terminateJourney: [{ onEnter, onLeave, label: "terminate", timeoutMs: 125 }]
      }
    });

    const transitions = definition.transitions as Record<string, Record<string, unknown>>;
    expect(transitions.review?.completeJourney).toEqual([
      { when, updateContext, onEnter, onLeave, label: "finish", timeoutMs: 250 }
    ]);
    expect(transitions.global?.terminateJourney).toEqual([
      { onEnter, onLeave, label: "terminate", timeoutMs: 125 }
    ]);
  });

  it("preserves handlers and ignores undefined or unsupported transition entries", () => {
    const handlers = {
      audit(message: string) {
        return message.length;
      }
    };
    const { createStep, build, to } = createJourneyBuilder<
      Context,
      StepId,
      EventMap,
      unknown,
      typeof handlers
    >();

    const definition = build({
      initial: "start",
      context: { count: 0, role: "user" },
      handlers,
      steps: [
        createStep("start", {
          on: {
            submit: [to("review")],
            ignored: undefined
          } as Record<string, unknown>
        }),
        createStep("review"),
        createStep("done")
      ],
      global: {
        submit: undefined,
        ignored: true
      } as Record<string, unknown>
    });

    const transitions = definition.transitions as Record<string, Record<string, unknown>>;
    expect(definition.handlers).toBe(handlers);
    expect(transitions.start?.submit).toEqual([{ to: "review" }]);
    expect("ignored" in (transitions.start ?? {})).toBe(false);
    expect("submit" in (transitions.global ?? {})).toBe(false);
    expect("ignored" in (transitions.global ?? {})).toBe(false);
  });
});
