import { describe, expect, it, vi } from "vitest";
import { createGraphJourney, createGraphJourneyBuilder } from "@rxova/journey-core";
import { flush, wait } from "@rxova/journey-core/testing";

type Ctx = { method: "email" | "sms" | null; attempts: number };

/**
 * Routing depends entirely on `method`, which starts null — so no candidate is
 * enabled until some work has supplied it. That is the shape the work-carrying
 * send exists for: the async produces the fact the guards route on.
 */
async function startedGraph(context: Partial<Ctx> = {}) {
  const machine = createGraphJourney({
    steps: { login: {}, email: {}, sms: {}, blocked: {} },
    transitions: {
      SUBMIT: [
        { from: "login", to: "email", when: ({ context: c }) => (c as Ctx).method === "email" },
        { from: "login", to: "sms", when: ({ context: c }) => (c as Ctx).method === "sms" }
      ],
      GIVE_UP: { from: "login", to: "blocked" }
    },
    initial: "login",
    context: { method: null, attempts: 0, ...context }
  });
  machine.controls.start();
  await flush();
  return machine;
}

describe("send with work", () => {
  it("stages context before routing, so guards decide on the work's result", async () => {
    const machine = await startedGraph();

    // SUBMIT is declared from login but has no enabled candidate up front:
    // method is still null, so both its guards fail.
    expect(machine.getSnapshot().declaredEvents).toContain("SUBMIT");
    expect(machine.getSnapshot().availableEvents).not.toContain("SUBMIT");

    const result = await machine.send("SUBMIT", {
      run: async () => {
        await wait(1);
        return { method: "sms" as const };
      },
      commit: ({ result: r, updateContext }) => {
        updateContext((c) => ({ ...(c as Ctx), method: r.method }));
      }
    });

    expect(result).toEqual({ ok: true, from: "login", to: "sms" });
    expect(machine.getSnapshot().currentStep?.id).toBe("sms");
    expect(machine.getSnapshot().context).toMatchObject({ method: "sms" });
  });

  it("holds position with an unresolved target during the working phase", async () => {
    const machine = await startedGraph();
    const phases: { phase: string | null; to: string | null; step: string | undefined }[] = [];

    machine.subscriptions.subscribeSelector(
      (s) => s.transition,
      () => {
        const s = machine.getSnapshot();
        phases.push({ phase: s.transition.phase, to: s.transition.to, step: s.currentStep?.id });
      }
    );

    const pending = machine.send("SUBMIT", {
      run: async () => {
        await wait(5);
        return { method: "email" as const };
      },
      commit: ({ result: r, updateContext }) =>
        updateContext((c) => ({ ...(c as Ctx), method: r.method }))
    });

    await flush();
    const working = machine.getSnapshot();
    expect(working.transition.phase).toBe("working");
    expect(working.transition.from).toBe("login");
    // The target is genuinely unknown until the guards run.
    expect(working.transition.to).toBeNull();
    expect(working.machine.isLoading).toBe(true);
    expect(working.currentStep?.id).toBe("login");

    await pending;
    expect(machine.getSnapshot().currentStep?.id).toBe("email");
  });

  it("rolls back the staged context when no candidate is enabled", async () => {
    const machine = await startedGraph();

    const result = await machine.send("SUBMIT", {
      run: async () => ({ method: null }),
      commit: ({ updateContext }) => {
        // Real work, real data — but it routes nowhere.
        updateContext((c) => ({ ...(c as Ctx), attempts: 7 }));
      }
    });

    expect(result).toEqual({ ok: false, reason: "no-enabled-transition" });
    expect(machine.getSnapshot().currentStep?.id).toBe("login");
    // Rolled back: either the send routed and committed, or neither happened.
    expect(machine.getSnapshot().context).toMatchObject({ method: null, attempts: 0 });
    expect(machine.getSnapshot().machine.isLoading).toBe(false);
    expect(machine.getSnapshot().transition.pending).toBe(false);
  });

  it("emits navigationBlocked on the rolled-back no-match", async () => {
    const machine = await startedGraph();
    const blocked = vi.fn();
    machine.subscriptions.subscribeEvent("navigationBlocked", blocked);

    await machine.send("SUBMIT", { run: () => undefined });

    expect(blocked).toHaveBeenCalledTimes(1);
    expect(blocked.mock.calls[0]?.[0]).toMatchObject({
      reason: "no-enabled-transition",
      from: "login"
    });
  });

  it("a throwing run commits nothing and reports the error", async () => {
    const machine = await startedGraph();
    const onError = vi.fn();
    machine.subscriptions.subscribeEvent("error", onError);

    const failure = new Error("network down");
    const result = await machine.send("SUBMIT", {
      run: async () => {
        throw failure;
      },
      commit: ({ updateContext }) => updateContext((c) => ({ ...(c as Ctx), attempts: 99 }))
    });

    expect(result).toEqual({ ok: false, reason: "error", error: failure });
    expect(machine.getSnapshot().currentStep?.id).toBe("login");
    expect(machine.getSnapshot().context).toMatchObject({ attempts: 0 });
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ phase: "work", stepId: "login" });
  });

  it("rejects a concurrent send while work is in flight", async () => {
    const machine = await startedGraph();

    const first = machine.send("SUBMIT", {
      run: async () => {
        await wait(5);
        return { method: "email" as const };
      },
      commit: ({ result: r, updateContext }) =>
        updateContext((c) => ({ ...(c as Ctx), method: r.method }))
    });
    await flush();

    // Distinct from no-enabled-transition: the machine is busy, not unrouted.
    expect(await machine.send("GIVE_UP")).toEqual({ ok: false, reason: "transitioning" });

    await first;
    expect(machine.getSnapshot().currentStep?.id).toBe("email");
  });

  it("bails out when the machine is terminated mid-work", async () => {
    const machine = await startedGraph();

    const pending = machine.send("SUBMIT", {
      run: async () => {
        await wait(5);
        return { method: "email" as const };
      },
      commit: ({ result: r, updateContext }) =>
        updateContext((c) => ({ ...(c as Ctx), method: r.method }))
    });
    await flush();

    machine.controls.terminate();
    expect(await pending).toEqual({ ok: false, reason: "not-running" });
    expect(machine.getSnapshot().currentStep?.id).toBe("login");
    expect(machine.getSnapshot().context).toMatchObject({ method: null });
  });

  it("work is optional — send without it keeps the original behaviour", async () => {
    const machine = await startedGraph({ method: "email" });
    expect(await machine.send("SUBMIT")).toEqual({ ok: true, from: "login", to: "email" });
  });

  it("a commit returning a promise is rejected as an error", async () => {
    const machine = await startedGraph();
    const result = await machine.send("SUBMIT", {
      run: () => undefined,
      commit: (() => Promise.resolve()) as never
    });
    expect(result).toMatchObject({ ok: false, reason: "error" });
  });
});

