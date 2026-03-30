import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapPanel } from "../src/panel/bootstrap";

const { createRootMock, renderMock } = vi.hoisted(() => ({
  createRootMock: vi.fn(),
  renderMock: vi.fn()
}));

type DevtoolsThemeName = "default" | "dark";

function stubMatchMedia(matches: boolean) {
  const mediaQuery = {
    matches,
    addEventListener: vi.fn(),
    addListener: vi.fn()
  } as unknown as MediaQueryList;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(mediaQuery)
  });

  return mediaQuery;
}

function stubChrome(themeName: DevtoolsThemeName) {
  let themeChangeHandler: ((theme: DevtoolsThemeName) => void) | undefined;

  const chromeMock = {
    devtools: {
      panels: {
        themeName,
        setThemeChangeHandler: vi.fn((callback?: (theme: DevtoolsThemeName) => void) => {
          themeChangeHandler = callback;
        })
      }
    }
  };

  vi.stubGlobal("chrome", chromeMock);

  return {
    chromeMock,
    getThemeChangeHandler: () => themeChangeHandler
  };
}

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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.theme;
    document.body.innerHTML = "";
  });

  it("throws if root element is missing", () => {
    document.body.innerHTML = "";

    expect(() => bootstrapPanel()).toThrow("Panel root element not found.");
  });

  it("mounts the app into the root element", () => {
    document.body.innerHTML = '<div id="root"></div>';
    stubMatchMedia(false);

    bootstrapPanel();

    const rootElement = document.getElementById("root");
    expect(createRootMock).toHaveBeenCalledWith(rootElement);
    expect(renderMock).toHaveBeenCalledTimes(1);
  });

  it("treats the DevTools default theme as light even when the system is dark", () => {
    document.body.innerHTML = '<div id="root"></div>';

    const mediaQuery = stubMatchMedia(true);
    const { chromeMock } = stubChrome("default");

    bootstrapPanel();

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(chromeMock.devtools.panels.setThemeChangeHandler).toHaveBeenCalledTimes(1);
    expect(mediaQuery.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("updates the applied theme when DevTools theme changes", () => {
    document.body.innerHTML = '<div id="root"></div>';

    stubMatchMedia(false);
    const { getThemeChangeHandler } = stubChrome("default");

    bootstrapPanel();

    const themeChangeHandler = getThemeChangeHandler();
    expect(themeChangeHandler).toBeTypeOf("function");

    themeChangeHandler?.("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    themeChangeHandler?.("default");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("falls back to the system theme when DevTools theme APIs are unavailable", () => {
    document.body.innerHTML = '<div id="root"></div>';

    stubMatchMedia(true);

    bootstrapPanel();

    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("uses legacy matchMedia listeners when addEventListener is unavailable", () => {
    document.body.innerHTML = '<div id="root"></div>';

    let changeHandler: (() => void) | undefined;
    const mediaQuery = {
      matches: false,
      addEventListener: undefined,
      addListener: vi.fn((listener: () => void) => {
        changeHandler = listener;
      })
    } as unknown as MediaQueryList;

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(mediaQuery)
    });

    bootstrapPanel();

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(mediaQuery.addListener as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);

    (mediaQuery as { matches: boolean }).matches = true;
    changeHandler?.();

    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
