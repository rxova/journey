// @vitest-environment node
// This file exercises the module-level branch in the wizard/headless hooks:
//   const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;
// In the jsdom environment (all other tests), typeof window !== "undefined", so React.useLayoutEffect
// is always selected. This file runs in the Node environment where typeof window === "undefined",
// forcing the React.useEffect branch.
import { describe, expect, it } from "vitest";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { useWizard, Wizard } from "../src";
import { createGraphJourney } from "../src/graph";

type Ctx = { count: number };

describe("SSR / Node environment", () => {
  it("renders <Wizard> to static markup without a DOM (first step, pre-start)", () => {
    const StepA = () => {
      const { activeStepId, status } = useWizard<Ctx>();
      return React.createElement("div", null, `${activeStepId}:${status}`);
    };

    const html = renderToStaticMarkup(
      React.createElement(
        Wizard as never,
        { context: { count: 0 } },
        React.createElement(StepA, { id: "a" }),
        React.createElement(StepA, { id: "b" })
      )
    );

    // Server render shows the initial step before startJourney (client-side).
    expect(html).toContain("a:idled");
  });

  it("renders a graph bundle Provider to static markup without a DOM", () => {
    const bundle = createGraphJourney({
      initial: "start",
      context: { count: 0 } as Ctx,
      steps: { start: {}, end: {} },
      transitions: { start: { goToNextStep: [{ to: "end" }] } }
    });

    const View = () => React.createElement("div", null, "start-node");
    const html = renderToStaticMarkup(
      React.createElement(bundle.Provider, {
        views: { start: View, end: View },
        children: React.createElement(bundle.StepRenderer)
      })
    );

    expect(html).toContain("start-node");
  });
});
