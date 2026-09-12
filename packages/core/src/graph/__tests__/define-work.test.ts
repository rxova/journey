import { describe, expect, expectTypeOf, it } from "vitest";
import { defineWork, withGraphTypes } from "@rxova/journey-core";
import { flush, wait } from "@rxova/journey-core/testing";

type Ctx = { readonly method: "email" | "sms" | null; readonly token: string | null };
type Submitted = { readonly method: "email" | "sms"; readonly token: string };

/**
 * Deliberately declares no `results`. That is the whole point: `defineWork`
 * reads the result type off `run`, so the bag does not have to restate it.
 */
type AuthBag = {
  context: Ctx;
  stepId: "login" | "email" | "sms";
  events: { type: "SUBMIT"; payload: { readonly pin: string } } | { type: "RESET" };
  handlers: { readonly submit: () => Promise<Submitted> };
};

const handlers = {
  submit: async () => {
    await wait(1);
    return { method: "sms", token: "t0ken" } as const;
  }
};

describe("defineWork", () => {
  it("infers the run result into commit and the candidates' guards", async () => {
    const machine = withGraphTypes<AuthBag>()({
      initial: "login",
      context: { method: null, token: null },
      handlers,
      steps: {
        login: {
          on: {
            SUBMIT: defineWork<AuthBag, "SUBMIT">()({
              run: ({ handlers: h, event }) => {
                // Narrowed to the key the entry is declared under, so the
                // payload is reachable without a cast.
                expectTypeOf(event.payload).toEqualTypeOf<{ readonly pin: string }>();
                return h.submit();
              },
              commit: ({ result, updateContext }) => {
                expectTypeOf(result).toEqualTypeOf<Submitted>();
                updateContext((c) => ({ ...c, method: result.method, token: result.token }));
              },
              // Guards route on the context `commit` staged, not on the result
              // directly — they stay total functions of context.
              candidates: [
                {
                  to: "email",
                  label: "verify-by-email",
                  when: ({ context }) => context.method === "email"
                },
                { to: "sms", label: "verify-by-sms" }
              ]
            })
          }
        },
        email: {},
        sms: {}
      }
    });

    machine.controls.start();
    await flush();
    const moved = await machine.send("SUBMIT", { pin: "1234" });
    await flush();

    expect(moved).toMatchObject({ ok: true, from: "login", to: "sms" });
    expect(machine.getSnapshot().context).toEqual({ method: "sms", token: "t0ken" });
  });

  it("routes on what commit staged, through guards that only see context", async () => {
    const machine = withGraphTypes<AuthBag>()({
      initial: "login",
      context: { method: null, token: null },
      handlers,
      steps: {
        login: {
          on: {
            SUBMIT: defineWork<AuthBag, "SUBMIT">()({
              run: () => Promise.resolve({ method: "email", token: "t" } as Submitted),
              commit: ({ result, updateContext }) =>
                updateContext((c) => ({ ...c, method: result.method })),
              candidates: [
                { to: "email", when: ({ context }) => context.method === "email" },
                { to: "sms" }
              ]
            })
          }
        },
        email: {},
        sms: {}
      }
    });

    machine.controls.start();
    await flush();
    await machine.send("SUBMIT", { pin: "1234" });
    await flush();

    expect(machine.getSnapshot().currentStep?.id).toBe("email");
    expect(machine.getSnapshot().context).toEqual({ method: "email", token: null });
  });

  it("carries its own label and budget through to the runtime", async () => {
    const machine = withGraphTypes<AuthBag>()({
      initial: "login",
      context: { method: null, token: null },
      handlers,
      steps: {
        login: {
          on: {
            SUBMIT: defineWork<AuthBag, "SUBMIT">()({
              run: async () => {
                await wait(5_000);
                return { method: "sms", token: "t" } as Submitted;
              },
              label: "submit-credentials",
              timeoutMs: 5,
              candidates: [{ to: "sms" }]
            })
          }
        },
        email: {},
        sms: {}
      }
    });

    machine.controls.start();
    await flush();
    const result = await machine.send("SUBMIT", { pin: "1234" });

    expect(result).toMatchObject({ ok: false, reason: "error" });
    expect((result as { error: Error }).error.message).toContain(
      "send work(submit-credentials) timed out after 5ms"
    );
  });

  it("returns its argument unchanged at runtime", () => {
    const config = {
      run: () => Promise.resolve({ method: "sms", token: "t" } as Submitted),
      candidates: [{ to: "sms" as const }]
    };
    expect(defineWork<AuthBag, "SUBMIT">()(config)).toBe(config);
  });
});
