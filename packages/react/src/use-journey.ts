import React from "react";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * Owns a journey runtime for the lifetime of the calling component.
 *
 * The `factory` runs **once** — even under React StrictMode's double-invoke — and
 * the runtime is **disposed automatically when the component unmounts**. This is
 * the safe, low-ceremony way to own a per-instance or request-scoped flow (cards,
 * modals, route boundaries, Next.js `"use client"` components): it never shares
 * state across server requests the way a module-level `createJourney(...)`
 * singleton can, and you don't have to wire `useMemo` + `disposeOnUnmount` by hand.
 *
 * Pass a thunk that builds a runtime (any `create*Journey` / factory result):
 *
 * ```tsx
 * "use client";
 * function CheckoutCard({ customerId }: { customerId: string }) {
 *   const journey = useJourney(() =>
 *     createJourney({ ...definition, context: { ...definition.context, customerId } })
 *   );
 *   return (
 *     <journey.JourneyProvider views={views}>
 *       <journey.StepRenderer />
 *     </journey.JourneyProvider>
 *   );
 * }
 * ```
 *
 * To reset the journey when a prop changes, remount the component with a React
 * `key` (`<CheckoutCard key={customerId} customerId={customerId} />`) — the React
 * way to reset owned state — rather than recreating it on every render.
 */
export const useJourney = <TRuntime extends { dispose: () => void }>(
  factory: () => TRuntime
): TRuntime => {
  const instanceRef = React.useRef<TRuntime | null>(null);
  if (instanceRef.current === null) {
    // Lazy init in render: the ref persists across StrictMode's double render
    // invoke, so the factory runs exactly once and never orphans an instance.
    instanceRef.current = factory();
  }
  const runtime = instanceRef.current;

  const scheduledDisposeRef = React.useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  useSafeLayoutEffect(() => {
    // A StrictMode remount runs this effect again right after the unmount cleanup
    // scheduled disposal — cancel it so the live runtime is preserved. A real
    // unmount has no follow-up effect, so the scheduled disposal runs.
    if (scheduledDisposeRef.current !== null) {
      globalThis.clearTimeout(scheduledDisposeRef.current);
      scheduledDisposeRef.current = null;
    }

    return () => {
      scheduledDisposeRef.current = globalThis.setTimeout(() => {
        scheduledDisposeRef.current = null;
        runtime.dispose();
      }, 0);
    };
  }, [runtime]);

  return runtime;
};
