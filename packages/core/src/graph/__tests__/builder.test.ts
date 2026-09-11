import { describe, expect, it } from "vitest";
import { createGraphJourney, createGraphJourneyBuilder } from "@rxova/journey-core";
import { flush } from "@rxova/journey-core/testing";

type LoginContext = { attempts: number; error: string | null };
type StepId = "login" | "verifyCode" | "loggedIn" | "blocked";
type EventMap =
  | { type: "submitCredentials" }
  | { type: "submitCode"; payload: { code: string } }
  | { type: "reset" };
type AuthHandlers = { verifyCode(code: string): boolean };

const { createStep, to, build } = createGraphJourneyBuilder<{
  context: LoginContext;
  stepId: StepId;
  events: EventMap;
  meta: { label: string };
  handlers: AuthHandlers;
}>();

const loginStep = createStep("login", {
  metadata: { label: "Login" },
  on: {
    submitCredentials: [to("verifyCode")]
  }
});

const verifyCodeStep = createStep("verifyCode", {
  metadata: { label: "Verify" },
  on: {
    // callback form narrows the event payload for onTransition
    submitCode: ({ to: scopedTo }) => [
      scopedTo("blocked").when(({ context }) => context.attempts >= 2),
      scopedTo("loggedIn").onTransition(({ event, updateContext }) => {
        if (event?.payload.code !== "1234") {
          updateContext((c) => ({ ...c, error: "bad code" }));
        }
      })
    ]
  }
});

const loggedInStep = createStep("loggedIn", { metadata: { label: "Done" } });
const blockedStep = createStep("blocked", {
  metadata: { label: "Blocked" },
  on: { reset: [to("login")] }
});

function buildDefinition() {
  return build({
    initial: "login",
    context: { attempts: 0, error: null },
    handlers: { verifyCode: (code) => code === "1234" },
    steps: [loginStep, verifyCodeStep, loggedInStep, blockedStep]
  });
}

describe("createGraphJourneyBuilder", () => {
  it("normalizes colocated authoring into the canonical definition shape", () => {
    const definition = buildDefinition();

    expect(definition.initial).toBe("login");
    expect(Object.keys(definition.steps)).toEqual(["login", "verifyCode", "loggedIn", "blocked"]);
    expect(definition.steps.login.metadata).toEqual({ label: "Login" });

    // central transitions map keyed by event, `from` filled in per candidate
    expect(definition.transitions.submitCredentials).toMatchObject([
      { from: "login", to: "verifyCode" }
    ]);
    expect(definition.transitions.submitCode).toMatchObject([
      { from: "verifyCode", to: "blocked" },
      { from: "verifyCode", to: "loggedIn" }
    ]);
    expect(definition.transitions.reset).toMatchObject([{ from: "blocked", to: "login" }]);
  });

  it("built definitions drive a fully working runtime", async () => {
    const machine = createGraphJourney(buildDefinition());
    machine.controls.start();
    await flush();

    expect(await machine.send("submitCredentials")).toEqual({
      ok: true,
      from: "login",
      to: "verifyCode"
    });
    expect(await machine.send("submitCode", { code: "9999" })).toEqual({
      ok: true,
      from: "verifyCode",
      to: "loggedIn"
    });
    expect(machine.getSnapshot().context.error).toBe("bad code");
  });

  it("guard order: first enabled candidate wins", async () => {
    const machine = createGraphJourney(buildDefinition());
    machine.controls.start();
    await flush();
    machine.context.update((c) => ({ ...c, attempts: 3 }));
    await machine.send("submitCredentials");

    expect(await machine.send("submitCode", { code: "1234" })).toEqual({
      ok: true,
      from: "verifyCode",
      to: "blocked"
    });
  });

  it("declared events type send exactly", async () => {
    const machine = createGraphJourney(buildDefinition());
    machine.controls.start();
    await flush();

    // @ts-expect-error unknown event type
    void machine.send("nope");
    // @ts-expect-error submitCode requires its payload
    void machine.send("submitCode");

    expect(await machine.send("reset")).toMatchObject({
      ok: false,
      reason: "no-enabled-transition"
    });
  });

  it("throws on duplicate step ids", () => {
    expect(() =>
      build({
        initial: "login",
        context: { attempts: 0, error: null },
        steps: [loginStep, loginStep]
      })
    ).toThrow(/duplicate step id "login"/);
  });

  it("ignores optional event entries that are explicitly undefined", () => {
    const bag = createGraphJourneyBuilder<{
      context: Record<string, never>;
      stepId: "a";
      events: { type: "GO" };
    }>();
    const definition = bag.build({
      initial: "a",
      context: {},
      steps: [bag.createStep("a", { on: { GO: undefined } as never })]
    });

    expect(definition.transitions).toEqual({});
  });
});

describe("builder step hooks", () => {
  it("onEnter/onLeave authored through the builder run in the runtime", async () => {
    const bag = createGraphJourneyBuilder<{
      context: { log: string[] };
      stepId: "a" | "b";
      events: { type: "GO" };
    }>();

    const definition = bag.build({
      initial: "a",
      context: { log: [] },
      steps: [
        bag.createStep("a", {
          onLeave: ({ updateContext }) =>
            void updateContext((c) => ({ log: [...c.log, "leave:a"] })),
          on: { GO: [bag.to("b")] }
        }),
        bag.createStep("b", {
          onEnter: ({ updateContext }) =>
            void updateContext((c) => ({ log: [...c.log, "enter:b"] }))
        })
      ]
    });

    const machine = createGraphJourney(definition);
    machine.controls.start();
    await flush();
    await machine.send("GO");
    expect(machine.getSnapshot().context.log).toEqual(["leave:a", "enter:b"]);
  });
});
