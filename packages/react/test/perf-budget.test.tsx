import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";

import React from "react";
import { act } from "react";
import { render } from "@testing-library/react";

import { useWizard, Wizard } from "@rxova/journey-react";
import type { UseWizardResult } from "@rxova/journey-react";

type Ctx = { count: number };

let latestWizard: UseWizardResult<Ctx> | null = null;

const Step = (props: { id?: string; label: string }) => {
  void props;
  return <div>{props.label}</div>;
};

const Harness = () => {
  const wizard = useWizard<Ctx>();

  React.useLayoutEffect(() => {
    latestWizard = wizard;
  });

  return <output data-testid="active">{wizard.activeStepId}</output>;
};

describe("wizard perf budget", () => {
  it("navigates a three-step loop within budget", async () => {
    render(
      <Wizard context={{ count: 0 }} header={<Harness />}>
        <Step id="start" label="start" />
        <Step id="details" label="details" />
        <Step id="review" label="review" />
      </Wizard>
    );
    await act(async () => {
      await Promise.resolve();
    });

    const iterations = 60;
    const begin = performance.now();
    for (let index = 0; index < iterations; index += 1) {
      await act(async () => {
        await latestWizard?.goToNextStep();
      });
      await act(async () => {
        await latestWizard?.goToNextStep();
      });
      await act(async () => {
        await latestWizard?.goToPreviousStep(2);
      });
    }
    const elapsed = performance.now() - begin;

    // Generous CI budget: ~3 navigations × 60 iterations.
    expect(elapsed).toBeLessThan(5000);
    expect(latestWizard?.activeStepId).toBe("start");
  });
});
