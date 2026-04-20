---
title: "Analytics Plugin"
---

# Analytics Plugin

The analytics plugin turns Journey observation events into normalized analytics envelopes.

It does not change transition behavior. It listens to the runtime lifecycle and forwards a stable event shape to your analytics client.

## Install And Use

```ts
import { createJourneyMachine } from "@rxova/journey-core";
import { createAnalyticsPlugin } from "@rxova/journey-core/analytics";

const machine = createJourneyMachine(journey, {
  plugins: [
    createAnalyticsPlugin({
      machineId: "checkout",
      includeStepMeta: true,
      track: (event) => analytics.track(event.name, event.payload)
    })
  ]
});
```

## What You Get

The plugin augments the machine with:

```ts
machine.trackAnalyticsEvent(name, payload);
```

That lets you send custom analytics markers alongside the built-in lifecycle events.

## Built-In Event Names

The plugin emits normalized events for:

- `journey_started`
- `step_viewed`
- `step_exited`
- `transition_started`
- `transition_succeeded`
- `transition_failed`
- `journey_completed`
- `journey_terminated`
- `navigation_previous`
- `navigation_last_visited`

Every event includes:

- `name`
- `timestamp`
- `payload`
- optional `machineId`

Depending on the event, payload fields may include:

- raw `context`
- `stepId`
- `from`
- `to`
- `eventType`
- `transitionId`
- `dwellMs`
- `durationMs`
- `stepMeta`, `fromStepMeta`, `toStepMeta`

## Options

- `track(event)`: analytics sink
- `machineId`: optional identifier included in every tracked event
- `includeStepMeta`: include step metadata in emitted payloads
- `onError(error, event)`: handles tracker failures without breaking the machine

`payload.context` always contains the raw machine context from the current snapshot.

## Safety Behavior

If `track(...)` throws, the machine continues running.

- when `onError` is provided, the plugin forwards the failure there
- otherwise Journey reports a development warning

Analytics failures never block transitions, navigation, or snapshot commits.
