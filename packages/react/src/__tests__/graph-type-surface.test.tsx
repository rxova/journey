import React from "react";
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { withGraphTypes } from "@rxova/journey-react/graph";
import { flush, makeStep } from "@rxova/journey-react/testing";

/**
 * The React twin of Core's `withGraphTypes`: the bundle factory with its bag
 * pinned up front, for the case the factory cannot infer — a definition
 * authored away from the call site, where the event union sits at no inference
 * site and has to be told.
 */

type CheckoutBag = {
  context: { attempts: number };
  stepId: "cart" | "payment" | "done";
  events: { type: "PAY" } | { type: "BACK" };
};

const Cart = makeStep("cart");
const Payment = makeStep("payment");
const Done = makeStep("done");
const views = { cart: <Cart />, payment: <Payment />, done: <Done /> };

describe("withGraphTypes", () => {
  it("builds a bundle that renders and sends against the pinned bag", async () => {
    const journey = withGraphTypes<CheckoutBag>()({
      steps: {
        cart: { on: { PAY: "payment" } },
        payment: { on: { PAY: "done", BACK: "cart" } },
        done: {}
      },
      initial: "cart",
      context: { attempts: 0 }
    });

    render(
      <journey.Provider views={views}>
        <journey.StepRenderer fallback={<span data-testid="fallback">…</span>} />
      </journey.Provider>
    );
    await flush();
    expect(screen.getByTestId("step-cart")).toBeTruthy();

    await act(async () => {
      await journey.send("PAY");
    });
    expect(screen.getByTestId("step-payment")).toBeTruthy();

    await act(async () => {
      await journey.send("BACK");
    });
    expect(screen.getByTestId("step-cart")).toBeTruthy();
    expect(journey.machine.getSnapshot().context.attempts).toBe(0);
  });
});
