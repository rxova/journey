import type React from "react";
import { act } from "@testing-library/react";

// The sanctioned bridge to package internals: the development-warning helpers
// get direct unit coverage without becoming public API.
// eslint-disable-next-line no-restricted-imports
export { isDevelopmentEnvironment, warnInDevelopment } from "../internal/dev";

/** Flushes pending machine effects and queued React work. */
export const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/** A trivial named step component factory for linear journey/graph views. */
export const makeStep = (label: string): React.ComponentType => {
  const Step = () => <div data-testid={`step-${label}`}>{label}</div>;
  Step.displayName = `Step(${label})`;
  return Step;
};

/** In-memory localStorage-compatible store for persistence tests. */
export function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    dump: () => data,
  };
}
