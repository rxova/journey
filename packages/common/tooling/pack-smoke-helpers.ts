const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

export const assertIncludes = (
  files: readonly string[],
  required: readonly string[],
  context: string
): void => {
  const missing = required.filter((entry) => !files.includes(entry));
  if (missing.length > 0) {
    throw new Error(`[pack-smoke] Missing ${context} entries: ${missing.join(", ")}`);
  }
};

export const getExportEntries = (exportRoot: unknown): string[] => {
  const exportPaths = new Set();
  if (typeof exportRoot === "string") {
    exportPaths.add(exportRoot);
  } else if (isRecord(exportRoot)) {
    for (const value of Object.values(exportRoot)) {
      if (typeof value === "string") {
        exportPaths.add(value);
      } else if (isRecord(value)) {
        for (const nested of Object.values(value)) {
          if (typeof nested === "string") {
            exportPaths.add(nested);
          }
        }
      }
    }
  }

  return Array.from(exportPaths).map((entry) =>
    typeof entry === "string" && entry.startsWith("./")
      ? `package/${entry.slice(2)}`
      : String(entry)
  );
};
