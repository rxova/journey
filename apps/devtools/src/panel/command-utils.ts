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
  const stepId = targetStep.trim();
  if (stepId.length === 0) {
    return {
      ok: false,
      error: "Target step is required."
    };
  }

  return {
    ok: true,
    command: { type: "goToStepById", stepId }
  };
};

export const buildGoToPreviousStepCommand = (stepsRaw: string): CommandBuildResult => {
  const trimmed = stepsRaw.trim();

  if (trimmed.length === 0) {
    return {
      ok: true,
      command: { type: "goToPreviousStep" }
    };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || Math.trunc(parsed) < 1) {
    return {
      ok: false,
      error: "Step count must be a positive integer."
    };
  }

  return {
    ok: true,
    command: { type: "goToPreviousStep", steps: Math.trunc(parsed) }
  };
};

export const buildGoToLastVisitedStepCommand = (): CommandBuildResult => ({
  ok: true,
  command: { type: "goToLastVisitedStep" }
});

const parseOptionalPositiveInteger = (
  raw: string,
  label: string,
  max?: number
):
  | {
      ok: true;
      value: number | undefined;
    }
  | {
      ok: false;
      error: string;
    } => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {
      ok: true,
      value: undefined
    };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || Math.trunc(parsed) < 1) {
    return {
      ok: false,
      error: `${label} must be a positive integer.`
    };
  }

  if (max !== undefined && Math.trunc(parsed) > max) {
    return {
      ok: false,
      error: `${label} must be at most ${max}.`
    };
  }

  return {
    ok: true,
    value: Math.trunc(parsed)
  };
};

export const buildClearStepErrorCommand = (stepIdRaw: string): CommandBuildResult => {
  const stepId = stepIdRaw.trim();
  return {
    ok: true,
    command: stepId.length === 0 ? { type: "clearStepError" } : { type: "clearStepError", stepId }
  };
};

export const buildExecutionPathsCommand = (
  maxDepthRaw: string,
  maxPathsRaw: string
): CommandBuildResult => {
  const parsedMaxDepth = parseOptionalPositiveInteger(maxDepthRaw, "Max depth", 10000);
  if (!parsedMaxDepth.ok) {
    return parsedMaxDepth;
  }

  const parsedMaxPaths = parseOptionalPositiveInteger(maxPathsRaw, "Max paths", 10000);
  if (!parsedMaxPaths.ok) {
    return parsedMaxPaths;
  }

  const options = {
    ...(parsedMaxDepth.value === undefined ? {} : { maxDepth: parsedMaxDepth.value }),
    ...(parsedMaxPaths.value === undefined ? {} : { maxPaths: parsedMaxPaths.value })
  };

  return {
    ok: true,
    command:
      Object.keys(options).length === 0
        ? { type: "getExecutionPaths" }
        : { type: "getExecutionPaths", options }
  };
};
