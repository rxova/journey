import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type {
  JourneyDevtoolsMachineFeatureDescriptor,
  JourneyDevtoolsMachineOperationDescriptor,
  JourneyDevtoolsOperationInvoke,
  JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";

type OperationSection = {
  id: string;
  label: string;
  description?: string | null;
  operations: readonly JourneyDevtoolsMachineOperationDescriptor[];
};

const isMachineCommandsSection = (sectionId: string): boolean =>
  sectionId === "core:machine-commands";
const isNavigationSection = (sectionId: string): boolean => sectionId === "core:navigation";
const isEventsSection = (sectionId: string): boolean => sectionId === "core:events";

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
      "core.goToPreviousStep",
      "core.goToLastVisitedStep"
    ]
  },
  events: {
    label: "Events",
    operationIds: ["core.sendEvent", "core.clearStepError"]
  },
  commands: {
    label: "Commands",
    operationIds: []
  }
};

const groupFeatureSections = (
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

const buildInputValue = (
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

const isLifecycleOperationDisabled = (
  operationId: string,
  snapshotStatus: JourneyDevtoolsSerializableSnapshot["status"]
): boolean => {
  switch (snapshotStatus) {
    case "running":
      return operationId === "core.startJourney";
    case "completed":
    case "terminated":
      return operationId !== "core.resetJourney";
    case "idled":
      return operationId === "core.terminateJourney" || operationId === "core.completeJourney";
    default:
      return false;
  }
};

const hasMissingRequiredFields = (
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

export const CommandControls = ({
  features,
  snapshotStatus,
  onInvoke,
  disabled,
  disabledReason,
  mutationsEnabled
}: {
  features: readonly JourneyDevtoolsMachineFeatureDescriptor[];
  snapshotStatus: JourneyDevtoolsSerializableSnapshot["status"];
  onInvoke: (invocation: JourneyDevtoolsOperationInvoke) => void;
  disabled: boolean;
  disabledReason?: string | null;
  mutationsEnabled: boolean;
}) => {
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});
  const [fieldValues, setFieldValues] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<{ sectionId: string; message: string } | null>(
    null
  );

  const isSectionOpen = React.useCallback(
    (featureId: string) => openSections[featureId] ?? true,
    [openSections]
  );

  const setFieldValue = React.useCallback((key: string, value: string) => {
    setFieldValues((current) => ({ ...current, [key]: value }));
    setFormError((current) => (current ? null : current));
  }, []);

  const submit = React.useCallback(
    (
      operation: JourneyDevtoolsMachineFeatureDescriptor["operations"][number],
      sectionId: string
    ) => {
      const input: Record<string, unknown> = {};

      for (const field of operation.fields) {
        const stateKey = `${operation.id}:${field.key}`;
        const raw =
          field.type === "boolean"
            ? (fieldValues[stateKey] ?? "false")
            : (fieldValues[stateKey] ?? "");
        if (field.required && raw.trim().length === 0 && field.type !== "boolean") {
          setFormError({ sectionId, message: `${field.label} is required.` });
          return;
        }

        const parsed = buildInputValue(raw, field.type);
        if (!parsed.ok) {
          setFormError({ sectionId, message: parsed.error });
          return;
        }

        if (parsed.value !== undefined) {
          input[field.key] = parsed.value;
        }
      }

      setFormError((current) => (current?.sectionId === sectionId ? null : current));
      onInvoke(
        Object.keys(input).length === 0
          ? { operationId: operation.id }
          : { operationId: operation.id, input }
      );
    },
    [fieldValues, onInvoke]
  );

  const renderOperation = React.useCallback(
    (operation: JourneyDevtoolsMachineOperationDescriptor, sectionId: string) => {
      const operationDisabled =
        disabled ||
        (operation.mutates && !mutationsEnabled) ||
        (isMachineCommandsSection(sectionId) &&
          isLifecycleOperationDisabled(operation.id, snapshotStatus)) ||
        hasMissingRequiredFields(operation, fieldValues);
      const buttonLabel = operation.id === "core.resetJourney" ? "restartJourney" : operation.label;
      return (
        <label key={operation.id}>
          {operation.fields.map((field) => {
            const stateKey = `${operation.id}:${field.key}`;

            if (field.type === "boolean") {
              return (
                <select
                  key={stateKey}
                  value={fieldValues[stateKey] ?? "false"}
                  onChange={(event) => setFieldValue(stateKey, event.target.value)}
                  disabled={operationDisabled}
                >
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              );
            }

            return (
              <input
                key={stateKey}
                value={fieldValues[stateKey] ?? ""}
                onChange={(event) => setFieldValue(stateKey, event.target.value)}
                placeholder={field.placeholder ?? field.key}
                disabled={operationDisabled}
              />
            );
          })}
          <button
            type="button"
            disabled={operationDisabled}
            onClick={() => submit(operation, sectionId)}
          >
            {buttonLabel}
          </button>
        </label>
      );
    },
    [disabled, fieldValues, mutationsEnabled, setFieldValue, snapshotStatus, submit]
  );

  const renderNavigationSection = React.useCallback(
    (operations: readonly JourneyDevtoolsMachineOperationDescriptor[]) => {
      const operationsById = new Map(operations.map((operation) => [operation.id, operation]));
      const goToStepById = operationsById.get("core.goToStepById");
      const goToPreviousStep = operationsById.get("core.goToPreviousStep");
      const goToLastVisitedStep = operationsById.get("core.goToLastVisitedStep");
      const goToNextStep = operationsById.get("core.goToNextStep");

      return (
        <div className="navigation-grid">
          {goToStepById ? renderOperation(goToStepById, "core:navigation") : null}
          {goToPreviousStep ? renderOperation(goToPreviousStep, "core:navigation") : null}
          {goToLastVisitedStep ? renderOperation(goToLastVisitedStep, "core:navigation") : null}
          {goToNextStep ? renderOperation(goToNextStep, "core:navigation") : null}
        </div>
      );
    },
    [renderOperation]
  );

  const renderEventsSection = React.useCallback(
    (operations: readonly JourneyDevtoolsMachineOperationDescriptor[]) => {
      const operationsById = new Map(operations.map((operation) => [operation.id, operation]));
      const sendEvent = operationsById.get("core.sendEvent");
      const clearStepError = operationsById.get("core.clearStepError");

      return (
        <div className="events-grid">
          {sendEvent ? renderOperation(sendEvent, "core:events") : null}
          {clearStepError ? renderOperation(clearStepError, "core:events") : null}
        </div>
      );
    },
    [renderOperation]
  );

  return (
    <>
      <section className="panel-card">
        <h2>Operations</h2>
        <p className="muted">
          Status: {snapshotStatus} · Mutations {mutationsEnabled ? "enabled" : "disabled"}
        </p>
      </section>

      {features.flatMap((feature) =>
        groupFeatureSections(feature).map((section) => (
          <section key={section.id} className="panel-card">
            <div className="section-header">
              <h2>{section.label}</h2>
              <button
                type="button"
                className="section-toggle"
                aria-label={
                  isSectionOpen(section.id)
                    ? `Collapse ${section.label}`
                    : `Expand ${section.label}`
                }
                title={
                  isSectionOpen(section.id)
                    ? `Collapse ${section.label}`
                    : `Expand ${section.label}`
                }
                onClick={() =>
                  setOpenSections((current) => ({
                    ...current,
                    [section.id]: !(current[section.id] ?? true)
                  }))
                }
              >
                {isSectionOpen(section.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
            {section.description ? <p className="muted">{section.description}</p> : null}
            {isSectionOpen(section.id) ? (
              isNavigationSection(section.id) ? (
                renderNavigationSection(section.operations)
              ) : isEventsSection(section.id) ? (
                renderEventsSection(section.operations)
              ) : (
                <div
                  className={
                    isMachineCommandsSection(section.id)
                      ? "command-form-grid is-machine-commands"
                      : "command-form-grid"
                  }
                >
                  {section.operations.map((operation) => renderOperation(operation, section.id))}
                </div>
              )
            ) : null}
            {formError?.sectionId === section.id ? (
              <p className="form-error">{formError.message}</p>
            ) : null}
          </section>
        ))
      )}

      {disabled && disabledReason ? <p className="muted">{disabledReason}</p> : null}
    </>
  );
};
