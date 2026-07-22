---
"@rxova/journey-react": patch
---

The bindings no longer write refs during render. `useSelector`'s cache is rebuilt through
`useMemo` per derivation, and the last committed selection now lives in a ref advanced from an
effect — mirroring React's own `useSyncExternalStoreWithSelector`. The latest-ref assignments
behind `useSubscribeEvent` and `useStepHandler` moved into effects for the same reason.

Previously a render that React started and then discarded could advance the baseline that
`equalityFn` compares against, which with an identity-field equality could pin a stale value.
Selected-reference stability across parent re-renders with inline selectors is unchanged.

This also makes the package compatible with the React Compiler, and lets `react-hooks/refs` be
enforced repo-wide rather than switched off.
