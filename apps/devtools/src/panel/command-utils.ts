import type { JourneyDevtoolsCommand } from "@rxova/journey-devtools-bridge";

export type CommandBuildResult =
  | {
      ok: true;
      command: JourneyDevtoolsCommand;
    }
  | {
      ok: false;
      error: string;
    };

type JsonParseResult =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
      error: string;
    };

export const parseOptionalJsonPayload = (raw: string): JsonParseResult => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: undefined };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(trimmed) as unknown
    };
  } catch {
    return {
      ok: false,
      error: "Payload must be valid JSON."
    };
  }
};

export const buildCustomSendCommand = (
  eventType: string,
  payloadRaw: string
): CommandBuildResult => {
  const trimmedType = eventType.trim();
  if (trimmedType.length === 0) {
    return {
      ok: false,
      error: "Event type is required."
    };
  }

  const parsed = parseOptionalJsonPayload(payloadRaw);
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    command:
      parsed.value === undefined
        ? { type: "send", event: { type: trimmedType } }
        : { type: "send", event: { type: trimmedType, payload: parsed.value } }
  };
};

export const buildGoToCommand = (targetStep: string): CommandBuildResult => {
  const to = targetStep.trim();
  if (to.length === 0) {
    return {
      ok: false,
      error: "Target step is required."
    };
  }

  return {
    ok: true,
    command: { type: "goTo", to }
  };
};

export const buildClearStepErrorCommand = (stepIdRaw: string): CommandBuildResult => {
  const stepId = stepIdRaw.trim();
  return {
    ok: true,
    command: stepId.length === 0 ? { type: "clearStepError" } : { type: "clearStepError", stepId }
  };
};

export const buildTrimHistoryCommand = (maxHistoryRaw: string): CommandBuildResult => {
  const trimmed = maxHistoryRaw.trim();

  if (trimmed.length === 0) {
    return {
      ok: true,
      command: { type: "trimHistory" }
    };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return {
      ok: false,
      error: "History limit must be a number."
    };
  }

  return {
    ok: true,
    command: { type: "trimHistory", maxHistory: Math.trunc(parsed) }
  };
};
