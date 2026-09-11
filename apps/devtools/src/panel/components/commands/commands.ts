import type {
  JourneyDevtoolsMachineFeatureDescriptor,
  JourneyDevtoolsMachineOperationDescriptor,
  JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";

export type OperationSection = {
  id: string;
  label: string;
  description?: string | null;
  operations: readonly JourneyDevtoolsMachineOperationDescriptor[];
};

export const isMachineCommandsSection = (sectionId: string): boolean =>
  sectionId === "core:machine-commands";

export const isNavigationSection = (sectionId: string): boolean => sectionId === "core:navigation";

export const isEventsSection = (sectionId: string): boolean => sectionId === "core:events";

const CORE_OPERATION_SECTION_ORDER = [
  "machine-commands",
  "navigation",
  "events",
  "commands"
] as const;

const CORE_OPERATION_SECTIONS: Record<
  (typeof CORE_OPERATION_SECTION_ORDER)[number],
  {
    label: string;
    operationIds: readonly string[];
  }
> = {
  "machine-commands": {
    label: "Machine commands",
    operationIds: [
      "core.startJourney",
      "core.resetJourney",
      "core.terminateJourney",
      "core.completeJourney"
    ]
  },
  navigation: {
    label: "Navigation",
    operationIds: [
      "core.goToNextStep",
      "core.goToStepById",
      "core.forceStepTransition",
      "core.goToPreviousStep",
      "core.goToLastVisitedStep"
    ]
  },
  events: {
    label: "Events",
    operationIds: ["core.sendEvent", "core.clearStepError"]
  },
  commands: {
    label: "Context",
    operationIds: ["core.patchContext", "core.updateContext"]
  }
};

export const groupFeatureSections = (
  feature: JourneyDevtoolsMachineFeatureDescriptor
): readonly OperationSection[] => {
  if (feature.id !== "core") {
    return [
      {
        id: feature.id,
        label: feature.label,
        description: feature.description,
        operations: feature.operations
      }
    ];
  }

  const operationsById = new Map(feature.operations.map((operation) => [operation.id, operation]));
  const groupedSections = CORE_OPERATION_SECTION_ORDER.map((sectionId) => ({
    id: `core:${sectionId}`,
    label: CORE_OPERATION_SECTIONS[sectionId].label,
    operations: CORE_OPERATION_SECTIONS[sectionId].operationIds
      .map((operationId) => operationsById.get(operationId))
      .filter((operation): operation is JourneyDevtoolsMachineOperationDescriptor =>
        Boolean(operation)
      )
  })).filter((section) => section.operations.length > 0);

  const groupedOperationIds = new Set(
    groupedSections.flatMap((section) => section.operations.map((operation) => operation.id))
  );
  const ungroupedOperations = feature.operations.filter(
    (operation) => !groupedOperationIds.has(operation.id)
  );

  return ungroupedOperations.length > 0
    ? [
        ...groupedSections,
        {
          id: "core:other",
          label: "Other",
          operations: ungroupedOperations
        }
      ]
    : groupedSections;
};

export const buildInputValue = (
  raw: string,
  type: "text" | "integer" | "boolean" | "json"
): { ok: true; value: unknown } | { ok: false; error: string } => {
  switch (type) {
    case "text":
      return { ok: true, value: raw };
    case "integer": {
      if (raw.trim().length === 0) {
        return { ok: true, value: undefined };
      }

      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || Math.trunc(parsed) !== parsed) {
        return { ok: false, error: "Integer fields must contain a whole number." };
      }

      return { ok: true, value: parsed };
    }
    case "boolean":
      return { ok: true, value: raw === "true" };
    case "json":
      if (raw.trim().length === 0) {
        return { ok: true, value: undefined };
      }

      try {
        return { ok: true, value: JSON.parse(raw) as unknown };
      } catch {
        return { ok: false, error: "JSON fields must contain valid JSON." };
      }
  }
};

export const isLifecycleOperationDisabled = (
  operationId: string,
  snapshotStatus: JourneyDevtoolsSerializableSnapshot["status"]
): boolean => {
  switch (snapshotStatus) {
    case "running":
      return operationId === "core.startJourney";
    case "completed":
    case "terminated":
      return operationId !== "core.resetJourney";
    case "idle":
      return operationId === "core.terminateJourney" || operationId === "core.completeJourney";
    default:
      return false;
  }
};

export const hasMissingRequiredFields = (
  operation: JourneyDevtoolsMachineOperationDescriptor,
  fieldValues: Record<string, string>
): boolean =>
  operation.fields.some((field) => {
    if (!field.required || field.type === "boolean") {
      return false;
    }

    const stateKey = `${operation.id}:${field.key}`;
    return (fieldValues[stateKey] ?? "").trim().length === 0;
  });

export const getFieldValidationError = (
  raw: string,
  type: "text" | "integer" | "boolean" | "json"
): string | null => {
  if (type === "text" || type === "boolean") {
    return null;
  }

  const parsed = buildInputValue(raw, type);
  return parsed.ok ? null : parsed.error;
};

export const hasInvalidFieldValues = (
  operation: JourneyDevtoolsMachineOperationDescriptor,
  fieldValues: Record<string, string>
): boolean =>
  operation.fields.some((field) => {
    if (field.type === "text" || field.type === "boolean") {
      return false;
    }

    const stateKey = `${operation.id}:${field.key}`;
    return getFieldValidationError(fieldValues[stateKey] ?? "", field.type) !== null;
  });
