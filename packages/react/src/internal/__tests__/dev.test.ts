import { afterEach, describe, expect, it, vi } from "vitest";

import { isDevelopmentEnvironment, warnInDevelopment } from "@rxova/journey-react/testing";

type DiagnosticGlobal = typeof globalThis & {
  __DEV__?: boolean;
};

// This package is typed without Node's globals, like the code under test.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
  .process.env;

describe("isDevelopmentEnvironment", () => {
  const originalNodeEnv = env.NODE_ENV;

  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
    delete (globalThis as DiagnosticGlobal).__DEV__;
  });

  it("returns __DEV__ when it is a boolean true", () => {
    (globalThis as DiagnosticGlobal).__DEV__ = true;
    expect(isDevelopmentEnvironment()).toBe(true);
  });

  it("returns __DEV__ when it is a boolean false", () => {
    (globalThis as DiagnosticGlobal).__DEV__ = false;
    expect(isDevelopmentEnvironment()).toBe(false);
  });

  it("returns true when NODE_ENV is 'development'", () => {
    env.NODE_ENV = "development";
    expect(isDevelopmentEnvironment()).toBe(true);
  });

  it("returns false when NODE_ENV is 'production'", () => {
    env.NODE_ENV = "production";
    expect(isDevelopmentEnvironment()).toBe(false);
  });

  it("returns true when NODE_ENV is undefined", () => {
    delete env.NODE_ENV;
    expect(isDevelopmentEnvironment()).toBe(true);
  });

  it("ignores a non-boolean __DEV__ and falls through to NODE_ENV", () => {
    (globalThis as typeof globalThis & { __DEV__?: unknown }).__DEV__ = "true";
    env.NODE_ENV = "production";
    expect(isDevelopmentEnvironment()).toBe(false);
  });

  it("treats NODE_ENV=test as non-development", () => {
    delete (globalThis as DiagnosticGlobal).__DEV__;
    env.NODE_ENV = "test";

    // Deliberate: test runs stay quiet unless a test opts in via __DEV__,
    // which is how the other packages exercise their warning paths.
    expect(isDevelopmentEnvironment()).toBe(false);
  });
});

describe("warnInDevelopment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as DiagnosticGlobal).__DEV__;
  });

  it("calls console.warn in development without detail", () => {
    (globalThis as DiagnosticGlobal).__DEV__ = true;
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnInDevelopment("heads up");
    expect(spy).toHaveBeenCalledWith("heads up");
  });

  it("calls console.warn in development with detail", () => {
    (globalThis as DiagnosticGlobal).__DEV__ = true;
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnInDevelopment("heads up", { extra: true });
    expect(spy).toHaveBeenCalledWith("%s", "heads up", { extra: true });
  });

  it("does not call console.warn in production", () => {
    (globalThis as DiagnosticGlobal).__DEV__ = false;
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnInDevelopment("heads up");
    expect(spy).not.toHaveBeenCalled();
  });

  it("stays silent where there is no console at all", () => {
    (globalThis as DiagnosticGlobal).__DEV__ = true;
    vi.stubGlobal("console", undefined);

    // Some embedded and worker runtimes have no console; a diagnostic helper
    // must not be the thing that crashes them.
    expect(() => warnInDevelopment("heads up", { extra: true })).not.toThrow();
    vi.unstubAllGlobals();
  });
});
