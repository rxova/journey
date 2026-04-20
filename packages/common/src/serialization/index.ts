import { isRecord } from "../predicates/index";

export type SerializedError = {
  name: string | null;
  message: string;
  stack: string | null;
  cause: unknown;
};

export const cloneForTransport = (value: unknown): unknown => {
  const transportValue =
    typeof structuredClone === "function"
      ? (() => {
          try {
            return structuredClone(value);
          } catch {
            return value;
          }
        })()
      : value;
  const seen = new WeakSet<object>();

  try {
    const serialized = JSON.stringify(transportValue, (_key, currentValue) => {
      if (typeof currentValue === "bigint") {
        return currentValue.toString();
      }
      if (typeof currentValue === "function") {
        return `[Function ${currentValue.name || "anonymous"}]`;
      }
      if (typeof currentValue === "symbol") {
        return currentValue.toString();
      }
      if (typeof currentValue === "object" && currentValue !== null) {
        if (seen.has(currentValue)) {
          return "[Circular]";
        }
        seen.add(currentValue);
      }
      return currentValue;
    });

    return serialized === undefined ? undefined : (JSON.parse(serialized) as unknown);
  } catch {
    return String(value);
  }
};

export const serializeError = (error: unknown): SerializedError => {
  if (error instanceof Error) {
    const cause =
      "cause" in error && (error as { cause?: unknown }).cause !== undefined
        ? (error as { cause?: unknown }).cause
        : null;
    return {
      name: error.name,
      message: error.message,
      stack: typeof error.stack === "string" ? error.stack : null,
      cause: cloneForTransport(cause)
    };
  }

  return {
    name: null,
    message: typeof error === "string" ? error : "Unknown error",
    stack: null,
    cause: cloneForTransport(error)
  };
};

export const serializeTransportError = (error: unknown): SerializedError => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: typeof error.stack === "string" ? error.stack : null,
      cause: null
    };
  }

  if (isRecord(error)) {
    const message = typeof error.message === "string" ? error.message : null;
    const name = typeof error.name === "string" ? error.name : null;
    const stack = typeof error.stack === "string" ? error.stack : null;
    const cause = "cause" in error ? (error.cause ?? null) : null;

    return {
      name,
      message: message ?? "Unknown transport error",
      stack,
      cause
    };
  }

  return {
    name: null,
    message: typeof error === "string" ? error : "Unknown transport error",
    stack: null,
    cause: null
  };
};
