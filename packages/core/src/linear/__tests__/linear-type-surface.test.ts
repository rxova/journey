import { describe, expect, it } from "vitest";
import { withLinearTypes } from "@rxova/journey-core";
import { flush } from "@rxova/journey-core/testing";

/**
 * The linear counterpart to `withGraphTypes`: one declaration point for the
 * types a linear definition cannot infer on its own, `stepMeta` above all.
 * Asserted at runtime and through `@ts-expect-error`, so a regression fails
 * either the suite or the package typecheck.
 */

type CheckoutBag = {
  context: { total: number };
  stepId: "account" | "shipping" | "review";
  events: { type: "NEXT" };
  meta: { label: string };
};

const definition = {
  steps: [
    { id: "account" as const, stepMeta: { label: "Account" } },
    { id: "shipping" as const, stepMeta: { label: "Shipping" } },
    { id: "review" as const, stepMeta: { label: "Review" } },
  ],
  context: { total: 0 },
};

describe("withLinearTypes", () => {
  it("builds a running machine with the bag's context and stepMeta", async () => {
    const machine = withLinearTypes<CheckoutBag>()(definition);
    machine.controls.start();
    await flush();

    const snapshot = machine.getSnapshot();
    // Would be `Record<string, unknown>` before MetaOf threaded the bag's meta.
    const label: string | undefined = snapshot.currentStep?.stepMeta.label;
    expect(label).toBe("Account");
    expect(snapshot.context.total).toBe(0);
    expect(snapshot.steps.stepOrder).toEqual(["account", "shipping", "review"]);

    expect(await machine.navigate.goToNextStep()).toEqual({
      ok: true,
      from: "account",
      to: "shipping",
    });
  });

  it("rejects stepMeta that the bag does not declare", () => {
    const machine = withLinearTypes<CheckoutBag>()({
      // @ts-expect-error `title` is not part of the bag's stepMeta
      steps: [{ id: "account" as const, stepMeta: { title: "Account" } }],
      context: { total: 0 },
    });

    expect(machine.getSnapshot().steps.totalSteps).toBe(1);
  });
});
