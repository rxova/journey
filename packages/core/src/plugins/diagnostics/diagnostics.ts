import { analyzeStructure } from "./diagnostics.helpers";
import type { DiagnosticsApi, DiagnosticsResult } from "./diagnostics.types";
import type { JourneyPlugin } from "../../core/types";

export { analyzeStructure, getGraphDiagnostics } from "./diagnostics.helpers";
export type { DiagnosticsApi, DiagnosticsIssue, DiagnosticsResult } from "./diagnostics.types";

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
