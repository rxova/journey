export type JourneyPanelStructuredDiff = {
  added: Record<string, unknown>;
  removed: Record<string, unknown>;
  changed: Record<string, { before: unknown; after: unknown }>;
};

export const EMPTY_STRUCTURED_DIFF: JourneyPanelStructuredDiff = {
  added: {},
  removed: {},
  changed: {}
};

const ROOT_PATH = "root";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const buildPath = (basePath: string, key: string | number, isArrayIndex: boolean): string => {
  if (basePath.length === 0) {
    return isArrayIndex ? `[${key}]` : String(key);
  }

  return isArrayIndex ? `${basePath}[${key}]` : `${basePath}.${String(key)}`;
};

export const computeStructuredDiff = (
  previousValue: unknown,
  nextValue: unknown
): JourneyPanelStructuredDiff => {
  const added: Record<string, unknown> = {};
  const removed: Record<string, unknown> = {};
  const changed: Record<string, { before: unknown; after: unknown }> = {};

  const walk = (previous: unknown, next: unknown, path: string) => {
    if (Object.is(previous, next)) {
      return;
    }

    if (Array.isArray(previous) && Array.isArray(next)) {
      const maxLength = Math.max(previous.length, next.length);
      for (let index = 0; index < maxLength; index += 1) {
        const nextPath = buildPath(path, index, true);
        if (index >= previous.length) {
          added[nextPath] = next[index];
          continue;
        }
        if (index >= next.length) {
          removed[nextPath] = previous[index];
          continue;
        }
        walk(previous[index], next[index], nextPath);
      }
      return;
    }

    if (isPlainObject(previous) && isPlainObject(next)) {
      const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
      for (const key of keys) {
        const nextPath = buildPath(path, key, false);
        const previousHasKey = hasOwn(previous, key);
        const nextHasKey = hasOwn(next, key);

        if (!previousHasKey && nextHasKey) {
          added[nextPath] = next[key];
          continue;
        }
        if (previousHasKey && !nextHasKey) {
          removed[nextPath] = previous[key];
          continue;
        }
        walk(previous[key], next[key], nextPath);
      }
      return;
    }

    changed[path || ROOT_PATH] = {
      before: previous,
      after: next
    };
  };

  walk(previousValue, nextValue, "");

  return {
    added,
    removed,
    changed
  };
};
