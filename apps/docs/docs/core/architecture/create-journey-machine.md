---
title: createJourneyMachine Assembly
sidebar_label: createJourneyMachine
---

Source file: `packages/core/src/journey-machine/index.ts`

This file is the composition root for the core runtime.

It does not implement guard evaluation, navigation commits, or plugin behavior itself. Its job is to validate the
definition, construct the controllers in the right order, and expose one public machine object.

## How It Works

1. It validates the raw journey shape before any controller exists:
   - `steps` must be a record
   - `transitions` must be an array or object map when provided
   - reserved step ids such as `COMPLETE` and `TERMINATED` are rejected
   - the initial step must exist
2. It resolves the authored definition with `resolveJourneyDefinition(...)` and then validates the resulting
   transition list with `validateJourneyTransitions(...)`.
3. It prepares two pieces of initial runtime state:
   - a private step-metadata record cloned from each step's static `meta`
   - `buildInitialSnapshot()` to create the initial snapshot with history, visited flags, status, and async state
4. It creates the plugin controller first so plugins can hydrate the initial snapshot before the runtime starts.
5. It creates the runtime, then the async-state, navigation, send, and controls controllers, passing each one only
   the dependencies it needs.
6. It assembles the public machine API:
   - snapshot reads and subscriptions come from the runtime
   - transition-driven helpers queue through the runtime
   - non-transition mutations come from controls
   - convenience event subscriptions filter the lifecycle stream
7. It finally lets plugins augment the machine surface with `pluginController.extendMachine(...)`.

## Why The Order Matters

The order is deliberate:

- the resolver must run before anything can evaluate transitions
- plugin hydration must happen before the runtime owns the first snapshot
- the runtime must exist before async, navigation, send, or controls can commit state
- plugin augmentation must happen last so the returned machine is complete

That keeps every controller small and prevents hidden initialization dependencies.

## Recommended Reading

- Read [Journey Definition Resolver](/docs/core/architecture/journey-definition-resolver) for the normalization step
  this file depends on.
- Read [Runtime Queue](/docs/core/architecture/runtime) for the state container this file creates.
- Read [Plugin Lifecycle](/docs/core/architecture/plugin-controller) for hydration and machine augmentation.
- Read [Core API Overview](/docs/core/api) or [Quickstart](/docs/core/getting-started) if you want to switch back
  from internals to public usage.
