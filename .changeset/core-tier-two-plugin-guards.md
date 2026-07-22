---
"@rxova/journey-core": minor
---

Close the remaining plugin-boundary gaps, and make the companion types nameable.

**A shared plugin instance now warns in development.** Mutable plugin state is scoped per `setup()`,
but `options` is not — attaching one `createPersistencePlugin` or `createAutosavePlugin` instance to
two machines meant both wrote the same storage key and silently overwrote each other. Each instance
now warns from its second `setup()`. State was already isolated; only the configuration was shared.

**`clearPersisted()` and `clearAutosave()` contain storage failures.** Both called `removeItem`
unwrapped, so a throwing adapter propagated to the caller — inconsistent with their sibling writes,
which are all contained and recorded. They now record the failure in the plugin's error state.

**A throwing analytics `onError` no longer escapes `trackSafely`.** It sat outside the guard, so "the
sink failed" and "your error handler failed" were indistinguishable at the isolation boundary.

**Companion types are exported.** The type bag exists so steps and hooks can live in separate files,
which only works if the types their signatures mention are nameable. Added to the root entry:
`BagSendWorkArgs`, `BagSnapshot`, `GuardArgsOf`, `HandlersOf`, `JourneyEventWork`, `MetaOf`,
`StayFactory`, `ToFactory`, `WorkFactory`, `WorkGuardArgs`, `SendArgs`, `SendVerb`, `SendWork`,
`SendWorkArgs`, `CompletePayloadOf`, `TerminatePayloadOf`, `JourneySnapshotBase`, and
`JourneyStorage` (named by the already-exported `JourneyPersistOption`).

**`JourneyStepConfig` replaces reaching through `JourneyStepBuilder["_config"]`.** That member was
required for the advertised multi-file authoring pattern, so an underscore-prefixed internal had
become part of everyday use. It is now named, and `_config` is marked `@internal`.

**The step-id inference trap is documented.** Hoisting `steps` out of the call — the common tidy-up —
widens the array to `string[]` and silently collapses `TStepId` to `string`, losing `goToStepById`
typing, `startAt` validation, and the React tier's `views` exhaustiveness all at once, with no
diagnostic. The TypeScript guide now covers it and the fix.

Not included: strict structural validation in the graph factory. The diagnostics plugin already
reports unreachable steps, shadowed transitions, cycles, and missing terminal paths, and duplicating
that analysis on the creation path would add bytes to every consumer for something an opt-in plugin
does more thoroughly.

Size: the dev warnings pull `@rxova/journey-common/dev` into the persistence and autosave entries
(+111 B and +129 B); those are opt-in subpaths, so only their users pay.
