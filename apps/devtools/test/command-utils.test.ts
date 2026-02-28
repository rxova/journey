import { describe, expect, it } from "vitest";

import {
  buildCustomSendCommand,
  buildGoToCommand,
  buildGoToPreviousStepCommand,
  buildUpdateStepMetadataCommand,
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

  it("builds updateStepMetadata command with validation", () => {
    expect(buildUpdateStepMetadataCommand(" ", "{}")).toEqual({
      ok: false,
      error: "Step id is required."
    });

    expect(buildUpdateStepMetadataCommand("details", " ")).toEqual({
      ok: false,
      error: "Metadata JSON is required."
    });

    expect(buildUpdateStepMetadataCommand("details", "{")).toEqual({
      ok: false,
      error: "Metadata must be valid JSON."
    });

    expect(buildUpdateStepMetadataCommand("details", '{"title":"Details updated"}')).toEqual({
      ok: true,
      command: {
        type: "updateStepMetadata",
        stepId: "details",
        metadata: { title: "Details updated" }
      }
    });
  });
});
