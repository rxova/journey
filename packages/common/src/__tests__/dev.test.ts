import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isDevelopmentEnvironment,
  resolveNonProductionEnvironment,
  warnInDevelopment
} from "@rxova/journey-common/dev";

type DiagnosticGlobal = typeof globalThis & {
  __DEV__?: boolean;
};

describe("isDevelopmentEnvironment", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
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
    process.env.NODE_ENV = "development";
    expect(isDevelopmentEnvironment()).toBe(true);
  });

  it("returns false when NODE_ENV is 'production'", () => {
    process.env.NODE_ENV = "production";
    expect(isDevelopmentEnvironment()).toBe(false);
  });

  it("returns true when NODE_ENV is undefined", () => {
    delete process.env.NODE_ENV;
    expect(isDevelopmentEnvironment()).toBe(true);
  });

  it("ignores a non-boolean __DEV__ and falls through to NODE_ENV", () => {
    (globalThis as typeof globalThis & { __DEV__?: unknown }).__DEV__ = "true";
    process.env.NODE_ENV = "production";
    expect(isDevelopmentEnvironment()).toBe(false);
  });

  it("treats NODE_ENV=test as non-development", () => {
    delete (globalThis as DiagnosticGlobal).__DEV__;
    process.env.NODE_ENV = "test";

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
    expect(spy).toHaveBeenCalledWith("heads up", { extra: true });
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

describe("resolveNonProductionEnvironment", () => {
  it("returns true when bundlerEnv.DEV is true", () => {
    expect(resolveNonProductionEnvironment({ bundlerEnv: { DEV: true } })).toBe(true);
  });

  it("returns false when bundlerEnv.PROD is true", () => {
    expect(resolveNonProductionEnvironment({ bundlerEnv: { PROD: true } })).toBe(false);
  });

  it("falls through to nodeEnv when bundlerEnv has neither flag", () => {
    expect(resolveNonProductionEnvironment({ bundlerEnv: {}, nodeEnv: "production" })).toBe(false);
    expect(resolveNonProductionEnvironment({ bundlerEnv: {}, nodeEnv: "development" })).toBe(true);
  });

  it("returns false when bundlerEnv is null and nodeEnv is production", () => {
    expect(resolveNonProductionEnvironment({ bundlerEnv: null, nodeEnv: "production" })).toBe(
      false
    );
  });

  it("returns false when both bundlerEnv and nodeEnv are absent and no ambient env", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    expect(resolveNonProductionEnvironment({})).toBe(false);
    process.env.NODE_ENV = original;
  });

  it("returns false when bundlerEnv is null and nodeEnv is explicitly undefined", () => {
    expect(resolveNonProductionEnvironment({ bundlerEnv: null, nodeEnv: undefined })).toBe(false);
  });

  it("prefers bundlerEnv.PROD over a development nodeEnv", () => {
    expect(
      resolveNonProductionEnvironment({ bundlerEnv: { PROD: true }, nodeEnv: "development" })
    ).toBe(false);
  });

  it("ignores non-true bundler flags and falls through to nodeEnv", () => {
    expect(
      resolveNonProductionEnvironment({
        bundlerEnv: { DEV: "yes", PROD: 0 },
        nodeEnv: "development"
      })
    ).toBe(true);
  });

  it("returns false where there is no process global to read NODE_ENV from", () => {
    vi.stubGlobal("process", undefined);

    // A browser or worker bundle has no `process`; an environment that never
    // said it was safe must be treated as production.
    expect(resolveNonProductionEnvironment()).toBe(false);
    vi.unstubAllGlobals();
  });

  it("reads the ambient NODE_ENV when no options are given at all", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    expect(resolveNonProductionEnvironment()).toBe(true);
    process.env.NODE_ENV = original;
  });
});
