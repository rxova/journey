import { describe, expect, it } from "vitest";

import {
  buildCustomSendCommand,
  buildExecutionPathsCommand,
  buildGoToCommand,
  buildGoToPreviousStepCommand,
  parseOptionalJsonPayload
} from "../src/panel/command-utils";

describe("command utils", () => {
  it("parses optional JSON payloads", () => {
    expect(parseOptionalJsonPayload("")).toEqual({ ok: true, value: undefined });
    expect(parseOptionalJsonPayload('{"x":1}')).toEqual({ ok: true, value: { x: 1 } });
    expect(parseOptionalJsonPayload("not-json")).toEqual({
      ok: false,
      error: "Payload must be valid JSON."
    });
  });

  it("builds custom event command with validation", () => {
    expect(buildCustomSendCommand("", "{}")).toEqual({
      ok: false,
      error: "Event type is required."
    });

    expect(buildCustomSendCommand("retry", "{")).toEqual({
      ok: false,
      error: "Payload must be valid JSON."
    });

    const built = buildCustomSendCommand("retry", '{"attempt":2}');
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.command).toEqual({
        type: "send",
        event: { type: "retry", payload: { attempt: 2 } }
      });
    }

    const withoutPayload = buildCustomSendCommand("retry", "   ");
    expect(withoutPayload.ok).toBe(true);
    if (withoutPayload.ok) {
      expect(withoutPayload.command).toEqual({
        type: "send",
        event: { type: "retry" }
      });
    }
  });

  it("builds goTo and goToPreviousStep commands", () => {
    expect(buildGoToCommand(" ")).toEqual({ ok: false, error: "Target step is required." });

    const goTo = buildGoToCommand("review");
    expect(goTo).toEqual({ ok: true, command: { type: "goToStepById", stepId: "review" } });

    expect(buildGoToPreviousStepCommand("abc")).toEqual({
      ok: false,
      error: "Step count must be a positive integer."
    });

    expect(buildGoToPreviousStepCommand("10")).toEqual({
      ok: true,
      command: { type: "goToPreviousStep", steps: 10 }
    });
  });

  it("builds getExecutionPaths command with optional limits", () => {
    expect(buildExecutionPathsCommand("", "")).toEqual({
      ok: true,
      command: { type: "getExecutionPaths" }
    });

    expect(buildExecutionPathsCommand("0", "")).toEqual({
      ok: false,
      error: "Max depth must be a positive integer."
    });

    expect(buildExecutionPathsCommand("", "-1")).toEqual({
      ok: false,
      error: "Max paths must be a positive integer."
    });

    expect(buildExecutionPathsCommand("4", "12")).toEqual({
      ok: true,
      command: {
        type: "getExecutionPaths",
        options: { maxDepth: 4, maxPaths: 12 }
      }
    });

    expect(buildExecutionPathsCommand("10000", "10000")).toEqual({
      ok: true,
      command: {
        type: "getExecutionPaths",
        options: { maxDepth: 10000, maxPaths: 10000 }
      }
    });

    expect(buildExecutionPathsCommand("10001", "")).toEqual({
      ok: false,
      error: "Max depth must be at most 10000."
    });

    expect(buildExecutionPathsCommand("", "10001")).toEqual({
      ok: false,
      error: "Max paths must be at most 10000."
    });
  });
});