type LoginCtx = { method: "email" | "sms" | null };
type LoginEvent = { type: "SUBMIT" } | { type: "RESET" };
type LoginHandlers = { login: () => Promise<"email" | "sms"> };

/** The definition-first form: the machine owns the async, `send` stays bare. */
function buildDeclaredWorkJourney(handlers: LoginHandlers) {
  const { createStep, to, build } = createGraphJourneyBuilder<{
    context: LoginCtx;
    stepId: "login" | "email" | "sms";
    events: LoginEvent;
    handlers: LoginHandlers;
  }>();

  const definition = build({
    initial: "login",
    context: { method: null },
    handlers,
    steps: [
      createStep("login", {
        on: {
          SUBMIT: ({ to: into, work }) =>
            work({
              run: ({ handlers: h }) => h.login(),
              commit: ({ result, updateContext }) =>
                updateContext((c) => ({ ...c, method: result })),
              candidates: [
                into("email").when(({ context }) => context.method === "email"),
                into("sms").when(({ context }) => context.method === "sms")
              ]
            })
        }
      }),
      createStep("email", { on: { RESET: [to("login")] } }),
      createStep("sms", { on: { RESET: [to("login")] } })
    ]
  });

  const machine = createGraphJourney(definition, { autoStart: true });
  return machine;
}

describe("definition-declared send work", () => {
  it("runs the declared work and routes on what it staged, from a bare send", async () => {
    const machine = buildDeclaredWorkJourney({ login: async () => "sms" });
    await flush();

    expect(await machine.send("SUBMIT")).toEqual({ ok: true, from: "login", to: "sms" });
    expect(machine.getSnapshot().context).toEqual({ method: "sms" });
  });

  it("reaches injected dependencies through handlers", async () => {
    // Same definition, different injected client — the seam tests are meant to use.
    const machine = buildDeclaredWorkJourney({ login: async () => "email" });
    await flush();

    expect(await machine.send("SUBMIT")).toEqual({ ok: true, from: "login", to: "email" });
    expect(machine.getSnapshot().context).toEqual({ method: "email" });
  });

  it("does not apply the declared work to an event sent from another step", async () => {
    const login = vi.fn(async () => "sms" as const);
    const machine = buildDeclaredWorkJourney({ login });
    await flush();
    await machine.send("SUBMIT");
    expect(login).toHaveBeenCalledTimes(1);

    // RESET from "sms" has no declared work: it must not pick up login's.
    expect(await machine.send("RESET")).toEqual({ ok: true, from: "sms", to: "login" });
    expect(login).toHaveBeenCalledTimes(1);
  });

  it("rolls back when the staged context matches no candidate", async () => {
    const machine = buildDeclaredWorkJourney({ login: async () => null as never });
    await flush();

    expect(await machine.send("SUBMIT")).toEqual({
      ok: false,
      reason: "no-enabled-transition"
    });
    expect(machine.getSnapshot().currentStep?.id).toBe("login");
    expect(machine.getSnapshot().context).toEqual({ method: null });
  });
});

