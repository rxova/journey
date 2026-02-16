import { describe, expect, it } from "vitest";

import {
  buildCustomSendCommand,
  buildGoToCommand,
  buildTrimHistoryCommand,
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
  });

  it("builds goTo and trimHistory commands", () => {
    expect(buildGoToCommand(" ")).toEqual({ ok: false, error: "Target step is required." });

    const goTo = buildGoToCommand("review");
    expect(goTo).toEqual({ ok: true, command: { type: "goTo", to: "review" } });

    expect(buildTrimHistoryCommand("abc")).toEqual({
      ok: false,
      error: "History limit must be a number."
    });

    expect(buildTrimHistoryCommand("10")).toEqual({
      ok: true,
      command: { type: "trimHistory", maxHistory: 10 }
    });
  });
});
