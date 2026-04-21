import { afterEach, describe, expect, it, vi } from "vitest";

import {
  errorInDevelopment,
  isDevelopmentEnvironment,
  resolveNonProductionEnvironment,
  warnInDevelopment
} from "./dev";

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
});

describe("errorInDevelopment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as DiagnosticGlobal).__DEV__;
  });

  it("calls console.error in development without detail", () => {
    (globalThis as DiagnosticGlobal).__DEV__ = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    errorInDevelopment("bad");
    expect(spy).toHaveBeenCalledWith("bad");
  });

  it("calls console.error in development with detail", () => {
    (globalThis as DiagnosticGlobal).__DEV__ = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    errorInDevelopment("bad", 42);
    expect(spy).toHaveBeenCalledWith("bad", 42);
  });

  it("does not call console.error in production", () => {
    (globalThis as DiagnosticGlobal).__DEV__ = false;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    errorInDevelopment("bad");
    expect(spy).not.toHaveBeenCalled();
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
});
