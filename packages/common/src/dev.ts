/**
 * Environment detection for diagnostics that must not survive into production.
 *
 * Two resolvers live here and they answer deliberately different questions.
 * They are not interchangeable, and the difference is the point:
 *
 * - {@link isDevelopmentEnvironment} asks *"should I print a developer
 *   warning?"* and is **permissive** — an unset `NODE_ENV` counts as
 *   development, because an unconfigured environment is someone's machine and
 *   the cost of a stray warning there is far lower than the cost of a silently
 *   swallowed one.
 * - {@link resolveNonProductionEnvironment} asks *"should I switch on a feature
 *   that has a runtime cost?"* and is **conservative** — an unset environment
 *   counts as production, because auto-enabling a devtools bridge in an
 *   unconfigured deployment leaks internal state to anything listening.
 *
 * Permissive for output, conservative for behaviour. Changing either default to
 * match the other would break one of those two properties.
 */

import { isRecord } from "./predicates";

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

  console.warn(message, detail);
};

/**
 * The subset of a bundler's `import.meta.env` this module reads.
 *
 * Callers pass `import.meta.env` in rather than this module reading it,
 * because `import.meta` is a syntax error in a CommonJS build — keeping it at
 * the call site lets the bundler that understands it do the substitution.
 */
export type NonProductionBundlerEnv = {
  /** Vite-style development flag. */
  DEV?: unknown;
  /** Vite-style production flag. Takes precedence over {@link NonProductionBundlerEnv.DEV}. */
  PROD?: unknown;
};

type ProcessLike = { env?: { NODE_ENV?: string } };

const resolveImportMetaEnvironment = (
  bundlerEnv: NonProductionBundlerEnv | null | undefined
): boolean | null => {
  if (!isRecord(bundlerEnv)) {
    return null;
  }
  if (bundlerEnv.PROD === true) {
    return false;
  }
  if (bundlerEnv.DEV === true) {
    return true;
  }
  return null;
};

const resolveNodeEnvironment = (nodeEnv: string | undefined): boolean | null => {
  if (typeof nodeEnv !== "string") {
    return null;
  }
  return nodeEnv !== "production";
};

const readAmbientNodeEnv = (): string | undefined => {
  const processLike = (globalThis as typeof globalThis & { process?: ProcessLike }).process;
  return processLike?.env?.NODE_ENV;
};

/**
 * Decides whether the current environment is something other than production,
 * for features that should not switch themselves on in a shipped app.
 *
 * Sources are consulted in order — bundler flags, then `NODE_ENV` — and the
 * first that gives a definite answer wins. When none does, the answer is
 * `false`: an environment that never said it was safe is treated as production.
 *
 * Passing `nodeEnv` explicitly, *including as `undefined`*, opts out of reading
 * the ambient `process.env.NODE_ENV`. That lets a caller say "I have looked and
 * there is no value" and get the conservative answer, rather than having this
 * function reach for a global the caller deliberately ignored.
 *
 * @param options - Environment sources. Omit entirely to read ambient `NODE_ENV`.
 * @param options.bundlerEnv - A bundler's `import.meta.env`, if available.
 * @param options.nodeEnv - An explicit `NODE_ENV`; presence of the key disables the ambient read.
 * @returns `true` only when a source positively indicates a non-production environment.
 */
export const resolveNonProductionEnvironment = (
  options: {
    bundlerEnv?: NonProductionBundlerEnv | null | undefined;
    nodeEnv?: string | undefined;
  } = {}
): boolean => {
  const resolvedNodeEnv = "nodeEnv" in options ? options.nodeEnv : readAmbientNodeEnv();

  return (
    resolveImportMetaEnvironment(options.bundlerEnv ?? null) ??
    resolveNodeEnvironment(resolvedNodeEnv) ??
    false
  );
};
