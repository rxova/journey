import { afterEach, describe, expect, it, vi } from "vitest";

describe("devtools entrypoint", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("registers the Journey panel", async () => {
    const createPanel = vi.fn();

    vi.stubGlobal("chrome", {
      devtools: {
        panels: {
          create: createPanel
        }
      }
    } as unknown as typeof chrome);

    await import("../src/devtools");

    expect(createPanel).toHaveBeenCalledWith(
      "Journey",
      "icons/icon16.png",
      "src/panel.html",
      expect.any(Function)
    );
  });
});
