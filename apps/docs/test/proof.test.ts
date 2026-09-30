import { describe, expect, it } from "vitest";
import { PACKAGES, resolveSize, sizeBudgets, type SizeLimitCheck } from "../src/lib/proof";

const [core] = PACKAGES;

describe("proof: package sizes", () => {
  it.each(PACKAGES.map((pkg) => [pkg.check, pkg] as const))(
    "%s names a size-limit entry in its package",
    (_check, pkg) => {
      const names = (sizeBudgets(pkg.dir) ?? []).map((entry) => entry.name);
      expect(names).toContain(pkg.check);
    }
  );

  it("renders every package's budget when nothing is measured", () => {
    for (const pkg of PACKAGES) {
      const size = resolveSize(pkg, sizeBudgets(pkg.dir), null);
      expect(size.measured).toBe(false);
      expect(size.value).toMatch(/^≤ \d+(\.\d+)? k?B$/);
      expect(size.value).not.toContain("?");
    }
  });

  it("renders the measured size when size-limit reports the check", () => {
    const checks = new Map<string, SizeLimitCheck>([
      [core.check, { name: core.check, size: 6123 }]
    ]);
    const size = resolveSize(core, [{ name: core.check, limit: "6.2 kB" }], checks);
    expect(size).toMatchObject({ measured: true, value: "6.12 kB", budget: "6.2 kB" });
  });

  it("throws when the check has no size-limit budget", () => {
    expect(() =>
      resolveSize(core, [{ name: "core/createJourneyMachine", limit: "7 kB" }], null)
    ).toThrow(/no size-limit entry named "core\/createLinearJourney".*core\/createJourneyMachine/);
    expect(() => resolveSize(core, undefined, null)).toThrow(/entries: none/);
  });

  it("throws when size-limit ran but did not report the check", () => {
    expect(() =>
      resolveSize(core, [{ name: core.check, limit: "6.2 kB" }], new Map<string, SizeLimitCheck>())
    ).toThrow(/no size-limit entry named/);
  });
});
