---
id: overview
title: React Overview
sidebar_label: Overview
---

`@rxova/journey-react` is bindings-first.

## Entry Point

```ts
import { createJourneyBindings } from "@rxova/journey-react";
```

## Bindings API

```ts
const bindings = createJourneyBindings(journey);

bindings.Provider;
bindings.useJourneyApi();
bindings.useJourneySnapshot();
bindings.useJourneyMachine();
bindings.StepRenderer;
```

## Why Bindings

- Journey-specific typing is captured once at creation.
- Hook callsites do not require generics.
- Multiple journeys can coexist safely by creating separate bindings.

## Responsibilities

- Core handles runtime state/semantics.
- React package handles context wiring and rendering ergonomics.
