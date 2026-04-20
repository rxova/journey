import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { JourneyDevtoolsCommand } from "@rxova/journey-devtools-bridge";
import type { JourneyDevtoolsSerializableSnapshot } from "@rxova/journey-devtools-bridge";
import {
  type CommandBuildResult,
  buildClearStepErrorCommand,
  buildCustomSendCommand,
  buildGoToCommand,
  buildGoToPreviousStepCommand
} from "../command-utils";

type CommandField = "customType" | "customPayload" | "goToStep" | "stepErrorId" | "previousSteps";

type CommandFormState = {
  customType: string;
  customPayload: string;
  goToStep: string;
  stepErrorId: string;
  previousSteps: string;
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
  formError: null
};

const MACHINE_COMMANDS = [
  "startJourney",
  "terminateJourney",
  "completeJourney",
  "resetJourney"
] as const;

const NAVIGATION_COMMANDS = ["goToNextStep", "goToLastVisitedStep"] as const;

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
  snapshotStatus,
  onCommand,
  disabled,
  disabledReason
}: {
  availableCommands: readonly JourneyDevtoolsCommand["type"][];
  snapshotStatus: JourneyDevtoolsSerializableSnapshot["status"];
  onCommand: (command: JourneyDevtoolsCommand) => void;
  disabled: boolean;
  disabledReason?: string | null;
}) => {
  const [formState, dispatch] = React.useReducer(commandFormReducer, INITIAL_FORM_STATE);
  const [machineCommandsOpen, setMachineCommandsOpen] = React.useState(true);
  const [navigationCommandsOpen, setNavigationCommandsOpen] = React.useState(true);
  const [eventsOpen, setEventsOpen] = React.useState(true);
  const effectiveAvailableCommands = React.useMemo(() => {
    if (snapshotStatus === "running") {
      return availableCommands.filter((command) => command !== "startJourney");
    }

    if (snapshotStatus === "terminated" || snapshotStatus === "completed") {
      return availableCommands.filter((command) => command === "resetJourney");
    }

    return availableCommands;
  }, [availableCommands, snapshotStatus]);
  const availableCommandSet = new Set(effectiveAvailableCommands);
  const hasMachineCommandsSection = MACHINE_COMMANDS.some((type) =>
    availableCommands.includes(type)
  );
  const visibleNavigationCommands = NAVIGATION_COMMANDS.filter((type) =>
    availableCommandSet.has(type)
  );
  const hasEventsSection =
    availableCommandSet.has("send") || availableCommandSet.has("clearStepError");

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
    <>
      {hasMachineCommandsSection ? (
        <section className="panel-card">
          <div className={machineCommandsOpen ? "section-header with-content" : "section-header"}>
            <h2>Machine Commands</h2>
            <button
              type="button"
              className="section-toggle"
              aria-label={
                machineCommandsOpen ? "Collapse Machine Commands" : "Expand Machine Commands"
              }
              title={machineCommandsOpen ? "Collapse Machine Commands" : "Expand Machine Commands"}
              onClick={() => setMachineCommandsOpen((open) => !open)}
            >
              {machineCommandsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
          {machineCommandsOpen ? (
            <div className="button-grid">
              {MACHINE_COMMANDS.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onCommand({ type })}
                  disabled={disabled || !availableCommandSet.has(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {visibleNavigationCommands.length > 0 ? (
        <section className="panel-card">
          <div
            className={navigationCommandsOpen ? "section-header with-content" : "section-header"}
          >
            <h2>Navigation Commands</h2>
            <button
              type="button"
              className="section-toggle"
              aria-label={
                navigationCommandsOpen
                  ? "Collapse Navigation Commands"
                  : "Expand Navigation Commands"
              }
              title={
                navigationCommandsOpen
                  ? "Collapse Navigation Commands"
                  : "Expand Navigation Commands"
              }
              onClick={() => setNavigationCommandsOpen((open) => !open)}
            >
              {navigationCommandsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
          {navigationCommandsOpen ? (
            <>
              <div className="button-grid">
                {visibleNavigationCommands.map((type) => (
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

              {(availableCommandSet.has("goToStepById") ||
                availableCommandSet.has("goToPreviousStep")) && (
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
                          onClick={() =>
                            runCommand(buildGoToPreviousStepCommand(formState.previousSteps))
                          }
                        >
                          Send previous
                        </button>
                      </div>
                    </label>
                  ) : null}
                </div>
              )}
            </>
          ) : null}
        </section>
      ) : null}

      {hasEventsSection && (
        <section className="panel-card">
          <div className={eventsOpen ? "section-header with-content" : "section-header"}>
            <h2>Events</h2>
            <button
              type="button"
              className="section-toggle"
              aria-label={eventsOpen ? "Collapse Events" : "Expand Events"}
              title={eventsOpen ? "Collapse Events" : "Expand Events"}
              onClick={() => setEventsOpen((open) => !open)}
            >
              {eventsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
          {eventsOpen ? (
            <div className="command-form-grid">
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
                      runCommand(
                        buildCustomSendCommand(formState.customType, formState.customPayload)
                      )
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
            </div>
          ) : null}
        </section>
      )}

      {effectiveAvailableCommands.length === 0 ? (
        <section className="panel-card">
          <p className="muted">No remote actions are exposed for this machine.</p>
        </section>
      ) : null}
      {formState.formError ? (
        <section className="panel-card">
          <p className="form-error">{formState.formError}</p>
        </section>
      ) : null}
      {disabled && disabledReason ? (
        <section className="panel-card">
          <p className="muted">{disabledReason}</p>
        </section>
      ) : null}
    </>
  );
};
