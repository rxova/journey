import React from "react";

import type { JourneyDevtoolsCommand } from "@rxova/journey-devtools-bridge";
import {
  type CommandBuildResult,
  buildClearStepErrorCommand,
  buildCustomSendCommand,
  buildGoToCommand,
  buildTrimHistoryCommand
} from "../command-utils";

type CommandField = "customType" | "customPayload" | "goToStep" | "stepErrorId" | "trimHistory";

type CommandFormState = {
  customType: string;
  customPayload: string;
  goToStep: string;
  stepErrorId: string;
  trimHistory: string;
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
  trimHistory: "",
  formError: null
};

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

const PRIMARY_COMMANDS = ["next", "back", "close", "submit", "reset", "clearHistory"] as const;

export const CommandControls = ({
  onCommand,
  disabled,
  disabledReason
}: {
  onCommand: (command: JourneyDevtoolsCommand) => void;
  disabled: boolean;
  disabledReason?: string | null;
}) => {
  const [formState, dispatch] = React.useReducer(commandFormReducer, INITIAL_FORM_STATE);

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

      <div className="button-grid">
        {PRIMARY_COMMANDS.map((type) => (
          <button key={type} type="button" onClick={() => onCommand({ type })} disabled={disabled}>
            {type}
          </button>
        ))}
      </div>

      <div className="command-form-grid">
        <label>
          goTo step
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
              Send
            </button>
          </div>
        </label>

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

        <label>
          trimHistory max (optional)
          <div className="form-row">
            <input
              value={formState.trimHistory}
              onChange={(event) => updateField("trimHistory", event.target.value)}
              placeholder="10"
              disabled={disabled}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => runCommand(buildTrimHistoryCommand(formState.trimHistory))}
            >
              Trim history
            </button>
          </div>
        </label>
      </div>

      {formState.formError ? <p className="form-error">{formState.formError}</p> : null}
      {disabled && disabledReason ? <p className="muted">{disabledReason}</p> : null}
    </section>
  );
};
