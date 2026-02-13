export const assertIncludes = (files, required, context) => {
  const missing = required.filter((entry) => !files.includes(entry));
  if (missing.length > 0) {
    throw new Error(`[pack-smoke] Missing ${context} entries: ${missing.join(", ")}`);
  }
};

export const getExportEntries = (exportRoot) => {
  const exportPaths = new Set();
  if (typeof exportRoot === "string") {
    exportPaths.add(exportRoot);
  } else if (typeof exportRoot === "object" && exportRoot) {
    for (const value of Object.values(exportRoot)) {
      if (typeof value === "string") {
        exportPaths.add(value);
      } else if (typeof value === "object" && value) {
        for (const nested of Object.values(value)) {
          if (typeof nested === "string") {
            exportPaths.add(nested);
          }
        }
      }
    }
  }

  return Array.from(exportPaths).map((entry) =>
    entry.startsWith("./") ? `package/${entry.slice(2)}` : entry
  );
};
