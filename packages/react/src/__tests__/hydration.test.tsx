import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { createLinearJourney } from "@rxova/journey-react";
import { flush } from "@rxova/journey-react/testing";

describe("hydration", () => {
  it("hydrates server-rendered HTML without mismatch against the same machine", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["a", "b"] });
    await flush(); // let the factory's initial entry settle before snapshotting HTML

    const ui = (
      <journey.Provider views={{ a: <span>step:a</span>, b: <span>step:b</span> }}>
        <journey.StepRenderer fallback={<span>loading</span>} />
      </journey.Provider>
    );
    const html = renderToString(ui);
    expect(html).toContain("step:a");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, ui);
    });
    expect(container.textContent).toContain("step:a");
    // A hydration mismatch logs through console.error — assert silence.
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();

    await act(async () => {
      await journey.navigate.goToNextStep();
    });
    expect(container.textContent).toContain("step:b");

    await act(async () => root?.unmount());
    container.remove();
  });
});
