---
title: "Pre-1.0 Migration"
---

This page summarizes the contract changes that matter before the final `1.0.0` release.

Use it when upgrading from older 0.x material, early examples, or internal notes that describe an earlier runtime model.

## Current Runtime Model

The current runtime is built around:

- JSON-only runtime `context`
- static step `meta`
- transition-scoped `updateContext(...)`
- async `when(...)` guards
- definition-scoped `handlers`
- step and transition lifecycle callbacks

If you are reading older examples that mention mutable runtime metadata or duplicate context-write APIs, prefer the current model above.

## Contract-Level Changes To Know

### Runtime context must be JSON-serializable

Allowed runtime context values:

- `string`
- `number`
- `boolean`
- `null`
- arrays of JSON values
- plain objects of JSON values

Rejected runtime context values include:

- `Date`
- `Map`
- `Set`
- functions
- class instances
- `symbol`
- `bigint`
- `undefined`
- circular references

Step `meta` can still carry richer definition-only values. That is separate from runtime `context`.

### Step `meta` is definition data

Treat `meta` as authored configuration:

- labels
- icons
- static UI metadata
- definition-level annotations

Do not use it as mutable runtime state. Runtime state belongs in `context`.

### React runtime ownership is explicit

`createJourney(...)` creates one machine immediately and binds the returned hooks/components to that exact instance.

Use `createJourneyFactory(...)` when you need:

- request-scoped isolation
- route-boundary isolation
- one runtime per mounted card or widget

## RC Guidance

The `1.0.0-rc` line is intended to freeze the public contract for this runtime model.

Expectations:

- new RCs should mainly contain bug fixes
- any RC-breaking change should be treated as a release blocker
- every public contract change should include migration guidance

## Recommended Upgrade Steps

1. Move non-JSON runtime data out of `context`.
2. Move mutable step-state usage into `context`.
3. Audit React integration points and switch to `createJourneyFactory(...)` where runtime isolation matters.
4. Re-read the [Stability Contract](./stability.md) before adopting the `1.0.0-rc` line in production.
