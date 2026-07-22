import { describe, expect, it, vi } from "vitest";

import { releaseVerifySteps, runReleaseVerify } from "../release-verify";

describe("runReleaseVerify", () => {
  it("runs every verification step in order", () => {
    const calls: string[] = [];
    const code = runReleaseVerify({
      log: () => {},
      runScript: (script) => {
        calls.push(script);
        return { status: 0 };
      }
    });

    expect(code).toBe(0);
    expect(calls).toEqual(releaseVerifySteps.map((step) => step.script));
  });

  it("stops at the first failing script status", () => {
    const calls: string[] = [];
    const code = runReleaseVerify({
      log: () => {},
      runScript: (script) => {
        calls.push(script);
        return { status: script === "lint" ? 2 : 0 };
      }
    });

    expect(code).toBe(2);
    // Derived rather than hardcoded: the assertion is "everything up to and
    // including the failure ran, and nothing after it did", which should not
    // need editing when a step is added or reordered.
    const scripts = releaseVerifySteps.map((step) => step.script);
    expect(calls).toEqual(scripts.slice(0, scripts.indexOf("lint") + 1));
  });

  it("audits dependencies before doing any expensive work", () => {
    // The publish path runs only this script, so an audit that lives solely in
    // the CI workflow would let a release on main ship what a pull request
    // would have been blocked on.
    expect(releaseVerifySteps[0]?.script).toBe("audit:check");
  });

  it("returns a generic failure when the script cannot be spawned", () => {
    const error = vi.fn();
    const spawnError = new Error("spawn failed");
    const code = runReleaseVerify({
      error,
      log: () => {},
      runScript: () => ({ error: spawnError, status: null })
    });

    expect(code).toBe(1);
    expect(error).toHaveBeenCalledWith(spawnError);
  });
});