type AttemptCtx = { attempts: number };

/**
 * Work-scoped candidates: the guards read the run result directly, so the
 * routing fact never touches context — and `stay()` names the totality
 * fallback that keeps a failed attempt's staged context committed.
 */
function buildResultRoutedJourney(handlers: LoginHandlers) {
  const { createStep, to, build } = createGraphJourneyBuilder<{
    context: AttemptCtx;
    stepId: "login" | "email" | "sms";
    events: LoginEvent;
    handlers: LoginHandlers;
  }>();

  const definition = build({
    initial: "login",
    context: { attempts: 0 },
    handlers,
    steps: [
      createStep("login", {
        on: {
          SUBMIT: ({ work }) =>
            work({
              run: ({ handlers: h }) => h.login(),
              commit: ({ updateContext }) =>
                updateContext((c) => ({ ...c, attempts: c.attempts + 1 })),
              candidates: ({ to: into, stay }) => [
                into("email").when(({ result }) => result === "email"),
                into("sms").when(({ result }) => result === "sms"),
                stay()
              ]
            })
        }
      }),
      createStep("email", { on: { RESET: [to("login")] } }),
      createStep("sms", { on: { RESET: [to("login")] } })
    ]
  });

  return createGraphJourney(definition, { autoStart: true });
}

describe("work-result routing and stay()", () => {
  it("routes on the run result without persisting it in context", async () => {
    const machine = buildResultRoutedJourney({ login: async () => "sms" });
    await flush();

    expect(await machine.send("SUBMIT")).toEqual({ ok: true, from: "login", to: "sms" });
    // The routing fact stayed transient: context only holds business state.
    expect(machine.getSnapshot().context).toEqual({ attempts: 1 });
  });

  it("stay() keeps the staged context committed when no routed candidate matches", async () => {
    const machine = buildResultRoutedJourney({
      login: async () => "carrier-pigeon" as unknown as "email"
    });
    await flush();

    // Neither result guard passes, so the unguarded stay() wins: a
    // self-transition that commits the staged attempt count instead of
    // rolling it back with the send.
    expect(await machine.send("SUBMIT")).toEqual({ ok: true, from: "login", to: "login" });
    expect(machine.getSnapshot().context).toEqual({ attempts: 1 });
  });

  it("snapshot introspection evaluates result-reading guards with result undefined", async () => {
    const machine = buildResultRoutedJourney({ login: async () => "email" });
    await flush();

    const outgoing = machine.getSnapshot().outgoingTransitions;
    const [email, sms, self] = outgoing;
    // Outside a send there is no result, so result-dependent guards report
    // their resting-state answer; the unguarded stay() is what introspection
    // would select.
    expect(email).toMatchObject({ to: "email", guard: "failed", enabled: false });
    expect(sms).toMatchObject({ to: "sms", guard: "failed", enabled: false });
    expect(self).toMatchObject({ to: "login", guard: "none", enabled: true, selected: true });
  });

  it("warns at build time when every work candidate is guarded", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      buildDeclaredWorkJourney({ login: async () => "email" });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain('"SUBMIT" work on "login"');
      expect(warn.mock.calls[0]?.[0]).toContain("stay()");
    } finally {
      warn.mockRestore();
    }
  });

  it("allowRollback declares a partial event and silences the warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const { createStep, build } = createGraphJourneyBuilder<{
        context: AttemptCtx;
        stepId: "login" | "email";
        events: LoginEvent;
        handlers: LoginHandlers;
      }>();
      build({
        initial: "login",
        context: { attempts: 0 },
        handlers: { login: async () => "email" as const },
        steps: [
          createStep("login", {
            on: {
              SUBMIT: ({ work }) =>
                work({
                  run: ({ handlers: h }) => h.login(),
                  allowRollback: true,
                  candidates: ({ to: into }) => [
                    into("email").when(({ result }) => result === "email")
                  ]
                })
            }
          }),
          createStep("email", {})
        ]
      });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("an unguarded totality fallback silences the warning too", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      buildResultRoutedJourney({ login: async () => "email" });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
