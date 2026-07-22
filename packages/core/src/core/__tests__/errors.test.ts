import { describe, expect, it, vi } from "vitest";
import {
  JourneyError,
  createGraphJourney,
  createGraphJourneyBuilder,
  createLinearJourney,
  isJourneyError
} from "@rxova/journey-core";
import { linearToGraphDefinition } from "@rxova/journey-core/convert";
import { flush, startedLinear } from "@rxova/journey-core/testing";
import type { JourneyErrorCode } from "@rxova/journey-core";

/**
 * Before this taxonomy existed, telling "duplicate plugin name" apart from
 * "unknown step in transition" meant matching on message text — which quietly
 * made every message a compatibility promise. `code` is the stable contract.
 */
function codeOf(run: () => unknown): JourneyErrorCode | "not-a-journey-error" {
  try {
    run();
  } catch (error) {
    return isJourneyError(error) ? error.code : "not-a-journey-error";
  }
  throw new Error("expected the call to throw");
}

describe("creation-time failures carry a code", () => {
  it("empty linear definition", () => {
    expect(codeOf(() => createLinearJourney({ steps: [], context: {} }))).toBe("empty-definition");
  });

  it("empty graph definition", () => {
    expect(
      // With no steps declared the id union is `never`, so the cast is what a
      // JS caller reaching this failure would effectively be doing.
      codeOf(() =>
        createGraphJourney({ steps: {}, initial: "a" as never, context: {}, transitions: {} })
      )
    ).toBe("empty-definition");
  });

  it("duplicate linear step id", () => {
    expect(codeOf(() => createLinearJourney({ steps: ["a", "a"], context: {} }))).toBe(
      "duplicate-step-id"
    );
  });

  it("duplicate builder step id", () => {
    const { createStep, build } = createGraphJourneyBuilder<{
      context: Record<string, never>;
      stepId: "a";
      events: { type: "GO" };
    }>();

    expect(
      codeOf(() => build({ initial: "a", context: {}, steps: [createStep("a"), createStep("a")] }))
    ).toBe("duplicate-step-id");
  });

  it("unknown initial step", () => {
    expect(
      codeOf(() =>
        createGraphJourney({
          steps: { a: {} },
          initial: "zzz" as "a",
          context: {},
          transitions: {}
        })
      )
    ).toBe("unknown-initial-step");
  });

  it("dangling transition", () => {
    expect(
      codeOf(() =>
        createGraphJourney({
          steps: { a: {} },
          initial: "a",
          context: {},
          transitions: { GO: { from: "a", to: "nope" as "a" } }
        })
      )
    ).toBe("dangling-transition");
  });

  it("unknown startAt", () => {
    expect(
      codeOf(() => createLinearJourney({ steps: ["a"], context: {} }, { startAt: "zzz" as "a" }))
    ).toBe("unknown-step");
  });

  it("duplicate plugin name", () => {
    const plugin = { name: "dup", setup: () => ({ api: {} }) };

    expect(
      codeOf(() =>
        createLinearJourney({ steps: ["a"], context: {} }, { plugins: [plugin, plugin] })
      )
    ).toBe("duplicate-plugin-name");
  });

  it("unavailable persistence storage", () => {
    vi.stubGlobal("localStorage", undefined);
    try {
      expect(
        codeOf(() => createLinearJourney({ steps: ["a"], context: {} }, { persist: { key: "k" } }))
      ).toBe("storage-unavailable");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("storage whose access is blocked reports the same code, keeping the cause", () => {
    const blocked = new Error("SecurityError");
    vi.stubGlobal("localStorage", undefined);
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw blocked;
      }
    });

    try {
      createLinearJourney({ steps: ["a"], context: {} }, { persist: { key: "k" } });
      throw new Error("expected a throw");
    } catch (error) {
      expect(isJourneyError(error)).toBe(true);
      expect((error as JourneyError).code).toBe("storage-unavailable");
      expect((error as { cause?: unknown }).cause).toBe(blocked);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("empty definition through the converter", () => {
    expect(codeOf(() => linearToGraphDefinition({ steps: [], context: {} }))).toBe(
      "empty-definition"
    );
  });
});

describe("runtime failures carry a code", () => {
  it("registering an interceptor for an unknown step", async () => {
    const machine = await startedLinear();

    expect(
      codeOf(() =>
        machine.navigate.registerNextStepInterceptor("zzz" as "a", { run: () => undefined })
      )
    ).toBe("unknown-step");
  });

  it("navigation work whose commit returns a promise", async () => {
    const machine = await startedLinear();

    const result = await machine.navigate.goToNextStep({
      run: () => undefined,
      commit: (() => Promise.resolve()) as unknown as () => void
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(isJourneyError(result.error)).toBe(true);
      expect((result.error as JourneyError).code).toBe("async-commit");
    }
  });
});

describe("structured fields name the offender", () => {
  it("carries the step id for a duplicate", () => {
    try {
      createLinearJourney({ steps: ["a", "b", "b"], context: {} });
      throw new Error("expected a throw");
    } catch (error) {
      expect(isJourneyError(error)).toBe(true);
      expect((error as JourneyError).stepId).toBe("b");
    }
  });

  it("carries the event and step for a dangling transition", () => {
    try {
      createGraphJourney({
        steps: { a: {} },
        initial: "a",
        context: {},
        transitions: { SUBMIT: { from: "a", to: "missing" as "a" } }
      });
      throw new Error("expected a throw");
    } catch (error) {
      const journeyError = error as JourneyError;
      expect(journeyError.event).toBe("SUBMIT");
      expect(journeyError.stepId).toBe("missing");
    }
  });

  it("carries the plugin name for a duplicate", () => {
    const plugin = { name: "analytics", setup: () => ({ api: {} }) };

    try {
      createLinearJourney({ steps: ["a"], context: {} }, { plugins: [plugin, plugin] });
      throw new Error("expected a throw");
    } catch (error) {
      expect((error as JourneyError).pluginName).toBe("analytics");
    }
  });
});

describe("JourneyError shape", () => {
  it("is an Error, named, and keeps the journey: message prefix", () => {
    const error = new JourneyError("unknown-step", 'startAt references unknown step "x"', {
      stepId: "x"
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("JourneyError");
    expect(error.message).toBe('journey: startAt references unknown step "x"');
    expect(isJourneyError(error)).toBe(true);
  });

  it("does not claim unrelated errors", () => {
    expect(isJourneyError(new Error("nope"))).toBe(false);
    expect(isJourneyError("nope")).toBe(false);
    expect(isJourneyError(null)).toBe(false);
  });

  it("leaves caller-thrown work errors alone", async () => {
    const machine = await startedLinear();
    const failure = new Error("network down");

    const result = await machine.navigate.goToNextStep({
      run: () => {
        throw failure;
      }
    });

    await flush();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // NavigationResult.error carries whatever the caller's work threw; core
      // does not wrap it.
      expect(result.error).toBe(failure);
      expect(isJourneyError(result.error)).toBe(false);
    }
  });
});
