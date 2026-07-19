import React from "react";
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { createGraphJourney } from "@rxova/journey-react/graph";
import { flush, makeStep } from "@rxova/journey-react/testing";

type Ctx = { n: number };

const makeBundle = () =>
  createGraphJourney({
    steps: { a: {}, b: {} },
    transitions: { NEXT: { from: "a", to: "b" } },
    initial: "a",
    context: { n: 0 } as Ctx
  });

describe("graph bundle useApi identity", () => {
  it("returns the same api object across snapshot-driven re-renders", async () => {
    const bundle = makeBundle();
    const apis: unknown[] = [];
    const Probe = () => {
      const api = bundle.useApi();
      apis.push(api);
      const n = bundle.useSelector((snapshot) => (snapshot.context as Ctx).n);
      return (
        <button data-testid="bump" onClick={() => api.updateContext((c) => ({ n: c.n + 1 }))}>
          {n}
        </button>
      );
    };

    render(
      <bundle.Provider views={{ a: makeStep("a"), b: makeStep("b") }}>
        <Probe />
      </bundle.Provider>
    );
    await flush();

    await act(async () => {
      screen.getByTestId("bump").click();
      await flush();
    });
    await act(async () => {
      screen.getByTestId("bump").click();
      await flush();
    });

    expect(screen.getByTestId("bump").textContent).toBe("2");
    expect(apis.length).toBeGreaterThanOrEqual(3);
    for (const api of apis) {
      expect(api).toBe(apis[0]);
    }
  });
});
