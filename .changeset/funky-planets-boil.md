---
"@rxova/journey-devtools-bridge": patch
"@rxova/journey-react": patch
"@rxova/journey-core": patch
---

Per-package patch notes:

- `@rxova/journey-devtools-bridge`
  - Guarded bridge transport posting with a safe `try/catch` so `window.postMessage` failures are swallowed.
  - Prevents bridge lifecycle/command flows from throwing when browser messaging is unavailable or rejects.

- `@rxova/journey-react`
  - Memoized provider context value in `Provider` to keep stable references when `machine`/`journey` inputs are unchanged.
  - Reduces unnecessary rerenders for memoized consumers during unrelated parent rerenders and StrictMode churn.

- `@rxova/journey-core`
  - Added listener-churn edge coverage to verify snapshot/event subscriptions are fully removed after unsubscribe.
  - Hardens regression protection around subscription retention behavior.
