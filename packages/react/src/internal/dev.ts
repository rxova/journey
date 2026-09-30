/**
 * Developer diagnostics that must not survive into production.
 *
 * {@link isDevelopmentEnvironment} asks *"should I print a developer
 * warning?"* and is **permissive**: an unset `NODE_ENV` counts as development,
 * because an unconfigured environment is someone's machine and the cost of a
 * stray warning there is far lower than the cost of a silently swallowed one.
 * `NODE_ENV=test` is not development, so test runs stay quiet unless a test
 * opts in through `__DEV__`.
 *
 * Kept here rather than taken from `@rxova/ts-utils`: its `isDevelopment`
 * treats `NODE_ENV=test` as development and reads `process.env.NODE_ENV`
 * literally, which a consumer's bundler rewrites. This reads it through
 * `globalThis`, as the shipped builds always have.
 */

type DiagnosticGlobal = typeof globalThis & {
  __DEV__?: unknown;
  process?: {
    env?: {
      NODE_ENV?: string;
    };
  };
};

/**
 * Reports whether developer-facing diagnostics should be emitted.
 *
 * A boolean `__DEV__` global wins outright — bundlers inline it, and test
 * suites set it to exercise warning paths that `NODE_ENV=test` would otherwise
 * suppress. Otherwise an unset or `"development"` `NODE_ENV` is development,
 * and anything else (including `"test"` and `"production"`) is not.
 *
 * @returns `true` when warnings and errors should reach the console.
 */
export const isDevelopmentEnvironment = (): boolean => {
  const diagnosticGlobal = globalThis as DiagnosticGlobal;
  if (typeof diagnosticGlobal.__DEV__ === "boolean") {
    return diagnosticGlobal.__DEV__;
  }

  const nodeEnv = diagnosticGlobal.process?.env?.NODE_ENV;
  return nodeEnv === undefined || nodeEnv === "development";
};

/**
 * Logs a warning, but only where {@link isDevelopmentEnvironment} holds.
 *
 * The `detail` argument is forwarded as a second console argument rather than
 * interpolated, so objects stay inspectable in devtools instead of collapsing
 * to `[object Object]`. Omitting it logs the message alone, avoiding a trailing
 * `undefined` in the output.
 *
 * @param message - The warning text.
 * @param detail - Optional structured context to log alongside the message.
 */
export const warnInDevelopment = (message: string, detail?: unknown): void => {
  if (!isDevelopmentEnvironment() || typeof console === "undefined") {
    return;
  }

  if (detail === undefined) {
    console.warn(message);
    return;
  }

  // `message` goes through a constant `%s` rather than standing as the format
  // string itself: callers build it by interpolation, so a `%` in an
  // interpolated value would otherwise be read as a directive and consume
  // `detail`.
  console.warn("%s", message, detail);
};
