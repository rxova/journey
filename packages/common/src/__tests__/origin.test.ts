import { afterEach, describe, expect, it, vi } from "vitest";

import { isExpectedWindowOrigin, resolveWindowTargetOrigin } from "@rxova/journey-common/origin";

describe("resolveWindowTargetOrigin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns the window origin when it is a real origin", () => {
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      origin: "https://example.com"
    });
    expect(resolveWindowTargetOrigin()).toBe("https://example.com");
  });

  it("returns '*' when window.location.origin is 'null' (file:// context)", () => {
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, origin: "null" });
    expect(resolveWindowTargetOrigin()).toBe("*");
  });

  it("returns '*' outside a browser", () => {
    vi.stubGlobal("window", undefined);
    expect(resolveWindowTargetOrigin()).toBe("*");
  });
});

describe("isExpectedWindowOrigin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns true when origin matches window.location.origin", () => {
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      origin: "https://example.com"
    });
    expect(isExpectedWindowOrigin("https://example.com")).toBe(true);
  });

  it("returns false when origin does not match", () => {
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      origin: "https://example.com"
    });
    expect(isExpectedWindowOrigin("https://other.com")).toBe(false);
  });

  it("returns true for 'null' origin when window.location.origin is also 'null'", () => {
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, origin: "null" });
    expect(isExpectedWindowOrigin("null")).toBe(true);
  });

  it("returns false for 'null' origin when window.location.origin is a real origin", () => {
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      origin: "https://example.com"
    });
    expect(isExpectedWindowOrigin("null")).toBe(false);
  });

  it("returns false for empty string origin", () => {
    expect(isExpectedWindowOrigin("")).toBe(false);
  });

  it("rejects origins outside a browser", () => {
    vi.stubGlobal("window", undefined);
    expect(isExpectedWindowOrigin("https://example.com")).toBe(false);
  });
});
