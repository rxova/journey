---
"@rxova/journey-core": minor
---

Type-surface and ergonomics fixes that are cheapest while the contract is still open.

**A rejected navigation now says which target it rejected.** `NavigationResult`'s failure arm
carried only `{ ok, reason, error? }`, so a caller awaiting `send()` or `goToStepById()` had to
subscribe to `navigationBlocked` separately just to log the attempted step. It now includes `from`
and `to`; `to` is `null` where no target was ever resolved, such as a graph event with no enabled
candidate. Additive — existing checks on `ok`, `reason`, and `error` are unaffected.

**`JourneyTypeBag`'s `meta` and `handlers` are inferred from optional properties.** The constraint
declared them optional but `MetaOf`/`HandlersOf` matched a _required_ property, so anyone who
mirrored the constraint and wrote `meta?: MyMeta` silently got `Record<string, unknown>` instead of
their own type — and the eventual error pointed nowhere near the bag declaration.

**`linearToGraphDefinition` keeps step-id and event typing, and rejects duplicates.** It hard-coded
`TStepId` to `string`, so a converted definition lost `goToStepById` typing entirely. It is now
generic over the step ids and returns a typed `LinearGraphEvent<TStepId>` union
(`NEXT` | `PREVIOUS` | `GO_TO_<ID>`). It also had no duplicate-id guard, unlike
`createLinearJourney` — so a round trip turned a definition that would have thrown into a silently
different, cyclic graph (`["a","b","a"]` became `a <-> b`). It now throws `duplicate-step-id`.

**The compilation `lib` moves to ES2022** (emit target stays ES2020). Journey targets evergreen
browsers and Node >= 20.11, all of which have had `Object.hasOwn` and `Error`'s `cause` since 2021 —
without this, each use needed a workaround. `JourneyError` now takes an optional `cause` through the
standard constructor, so a blocked-storage failure keeps the underlying `SecurityError` attached
non-enumerably rather than as an ordinary property.
