import { describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { immerConnector } from "@rxova/journey-core/connectors/immer";

type CheckoutContext = {
  cart: {
    items: string[];
    total: number;
  };
  profile: {
    name: string;
  };
};

const initialContext = (): CheckoutContext => ({
  cart: { items: ["book"], total: 20 },
  profile: { name: "Ada" }
});

describe("immerConnector", () => {
  it("updates nested context immutably and preserves untouched branches", () => {
    const previous = initialContext();
    const next = immerConnector<CheckoutContext>((draft) => {
      draft.cart.items.push("pen");
      draft.cart.total += 5;
    })(previous);

    expect(next).not.toBe(previous);
    expect(next.cart).not.toBe(previous.cart);
    expect(next.profile).toBe(previous.profile);
    expect(next.cart).toEqual({ items: ["book", "pen"], total: 25 });
    expect(previous.cart).toEqual({ items: ["book"], total: 20 });
  });

  it("supports replacement recipes", () => {
    const previous = initialContext();
    const replacement = initialContext();
    replacement.profile.name = "Grace";

    const next = immerConnector<CheckoutContext>(() => replacement)(previous);

    expect(next).toEqual(replacement);
    expect(next).not.toBe(previous);
  });

  it("preserves the context reference when a recipe makes no changes", () => {
    const previous = initialContext();
    const next = immerConnector<CheckoutContext>(() => undefined)(previous);

    expect(next).toBe(previous);
  });

  it("can be passed directly to the machine context API", () => {
    const machine = createLinearJourney({
      steps: ["cart"],
      context: initialContext()
    });

    machine.context.update(
      immerConnector<CheckoutContext>((draft) => {
        draft.cart.total = 30;
      })
    );

    expect(machine.getSnapshot().context.cart.total).toBe(30);
  });
});
