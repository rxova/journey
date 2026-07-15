---
"@rxova/journey-react": minor
---

Add two creation-time machine options.

- `handlers` — override the definition's `handlers` at machine creation. The
  override is shallow-merged over the definition's handlers per key, so a test
  can swap just the I/O it cares about and reuse the same definition:
  `createGraphJourney(def, { handlers: { verifyToken: fake } })`. This is the
  typed equivalent of XState's `.provide()`. Available on every `create*Journey`
  factory in core and React, and fully inferred from the definition's handler
  shape.
- `onNoMatch` — called when a sent event matches no enabled transition (every
  candidate is guarded and none pass, or none is declared) and is therefore
  dropped with no state change. When omitted, a development-only warning is
  logged instead. Internal `effect`/`after` events never trigger it. The new
  `JourneyNoMatchContext` type describes the `{ from, eventType }` payload.
