import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { createLinearJourney } from "@rxova/journey-react";
import { flush } from "@rxova/journey-react/testing";

const views = { a: <span>step:a</span>, b: <span>step:b</span> };

const hydrateAndAssertSilence = async (container: HTMLElement, ui: React.ReactElement) => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  let root: ReturnType<typeof hydrateRoot> | undefined;
  await act(async () => {
    root = hydrateRoot(container, ui);
  });
  // A hydration mismatch logs through console.error — assert silence.
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
  return root;
};

const mount = (html: string) => {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
};

describe("hydration", () => {
  it("hydrates without mismatch across separate server and client machines", async () => {
    // The realistic shape: the server process and the browser each construct
    // their own bundle from the same module code. Nothing is shared between
    // them, so the two sides can only agree if both render deterministically.
    const server = createLinearJourney({ context: {}, steps: ["a", "b"] });
    const serverHtml = renderToString(
      <server.Provider views={views}>
        <server.StepRenderer fallback={<span>loading</span>} />
      </server.Provider>
    );
    // The deferred start means the server emits the fallback, not a step.
    expect(serverHtml).toContain("loading");

    const client = createLinearJourney({ context: {}, steps: ["a", "b"] });
    const container = mount(serverHtml);
    const root = await hydrateAndAssertSilence(
      container,
      <client.Provider views={views}>
        <client.StepRenderer fallback={<span>loading</span>} />
      </client.Provider>
    );

    // Once mounted, the client machine starts and takes over.
    await flush();
    expect(container.textContent).toContain("step:a");

    await act(async () => {
      await client.navigate.goToNextStep();
    });
    expect(container.textContent).toContain("step:b");

    await act(async () => root?.unmount());
    container.remove();
  });

  it("hydrates server-rendered step content when both sides opt into the eager start", async () => {
    // With autoStart: true the server emits real step content. That is only
    // safe when the client reaches the same state before hydrating — here, the
    // same already-settled machine, which is what a per-request bundle handed
    // to both renders achieves.
    const journey = createLinearJourney({ context: {}, steps: ["a", "b"] }, { autoStart: true });
    await flush(); // let the eager initial entry settle before snapshotting HTML

    const ui = (
      <journey.Provider views={views}>
        <journey.StepRenderer fallback={<span>loading</span>} />
      </journey.Provider>
    );
    const html = renderToString(ui);
    expect(html).toContain("step:a");

    const container = mount(html);
    const root = await hydrateAndAssertSilence(container, ui);
    expect(container.textContent).toContain("step:a");

    await act(async () => {
      await journey.navigate.goToNextStep();
    });
    expect(container.textContent).toContain("step:b");

    await act(async () => root?.unmount());
    container.remove();
  });

  it("renders a module-scope bundle identically on every server pass", async () => {
    // One bundle at module scope serves every request in the process. Because
    // layout effects never run on the server, nothing a render does can start
    // it, so repeated passes are byte-identical — that is what makes the
    // default safe for SSR.
    const shared = createLinearJourney({ context: {}, steps: ["a", "b"] });
    const ui = (
      <shared.Provider views={views}>
        <shared.StepRenderer fallback={<span>loading</span>} />
      </shared.Provider>
    );

    const first = renderToString(ui);
    const second = renderToString(ui);
    expect(first).toContain("loading");
    expect(second).toBe(first);
  });

  it("still leaks across server passes once the machine is driven server-side", async () => {
    // The deferred start removes the accidental leak, not the deliberate one:
    // a module-scope bundle that server code actually drives carries that state
    // into every later request in the process. Owning a bundle per request is
    // the only fix, which is why creating one server-side warns in development.
    const shared = createLinearJourney({ context: {}, steps: ["a", "b"] });
    const ui = (
      <shared.Provider views={views}>
        <shared.StepRenderer fallback={<span>loading</span>} />
      </shared.Provider>
    );
    expect(renderToString(ui)).toContain("loading");

    await act(async () => {
      shared.machine.controls.start();
    });
    await flush();

    expect(renderToString(ui)).toContain("step:a");
  });
});
