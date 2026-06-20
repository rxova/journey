---
title: Pre-1.0 migration
sidebar_label: Pre-1.0 migration
---

# Pre-1.0 migration

If you're upgrading from older 0.x material — early examples, internal notes, a previous runtime
model — this page covers the contract changes that matter before the final `1.0.0`.

## The current runtime model

Today's runtime is built around:

- JSON-only runtime `context`;
- static step `meta`;
- transition-scoped `updateContext(...)`;
- async `when(...)` guards;
- definition-scoped `handlers`;
- step and transition lifecycle callbacks.

If an older example mentions mutable runtime metadata or duplicate context-write APIs, prefer the
model above.

## Contract changes to know

### Context must be JSON-serializable

Allowed in runtime `context`: `string`, `number`, `boolean`, `null`, arrays of JSON values, and plain
objects of JSON values.

Rejected: `Date`, `Map`, `Set`, functions, class instances, `symbol`, `bigint`, `undefined`, and
circular references.

Step `meta` can still carry richer, definition-only values — that's separate from runtime `context`.

### Step `meta` is definition data

Treat `meta` as authored configuration: labels, icons, static UI metadata, definition-level
annotations. It isn't mutable runtime state — that belongs in `context`.

### React runtime ownership is explicit

`createJourney(...)` creates one machine immediately and binds the returned hooks and components to
that instance. Use `createJourneyFactory(...)` when you need request-scoped isolation, route-boundary
isolation, or one runtime per mounted card or widget.

## RC guidance

The `1.0.0-rc` line freezes the public contract for this runtime model. Expect new RCs to be mostly
bug fixes; treat any RC-breaking change as a release blocker; and expect migration guidance with every
public contract change.

## Upgrade steps

1. Move non-JSON runtime data out of `context`.
2. Move mutable step-state usage into `context`.
3. Audit React integration points and switch to `createJourneyFactory(...)` where isolation matters.
4. Re-read the [Stability contract](/docs/core/stability) before adopting the RC line in production.
