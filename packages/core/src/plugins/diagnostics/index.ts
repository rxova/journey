import { analyzeStructure } from "./diagnostics";
import { normalizeGraphDefinition } from "../../graph/index";
import type { DiagnosticsResult } from "./diagnostics";
import type { JourneyPlugin, JourneyStructure } from "../../core/types";

export type { DiagnosticsIssue, DiagnosticsResult } from "./diagnostics";

export type DiagnosticsApi = {
  /** Structural diagnostics of the running journey (computed once, cached). */
  getDiagnostics(): DiagnosticsResult;
};

/** Analyzes a graph journey definition without creating a runtime. */
export function getGraphDiagnostics(definition: {
  readonly steps: object;
  readonly transitions: object;
  readonly initial: string;
}): DiagnosticsResult {
  const { stepIds, transitions } = normalizeGraphDefinition(
    definition as Parameters<typeof normalizeGraphDefinition>[0]
  );
  const structure: JourneyStructure = {
    kind: "graph",
    stepIds,
    initial: definition.initial,
    transitions: transitions.map((transition) => ({
      event: transition.event,
      from: transition.from,
      to: transition.to,
      guarded: transition.when !== undefined
    }))
  };
  return analyzeStructure(structure);
}

/** Exposes `getDiagnostics()` on the machine via `machine.plugins.diagnostics`. */
export function createDiagnosticsPlugin(): JourneyPlugin<"diagnostics", DiagnosticsApi, never> {
  return {
    name: "diagnostics",
    setup(host) {
      let cached: DiagnosticsResult | null = null;
      return {
        api: {
          getDiagnostics: () => (cached ??= analyzeStructure(host.structure))
        }
      };
    }
  };
}
