import type { JourneyBuiltInFrom, JourneyMode } from "./journey.types";

/** Structural diagnostic issue codes returned by journey diagnostics. */
export type JourneyDiagnosticsIssueCode =
  | "cycle-detected"
  | "dead-end-step"
  | "no-terminal-path"
  | "shadowed-transition"
  | "unreachable-step";

/** Severity assigned to a diagnostics issue. */
export type JourneyDiagnosticsIssueSeverity = "warning" | "error";

/** Options that affect structural journey diagnostics. */
export type JourneyDiagnosticsOptions = {
  requireExplicitCompletion?: boolean;
};

/** A single diagnostics issue discovered while analyzing a journey definition. */
export type JourneyDiagnosticsIssue<TStepId extends string, TEventType extends string> = {
  code: JourneyDiagnosticsIssueCode;
  severity: JourneyDiagnosticsIssueSeverity;
  message: string;
  stepId?: TStepId;
  from?: TStepId | JourneyBuiltInFrom;
  eventType?: TEventType;
  transitionId?: string;
  label?: string;
  steps?: readonly TStepId[];
};

/** Aggregate diagnostics summary for a journey definition. */
export type JourneyDiagnosticsSummary = {
  mode: JourneyMode;
  stepCount: number;
  reachableStepCount: number;
  unreachableStepCount: number;
  deadEndCount: number;
  cycleCount: number;
  shadowedTransitionCount: number;
  graphChecksSkipped: boolean;
  terminalPathExists: boolean;
};

/** Result returned by `getJourneyDiagnostics()`. */
export type JourneyDiagnosticsResult<TStepId extends string, TEventType extends string> = {
  issues: JourneyDiagnosticsIssue<TStepId, TEventType>[];
  summary: JourneyDiagnosticsSummary;
};
