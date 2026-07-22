import React from "react";
import { useSafeLayoutEffect } from "./use-safe-layout-effect";
import type { OwnedJourneyBundle } from "./react.types";

/**
 * Owns a bundle for one component instance: creates it once, keeps it across
 * re-renders, and disposes it when the component really unmounts.
 *
 * Use it instead of a `useState` lazy initializer. React double-invokes those
 * initializers under StrictMode, so `useState(() => createLinearJourney(...))`
 * builds **two** machines per mount — two plugin `setup()` passes, two
 * persistence reads and writes, two armed autosave timers — and silently
 * abandons one without disposing it.
 *
 * ```tsx
 * const signup = useJourney(() =>
 *   createLinearJourney({ context: initialContext, steps: ["email", "review"] })
 * );
 * ```
 *
 * The factory runs exactly once per component instance; later renders ignore it,
 * so it may close over props freely but changing them will not rebuild the
 * bundle — that is deliberate, since the machine is the journey's identity.
 *
 * Disposal is deferred by a macrotask so StrictMode's synchronous
 * unmount/remount cycle cancels it: a real unmount disposes, a simulated one
 * does not. Module-scope bundles are unaffected — they are never disposed, by
 * design.
 */
export const useJourney = <TBundle extends OwnedJourneyBundle>(factory: () => TBundle): TBundle => {
  const bundleRef = React.useRef<TBundle | null>(null);
  const disposeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lazy initialization is the one render-phase ref access React sanctions, and
  // it is the whole point of this hook: it runs at most once, and a discarded
  // render cannot leave an observable half-state because it would simply build
  // the bundle again. Kept as a single assign-and-read expression — splitting
  // the read onto its own line is what `react-hooks/refs` rejects.
  // https://react.dev/reference/react/useRef#avoiding-recreating-the-ref-contents
  const bundle = (bundleRef.current ??= factory());

  useSafeLayoutEffect(() => {
    // A remount landed before the deferred disposal ran — keep the machine.
    if (disposeTimerRef.current !== null) {
      clearTimeout(disposeTimerRef.current);
      disposeTimerRef.current = null;
    }
    return () => {
      disposeTimerRef.current = setTimeout(() => {
        disposeTimerRef.current = null;
        bundleRef.current = null;
        bundle.machine.dispose();
      }, 0);
    };
  }, [bundle]);

  return bundle;
};
