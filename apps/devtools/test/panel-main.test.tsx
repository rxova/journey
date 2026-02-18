import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createRootMock, renderMock } = vi.hoisted(() => ({
  createRootMock: vi.fn(),
  renderMock: vi.fn()
}));

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock
}));

describe("panel main entrypoint", () => {
  beforeEach(() => {
    createRootMock.mockReset();
    renderMock.mockReset();
    createRootMock.mockReturnValue({ render: renderMock });
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("throws if root element is missing", async () => {
    document.body.innerHTML = "";

    await expect(import("../src/panel/main")).rejects.toThrow("Panel root element not found.");
  });

  it("mounts the app into the root element", async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await import("../src/panel/main");

    const rootElement = document.getElementById("root");
    expect(createRootMock).toHaveBeenCalledWith(rootElement);
    expect(renderMock).toHaveBeenCalledTimes(1);
  });
});
