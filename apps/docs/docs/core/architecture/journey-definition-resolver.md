---
title: Journey Definition Resolver
sidebar_label: Definition Resolver
---

Source file: `packages/core/src/journey-machine/resolve-journey-definition.ts`

This file turns authored transition shapes into the one runtime shape the machine actually executes: an ordered
array of transitions.

## How It Works

1. If `journey.transitions` is missing, the resolver returns the journey with an empty transition list.
2. If transitions were authored as an array, the file treats that as a linear journey declaration. It validates
   that every entry is a known step id, checks that the first item matches `journey.initial`, and expands the array
   into implicit `goToNextStep` edges.
3. If transitions were authored as an object graph, the file validates each `from -> event -> edges[]` layer and
   flattens it into ordered transition objects.
4. Every named step branch is resolved first and keeps its step id. The `global` branch is resolved last and rewritten to `from: "*"`, so it behaves as a fallback bucket after step-local transitions for the same event.
5. The original journey object is returned with `transitions` replaced by that normalized array.

The important guarantee is ordering. `send.ts` scans transitions in order, so the resolver preserves author intent
while still giving the runtime one deterministic structure to evaluate.

## Recommended Reading

- Read [Send Pipeline](/docs/core/architecture/send) to see how the ordered transition list is consumed.
- Read [Transitions Syntax](/docs/core/api/transitions-syntax) for the public authoring shapes this file accepts.
- Read [Quickstart](/docs/core/getting-started) if you want to compare the normalized behavior with authored
  examples.
