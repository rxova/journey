import React from "react";
import type {
  JourneyDevtoolsMachineFeatureDescriptor,
  JourneyDevtoolsMachineOperationDescriptor,
  JourneyDevtoolsOperationInvoke,
  JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";
import panelStyles from "./panelPrimitives.module.css";
import styles from "./commands/commandControls.module.css";
import {
  buildInputValue,
  groupFeatureSections,
  hasInvalidFieldValues,
  hasMissingRequiredFields,
  isEventsSection,
  isLifecycleOperationDisabled,
  isMachineCommandsSection,
  isNavigationSection
} from "./commands/commands";
import { OperationForm } from "./commands/OperationForm";
import { OperationSectionCard } from "./commands/OperationSectionCard";

const getOperationFieldOptions = (
  operationId: string,
  currentStepId: string,
  mode: "linear" | "graph" | "headless" | undefined,
  stepIds: readonly string[],
  eventTypes: readonly string[],
  eventTypesBySource: Record<string, readonly string[]> | undefined,
  goToStepTargetsBySource: Record<string, readonly string[]> | undefined
): Partial<Record<string, readonly string[]>> | undefined => {
  switch (operationId) {
    case "core.goToStepById":
      if (mode === "headless") {
        return stepIds.length > 0 ? { stepId: stepIds } : undefined;
      }
      return {
        stepId: [
          ...(goToStepTargetsBySource?.[currentStepId] ?? []),
          ...(goToStepTargetsBySource?.["*"] ?? [])
        ].filter((stepId, index, allStepIds) => allStepIds.indexOf(stepId) === index)
      };
    case "core.forceStepTransition":
      return {
        stepId: stepIds.filter((stepId) => stepId !== currentStepId)
      };
    case "core.clearStepError":
      return stepIds.length > 0 ? { stepId: stepIds } : undefined;
    case "core.sendEvent":
      if (mode === "headless") {
        return eventTypes.length > 0 ? { type: eventTypes } : undefined;
      }
      return {
        type: [
          ...(eventTypesBySource?.[currentStepId] ?? []),
          ...(eventTypesBySource?.["*"] ?? [])
        ].filter((eventType, index, allEventTypes) => allEventTypes.indexOf(eventType) === index)
      };
    default:
      return undefined;
  }
};

const getSelectOnlyFields = (operationId: string): readonly string[] | undefined => {
  switch (operationId) {
    case "core.goToStepById":
    case "core.forceStepTransition":
      return ["stepId"];
    default:
      return undefined;
  }
};

const getOperationClasses = (operationId: string) => {
  if (
    operationId === "core.goToStepById" ||
    operationId === "core.forceStepTransition" ||
    operationId === "core.goToPreviousStep"
  ) {
    return {
      form: styles.navigationInlineForm,
      button: styles.navigationInlineButton
    };
  }
  if (operationId === "core.sendEvent") {
    return { form: styles.eventSendForm, button: styles.eventSendButton };
  }
  if (operationId === "core.clearStepError") {
    return { form: styles.eventClearForm, button: styles.eventClearButton };
  }
  return { form: undefined, button: undefined };
};

const getOperationDisabled = (
  operation: JourneyDevtoolsMachineOperationDescriptor,
  sectionId: string,
  disabled: boolean,
  mutationsEnabled: boolean,
  snapshotStatus: JourneyDevtoolsSerializableSnapshot["status"]
) =>
  disabled ||
  (operation.mutates && !mutationsEnabled) ||
  (isMachineCommandsSection(sectionId) &&
    isLifecycleOperationDisabled(operation.id, snapshotStatus));

const getSubmitDisabled = (
  operation: JourneyDevtoolsMachineOperationDescriptor,
  sectionId: string,
  disabled: boolean,
  mutationsEnabled: boolean,
  snapshotStatus: JourneyDevtoolsSerializableSnapshot["status"],
  fieldValues: Record<string, string>
) =>
  getOperationDisabled(operation, sectionId, disabled, mutationsEnabled, snapshotStatus) ||
  hasMissingRequiredFields(operation, fieldValues) ||
  hasInvalidFieldValues(operation, fieldValues);

const renderSectionOperations = (
  sectionId: string,
  operations: readonly JourneyDevtoolsMachineOperationDescriptor[],
  renderOperation: (operation: JourneyDevtoolsMachineOperationDescriptor) => React.ReactNode
) => {
  if (isNavigationSection(sectionId)) {
    const operationsById = new Map(operations.map((operation) => [operation.id, operation]));

    return (
      <div className={styles.navigationGrid}>
        {[
          "core.goToStepById",
          "core.forceStepTransition",
          "core.goToPreviousStep",
          "core.goToNextStep",
          "core.goToLastVisitedStep"
        ].flatMap((operationId) => {
          const operation = operationsById.get(operationId);
          return operation ? [renderOperation(operation)] : [];
        })}
      </div>
    );
  }

  if (isEventsSection(sectionId)) {
    const operationsById = new Map(operations.map((operation) => [operation.id, operation]));
    const sendEvent = operationsById.get("core.sendEvent");
    const clearStepError = operationsById.get("core.clearStepError");

    return (
      <div className={styles.eventsGrid}>
        {sendEvent ? renderOperation(sendEvent) : null}
        {clearStepError ? renderOperation(clearStepError) : null}
      </div>
    );
  }

  return (
    <div
      className={
        isMachineCommandsSection(sectionId) ? styles.machineCommandsGrid : styles.layoutGrid
      }
    >
      {operations.map(renderOperation)}
    </div>
  );
};

export const CommandControls = ({
  features,
  snapshotStatus,
  currentStepId,
  onInvoke,
  disabled,
  disabledReason,
  mutationsEnabled,
  mode,
  stepIds = [],
  eventTypes = [],
  eventTypesBySource,
  goToStepTargetsBySource
}: {
  features: readonly JourneyDevtoolsMachineFeatureDescriptor[];
  snapshotStatus: JourneyDevtoolsSerializableSnapshot["status"];
  currentStepId: string;
  onInvoke: (invocation: JourneyDevtoolsOperationInvoke) => void;
  disabled: boolean;
  disabledReason?: string | null;
  mutationsEnabled: boolean;
  mode: "linear" | "graph" | "headless" | undefined;
  stepIds: readonly string[] | undefined;
  eventTypes: readonly string[] | undefined;
  eventTypesBySource: Record<string, readonly string[]> | undefined;
  goToStepTargetsBySource: Record<string, readonly string[]> | undefined;
}) => {
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});
  const [fieldValues, setFieldValues] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<{ sectionId: string; message: string } | null>(
    null
  );

  const setFieldValue = React.useCallback((key: string, value: string) => {
    setFieldValues((current) => ({ ...current, [key]: value }));
    setFormError((current) => (current ? null : current));
  }, []);

  const submit = React.useCallback(
    (operation: JourneyDevtoolsMachineOperationDescriptor, sectionId: string) => {
      const input: Record<string, unknown> = {};

      for (const field of operation.fields) {
        const stateKey = `${operation.id}:${field.key}`;
        const raw =
          field.type === "boolean"
            ? (fieldValues[stateKey] ?? "false")
            : (fieldValues[stateKey] ?? "");

        /* v8 ignore start -- OperationForm disables submit before invalid field states reach these guards. */
        if (field.required && raw.trim().length === 0 && field.type !== "boolean") {
          setFormError({ sectionId, message: `${field.label} is required.` });
          return;
        }

        const parsed = buildInputValue(raw, field.type);
        if (!parsed.ok) {
          setFormError({ sectionId, message: parsed.error });
          return;
        }
        /* v8 ignore stop */

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

  return (
    <div className={styles.stack}>
      <section className={panelStyles.card}>
        <h2 className={panelStyles.title}>Operations</h2>
        <p className={`${panelStyles.muted} ${styles.summaryText}`}>
          Status: {snapshotStatus} · Mutations {mutationsEnabled ? "enabled" : "disabled"}
        </p>
      </section>

      {features.flatMap((feature) =>
        groupFeatureSections(feature).map((section) => {
          const isOpen = openSections[section.id] ?? true;
          return (
            <OperationSectionCard
              key={section.id}
              section={section}
              isOpen={isOpen}
              onToggle={() =>
                setOpenSections((current) => ({
                  ...current,
                  [section.id]: !(current[section.id] ?? true)
                }))
              }
            >
              {renderSectionOperations(section.id, section.operations, (operation) => {
                const operationClasses = getOperationClasses(operation.id);
                return (
                  <OperationForm
                    key={operation.id}
                    operation={operation}
                    sectionId={section.id}
                    className={operationClasses.form}
                    buttonClassName={operationClasses.button}
                    fieldsDisabled={getOperationDisabled(
                      operation,
                      section.id,
                      disabled,
                      mutationsEnabled,
                      snapshotStatus
                    )}
                    submitDisabled={getSubmitDisabled(
                      operation,
                      section.id,
                      disabled,
                      mutationsEnabled,
                      snapshotStatus,
                      fieldValues
                    )}
                    fieldValues={fieldValues}
                    fieldOptions={getOperationFieldOptions(
                      operation.id,
                      currentStepId,
                      mode,
                      stepIds,
                      eventTypes,
                      eventTypesBySource,
                      goToStepTargetsBySource
                    )}
                    selectOnlyFields={getSelectOnlyFields(operation.id)}
                    onFieldChange={setFieldValue}
                    onSubmit={submit}
                  />
                );
              })}
              {formError?.sectionId === section.id ? (
                <p className={styles.formError}>{formError.message}</p>
              ) : null}
            </OperationSectionCard>
          );
        })
      )}

      {disabled && disabledReason ? (
        <p className={`${panelStyles.muted} ${styles.disabledReason}`}>{disabledReason}</p>
      ) : null}
    </div>
  );
};
