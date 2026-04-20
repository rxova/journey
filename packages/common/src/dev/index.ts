import { isRecord } from "../predicates/index";

type DiagnosticGlobal = typeof globalThis & {
  __DEV__?: unknown;
  process?: {
    env?: {
      NODE_ENV?: string;
    };
  };
};

export const isDevelopmentEnvironment = (): boolean => {
  const diagnosticGlobal = globalThis as DiagnosticGlobal;
  if (typeof diagnosticGlobal.__DEV__ === "boolean") {
    return diagnosticGlobal.__DEV__;
  }

  const nodeEnv = diagnosticGlobal.process?.env?.NODE_ENV;
  return nodeEnv === undefined || nodeEnv === "development";
};

export const warnInDevelopment = (message: string, detail?: unknown) => {
  if (!isDevelopmentEnvironment() || typeof console === "undefined") {
    return;
  }

  if (detail === undefined) {
    console.warn(message);
    return;
  }

  console.warn(message, detail);
};

export const errorInDevelopment = (message: string, detail?: unknown) => {
  if (!isDevelopmentEnvironment() || typeof console === "undefined") {
    return;
  }

  if (detail === undefined) {
    console.error(message);
    return;
  }

  console.error(message, detail);
};

export type NonProductionBundlerEnv = {
  DEV?: unknown;
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
