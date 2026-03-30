import { afterEach, describe, expect, it, vi } from "vitest";

describe("devtools entrypoints", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.doUnmock("../src/panel/bootstrap");
  });

  it("invokes bootstrap from the panel main entrypoint", async () => {
    const bootstrapPanel = vi.fn();

    vi.doMock("../src/panel/bootstrap", () => ({
      bootstrapPanel
    }));

    await import("../src/panel/main");

    expect(bootstrapPanel).toHaveBeenCalledTimes(1);
  });

  it("creates the Journey devtools panel on module load", async () => {
    const create = vi.fn();

    vi.stubGlobal("chrome", {
      devtools: {
        panels: {
          create
        }
      }
    });

    await import("../src/devtools");

    expect(create).toHaveBeenCalledWith(
      "Journey",
      "icons/icon16.png",
      "src/panel.html",
      expect.any(Function)
    );
  });
});
