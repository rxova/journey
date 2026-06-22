---
"@rxova/journey-core": major
"@rxova/journey-react": major
"@rxova/journey-devtools-bridge": patch
---

Model custom events as a discriminated union instead of a keyed payload map.

The `events` type knob (and the `TEvents` generic, renamed from `TEventMap`) is now
a union of `{ type; payload? }` members rather than a `Record<eventName, payload>`:

```ts
// Before
type EventMap = { applyCoupon: { code: string }; reset: unknown };

// After
type Events =
  | { type: "applyCoupon"; payload: { code: string } } // payload required
  | { type: "reset" }; // no payload
```

This matches the XState/Redux convention and unlocks two things the map could not
express: **required** payloads (declare `payload` without `?`) and genuinely
**payload-less** events (omit `payload` entirely). Where a payload is required,
`event.payload` is now non-optional in `when`/`updateContext`/lifecycle callbacks
and on `machine.send(...)`, removing the `event.payload?.x ?? default` ceremony.

Migration: rewrite each event-map entry `name: Payload` as a union member
`{ type: "name"; payload?: Payload }` (keep `payload?` to preserve the old
always-optional behavior, or drop the `?` to require it; omit `payload` for
payload-less events). `JourneyPayloadFor`, `JourneySendEvent`, `JourneyEvent`,
`JourneyFullEventType` and friends keep their names but now operate on the union;
`JourneyBaseEvent` and `JourneyEventFor` are newly exported helpers.

Note: because event names can no longer be inferred from `transitions` keys the
way the keyed map allowed, definitions that rely on inference through
`createGraphJourney`/`createJourney`/`getJourneyDiagnostics`/`getExecutionPaths`
with custom events should provide the events type explicitly (via the builder
bundle, an explicit definition type, or explicit generics).
