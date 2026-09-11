import { describe, expect, it } from "vitest";

import { runVerify, steps, type StepResult, type VerifyStep } from "./verify";

/**
 * Importing this module only works because verify guards its `process.exit`
 * behind an entrypoint check — without it, merely importing the gate would run
 * the whole gate and then kill the test process.
 *
 * The runner is injected, so these tests assert the ordering and short-circuit
 * behaviour without shelling out to pnpm or Turbo.
 */

const ok = (): StepResult => ({ status: 0 });

const record = (results: Record<string, number> = {}) => {
  const seen: string[] = [];
  const run = (step: VerifyStep): StepResult => {
    seen.push(step.name);
    return { status: results[step.name] ?? 0 };
  };
  return { seen, run };
};

const silent = { log: () => {}, error: () => {} };

describe("verify gate", () => {
  it("declares at least one step", () => {
    expect(steps.length).toBeGreaterThan(0);
  });

  it("gives every step exactly one of `script` or `turbo`", () => {
    for (const step of steps) {
      const hasScript = step.script !== undefined;
      const hasTurbo = step.turbo !== undefined;
      expect(hasScript !== hasTurbo, `${step.name} must declare script xor turbo`).toBe(true);
      if (hasTurbo) expect(step.turbo?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("gives every step a unique name", () => {
    const names = steps.map((step) => step.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("runs every step, in declared order, and returns 0", () => {
    const { seen, run } = record();

    expect(runVerify({ ...silent, run: run })).toBe(0);
    expect(seen).toEqual(steps.map((step) => step.name));
  });

  it("stops at the first failure and returns its status", () => {
    const failing = steps[1]?.name ?? steps[0]!.name;
    const { seen, run } = record({ [failing]: 3 });

    expect(runVerify({ ...silent, run: run })).toBe(3);
    // Nothing after the failure ran.
    expect(seen[seen.length - 1]).toBe(failing);
    expect(seen).toHaveLength(steps.findIndex((step) => step.name === failing) + 1);
  });

  it("names the failing step on stderr", () => {
    const failing = steps[0]!.name;
    const messages: string[] = [];
    const { run } = record({ [failing]: 1 });

    runVerify({
      log: () => {},
      error: (message: unknown) => messages.push(String(message)),
      run: run
    });

    expect(messages.join("\n")).toContain(failing);
  });

  it("treats a null status as a failure rather than a pass", () => {
    // spawnSync reports status: null when the child is killed by a signal.
    const run = (): StepResult => ({ status: null });

    expect(runVerify({ ...silent, run: run })).not.toBe(0);
  });

  it("audits dependencies before anything expensive", () => {
    // The audit is cheap and the most likely thing to newly fail, so it leads.
    expect(steps[0]?.script).toBe("audit:check");
  });

  it("keeps e2e out of the gate", () => {
    const ids = steps.flatMap((step) => step.turbo ?? [step.script ?? ""]);
    expect(ids.some((id) => id.includes("e2e"))).toBe(false);
  });

  it("passes a trivially empty run", () => {
    expect(runVerify({ ...silent, run: ok })).toBe(0);
  });
});
