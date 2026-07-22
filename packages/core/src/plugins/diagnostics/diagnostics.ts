import { analyzeStructure } from "./diagnostics.helpers.js";
import type { DiagnosticsApi, DiagnosticsResult } from "./diagnostics.types.js";
import type { JourneyPlugin } from "../../core/types.js";

export { analyzeStructure, getGraphDiagnostics } from "./diagnostics.helpers.js";
export type { DiagnosticsApi, DiagnosticsIssue, DiagnosticsResult } from "./diagnostics.types.js";

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
