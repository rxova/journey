import React from "react";

import type { JourneyDevtoolsCommand } from "@rxova/journey-devtools-bridge";
import {
  type CommandBuildResult,
  buildClearStepErrorCommand,
  buildCustomSendCommand,
  buildExecutionPathsCommand,
  buildGoToCommand,
  buildGoToPreviousStepCommand
} from "../command-utils";

type CommandField =
  | "customType"
  | "customPayload"
  | "goToStep"
  | "stepErrorId"
  | "previousSteps"
  | "executionMaxDepth"
  | "executionMaxPaths";

type CommandFormState = {
  customType: string;
  customPayload: string;
  goToStep: string;
  stepErrorId: string;
  previousSteps: string;
  executionMaxDepth: string;
  executionMaxPaths: string;
  formError: string | null;
};

type CommandFormAction =
  | {
      type: "set-field";
      field: CommandField;
      value: string;
    }
  | {
      type: "set-error";
      error: string | null;
    };

const INITIAL_FORM_STATE: CommandFormState = {
  customType: "",
  customPayload: "",
  goToStep: "",
  stepErrorId: "",
  previousSteps: "",
  executionMaxDepth: "",
  executionMaxPaths: "",
  formError: null
};

const PRIMARY_COMMANDS = [
  "startJourney",
  "goToNextStep",
  "terminateJourney",
  "completeJourney",
  "resetJourney",
  "goToLastVisitedStep"
] as const;

const commandFormReducer = (
  state: CommandFormState,
  action: CommandFormAction
): CommandFormState => {
  if (action.type === "set-field") {
    return {
      ...state,
      [action.field]: action.value
    };
  }

  return {
    ...state,
    formError: action.error
  };
};

export const CommandControls = ({
  availableCommands,
  onCommand,
  disabled,
  disabledReason
}: {
  availableCommands: readonly JourneyDevtoolsCommand["type"][];
  onCommand: (command: JourneyDevtoolsCommand) => void;
  disabled: boolean;
  disabledReason?: string | null;
}) => {
  const [formState, dispatch] = React.useReducer(commandFormReducer, INITIAL_FORM_STATE);
  const availableCommandSet = new Set(availableCommands);
  const visiblePrimaryCommands = PRIMARY_COMMANDS.filter((type) => availableCommandSet.has(type));

  const updateField = React.useCallback((field: CommandField, value: string) => {
    dispatch({
      type: "set-field",
      field,
      value
    });
  }, []);

  const runCommand = React.useCallback(
    (commandBuilder: CommandBuildResult) => {
      if (!commandBuilder.ok) {
        dispatch({ type: "set-error", error: commandBuilder.error });
        return;
      }

      dispatch({ type: "set-error", error: null });
      onCommand(commandBuilder.command);
    },
    [onCommand]
  );

  return (
    <section className="panel-card">
      <h2>Commands</h2>

      {visiblePrimaryCommands.length > 0 ? (
        <div className="button-grid">
          {visiblePrimaryCommands.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onCommand({ type })}
              disabled={disabled}
            >
              {type}
            </button>
          ))}
        </div>
      ) : null}

      <div className="command-form-grid">
        {availableCommandSet.has("goToStepById") ? (
          <label>
            goToStepById step
            <div className="form-row">
              <input
                value={formState.goToStep}
                onChange={(event) => updateField("goToStep", event.target.value)}
                placeholder="review"
                disabled={disabled}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => runCommand(buildGoToCommand(formState.goToStep))}
              >
                Send goToStepById
              </button>
            </div>
          </label>
        ) : null}

        {availableCommandSet.has("goToPreviousStep") ? (
          <label>
            goToPreviousStep steps (optional)
            <div className="form-row">
              <input
                value={formState.previousSteps}
                onChange={(event) => updateField("previousSteps", event.target.value)}
                placeholder="1"
                disabled={disabled}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => runCommand(buildGoToPreviousStepCommand(formState.previousSteps))}
              >
                Send previous
              </button>
            </div>
          </label>
        ) : null}

        {availableCommandSet.has("send") ? (
          <>
            <label>
              Custom event type
              <input
                value={formState.customType}
                onChange={(event) => updateField("customType", event.target.value)}
                placeholder="retry"
                disabled={disabled}
              />
            </label>
            <label>
              Custom payload JSON
              <textarea
                value={formState.customPayload}
                onChange={(event) => updateField("customPayload", event.target.value)}
                placeholder='{"attempt": 2}'
                disabled={disabled}
              />
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                runCommand(buildCustomSendCommand(formState.customType, formState.customPayload))
              }
            >
              Send custom event
            </button>
          </>
        ) : null}

        {availableCommandSet.has("clearStepError") ? (
          <label>
            clearStepError stepId (optional)
            <div className="form-row">
              <input
                value={formState.stepErrorId}
                onChange={(event) => updateField("stepErrorId", event.target.value)}
                placeholder="details"
                disabled={disabled}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => runCommand(buildClearStepErrorCommand(formState.stepErrorId))}
              >
                Clear error
              </button>
            </div>
          </label>
        ) : null}

        {availableCommandSet.has("getExecutionPaths") ? (
          <label>
            getExecutionPaths (optional limits)
            <div className="form-row">
              <input
                value={formState.executionMaxDepth}
                onChange={(event) => updateField("executionMaxDepth", event.target.value)}
                placeholder="maxDepth"
                disabled={disabled}
              />
              <input
                value={formState.executionMaxPaths}
                onChange={(event) => updateField("executionMaxPaths", event.target.value)}
                placeholder="maxPaths"
                disabled={disabled}
              />
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                runCommand(
                  buildExecutionPathsCommand(
                    formState.executionMaxDepth,
                    formState.executionMaxPaths
                  )
                )
              }
            >
              Query execution paths
            </button>
          </label>
        ) : null}
      </div>

      {availableCommands.length === 0 ? (
        <p className="muted">No remote actions are exposed for this machine.</p>
      ) : null}
      {formState.formError ? <p className="form-error">{formState.formError}</p> : null}
      {disabled && disabledReason ? <p className="muted">{disabledReason}</p> : null}
    </section>
  );
};
