import React from "react";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * Owns a journey machine (or any disposable runtime) for the lifetime of the
 * calling component.
 *
 * The `factory` runs **once** — even under React StrictMode's double-invoke — and
 * the machine is **disposed automatically when the component unmounts**. This is
 * the safe, low-ceremony way to own a per-instance or request-scoped flow (cards,
 * modals, route boundaries, Next.js `"use client"` components): it never shares
 * state across server requests the way a module-level singleton can, and you
 * don't have to wire `useMemo` + manual disposal by hand.
 *
 * Pass a thunk that builds the machine (any core `create*Journey` result):
 *
 * ```tsx
 * "use client";
 * import { createHeadlessJourney } from "@rxova/journey-core";
 * import { useOwnedJourney, useJourneySelector } from "@rxova/journey-react/headless";
 *
 * function RiskBanner() {
 *   const machine = useOwnedJourney(() =>
 *     createHeadlessJourney({ initial: "watching", context: { score: 0 }, steps: { watching: {}, flagged: {} } })
 *   );
 *   const stepId = useJourneySelector(machine, (snapshot) => snapshot.currentStep?.id);
 *   return phase === "flagged" ? <Banner onAck={() => void machine.goToStepById("watching")} /> : null;
 * }
 * ```
 *
 * To reset the journey when a prop changes, remount the component with a React
 * `key` — the React way to reset owned state — rather than recreating it on
 * every render.
 */
export const useOwnedJourney = <TMachine extends { dispose: () => void }>(
  factory: () => TMachine
): TMachine => {
  const instanceRef = React.useRef<TMachine | null>(null);
  if (instanceRef.current === null) {
    // Lazy init in render: the ref persists across StrictMode's double render
    // invoke, so the factory runs exactly once and never orphans an instance.
    instanceRef.current = factory();
  }
  const machine = instanceRef.current;

  const scheduledDisposeRef = React.useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  useSafeLayoutEffect(() => {
    // A StrictMode remount runs this effect again right after the unmount cleanup
    // scheduled disposal — cancel it so the live machine is preserved. A real
    // unmount has no follow-up effect, so the scheduled disposal runs.
    if (scheduledDisposeRef.current !== null) {
      globalThis.clearTimeout(scheduledDisposeRef.current);
      scheduledDisposeRef.current = null;
    }

    return () => {
      scheduledDisposeRef.current = globalThis.setTimeout(() => {
        scheduledDisposeRef.current = null;
        machine.dispose();
      }, 0);
    };
  }, [machine]);

  return machine;
};
