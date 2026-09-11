import type { JourneyStructure } from "../../core/types";

export type DiagnosticsIssue = {
  readonly code: "unreachable-step" | "shadowed-transition" | "cycle-detected" | "no-terminal-path";
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly stepId?: string;
  readonly from?: string;
  readonly event?: string;
  readonly steps?: readonly string[];
};

export type DiagnosticsResult = {
  readonly issues: readonly DiagnosticsIssue[];
  readonly summary: {
    readonly kind: JourneyStructure["kind"];
    readonly stepCount: number;
    readonly reachableStepCount: number;
    readonly unreachableStepCount: number;
    /** Steps with no defined outgoing transitions (legal rest points). */
    readonly terminalStepIds: readonly string[];
    readonly cycleCount: number;
    readonly shadowedTransitionCount: number;
    readonly terminalPathExists: boolean;
    /** True when the journey has no transition graph to analyze (linear). */
    readonly graphChecksSkipped: boolean;
  };
};

export type DiagnosticsApi = {
  /** Structural diagnostics of the running journey (computed once, cached). */
  getDiagnostics(): DiagnosticsResult;
};
