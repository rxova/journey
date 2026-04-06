import { describe, expect, it } from "vitest";

import {
  createJourneyMachine,
  JourneyDisposedError,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "account" | "review";
type Context = { attempts: number };

const createJourney = (): JourneyDefinition<Context, StepId> => ({
  initial: "account",
  context: { attempts: 0 },
  steps: {
    account: { meta: { title: "Account" } },
    review: { meta: { title: "Review" } }
  },
  transitions: {
    account: {
      goToNextStep: [{ label: "account-next", to: "review" }]
    },
    review: {
      completeJourney: true
    }
  }
});

describe("core public entrypoint", () => {
  it("re-exports the machine factory", () => {
    expect(createJourneyMachine).toBeTypeOf("function");
  });

  it("re-exports JourneyDisposedError", () => {
    expect(JourneyDisposedError).toBeTypeOf("function");
  });

  it("creates a machine directly from the authored journey definition", async () => {
    const machine = createJourneyMachine(createJourney());
    await machine.startJourney();

    const result = await machine.goToNextStep();

    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toEqual(expect.any(String));
    expect(result.label).toBe("account-next");
    expect(result.snapshot.currentStepId).toBe("review");
    expect(machine.getStepMeta("review")).toEqual({ title: "Review" });
  });

  it("rejects invalid authored graph transitions through the public factory", () => {
    const journey = createJourney();
    journey.transitions = {
      account: {
        goToNextStep: [{ to: "review", debug: true } as never]
      }
    };

    expect(() => createJourneyMachine(journey)).toThrow(/unsupported field "debug"/i);
  });

  it("rejects non-serializable initial context through the public factory", () => {
    expect(() =>
      createJourneyMachine({
        ...createJourney(),
        context: {
          attempts: 0,
          issuedAt: new Date()
        } as never
      })
    ).toThrow(/json-serializable/i);
  });

  it("rejects non-serializable updateContext results through the public factory", async () => {
    const machine = createJourneyMachine(createJourney());
    await machine.startJourney();

    await expect(
      machine.updateContext(
        (context) =>
          ({
            ...context,
            cache: new Map()
          }) as never
      )
    ).rejects.toThrow(/json-serializable/i);
  });
});
