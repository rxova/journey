import React from "react";
import { act } from "@testing-library/react";

/** Flushes pending machine effects and queued React work. */
export const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/**
 * A trivial named step component factory for linear journey/graph views. The
 * declared (unused) `id` prop is what makes the inline-id spelling
 * (`<StepA id="a" />`) type-check — components without one use the
 * `<journey.Step id>` wrapper.
 */
export const makeStep =
  (label: string): React.ComponentType<{ id?: string }> =>
  () => <div data-testid={`step-${label}`}>{label}</div>;

/** In-memory localStorage-compatible store for persistence tests. */
export function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    dump: () => data
  };
}
