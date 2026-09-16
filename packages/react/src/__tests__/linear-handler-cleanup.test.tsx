import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { createLinearJourney } from "@rxova/journey-react";
import { flush } from "@rxova/journey-react/testing";

/**
 * The step-handler registry's unmount path: registrations are per mounted
 * caller, so overlapping mounts, StrictMode's double effect and a changing
 * `stepId` must each leave the registry holding exactly the live callers.
 */

describe("the linear bundle's step-handler registry", () => {
  it("survives StrictMode's double effect without shadowing itself", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const journey = createLinearJourney({ context: {}, steps: ["a", "b"] }, { autoStart: true });
    const ran: string[] = [];

    const Holder = () => {
      journey.useStepHandler("a", {
        run: () => {
          ran.push("held");
        }
      });
      return <span>holder</span>;
    };

    const view = render(
      <React.StrictMode>
        <Holder />
      </React.StrictMode>
    );
    await flush();

    // A single caller double-mounted is not two live registrations.
    expect(consoleWarn).not.toHaveBeenCalled();

    await journey.navigate.goToNextStep();
    expect(ran).toEqual(["held"]);

    view.unmount();
    await flush();
    consoleWarn.mockRestore();
    delete (globalThis as { __DEV__?: boolean }).__DEV__;
  });

  it("drops each caller's own entry as overlapping holders unmount in turn", async () => {
    const journey = createLinearJourney(
      { context: {}, steps: ["a", "b", "c"] },
      { autoStart: true }
    );
    const ran: string[] = [];

    const Holder = ({ tag }: { tag: string }) => {
      journey.useStepHandler("a", {
        run: () => {
          ran.push(tag);
        }
      });
      return <span>{tag}</span>;
    };

    const view = render(
      <>
        <Holder tag="first" />
        <Holder tag="second" />
      </>
    );
    await flush();

    // Dropping the last registration hands the step back to the survivor.
    view.rerender(
      <>
        <Holder tag="first" />
      </>
    );
    await flush();

    await journey.navigate.goToNextStep();
    expect(ran).toEqual(["first"]);

    view.unmount();
    await flush();

    // No holder remains, so the next move runs ungated.
    const result = await journey.navigate.goToNextStep();
    expect(result).toMatchObject({ ok: true, from: "b", to: "c" });
    expect(ran).toEqual(["first"]);
  });

  it("releases the old step's entry when the stepId argument changes", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["a", "b"] }, { autoStart: true });
    const ran: string[] = [];

    const Holder = ({ step }: { step: "a" | "b" }) => {
      journey.useStepHandler(step, {
        run: () => {
          ran.push(step);
        }
      });
      return <span>{step}</span>;
    };

    const view = render(<Holder step="a" />);
    await flush();
    view.rerender(<Holder step="b" />);
    await flush();

    // "a" was released, so the first move is ungated.
    await journey.navigate.goToNextStep();
    expect(ran).toEqual([]);

    view.unmount();
    await flush();
  });
});
