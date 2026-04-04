# MANIFEST

- Why Journey exists:
  Journey exists to model real product flows as explicit journeys instead of leaving navigation behavior scattered across UI state and component handlers.

- What problem it is reacting against:
  It reacts against two extremes: list-and-pointer wizards that collapse once flows branch, skip, retry, recover, or persist, and general-purpose statechart systems whose full modeling surface is often broader than product journeys require. Journey is meant to sit in the middle: explicit enough to model real flows, focused enough to stay practical.

- What it optimizes for:
  It optimizes for step-based product flows that need strong typing, explicit transitions, stable history, persistence, and thin framework bindings. The goal is clarity and determinism without unnecessary ceremony.

- What it explicitly is not:
  It is not a general-purpose hierarchical or parallel statechart engine. It is a focused runtime for journeys, not a universal orchestration system.

- Product flows are not just lists with a pointer. They branch, skip, retry, recover, terminate, and resume.
- UI components should not be forced to invent flow logic ad hoc. When navigation rules leak into click handlers and local state, behavior becomes duplicated, implicit, and fragile.
- A journey should be modeled as a graph of explicit transitions, not as a pile of conditionals spread across views.
- The runtime should tell the truth in one place. Current step, realized history, context, visited state, status, and async phase should live in one canonical snapshot.
- Product teams need to know not only where the user is, but how they got there. History is part of the model.
- Async checks are not incidental. Loading, failure, timeout, and retry are part of flow behavior and should be visible in the runtime instead of hand-managed in every screen.
- Branch-heavy flows should stay understandable. Ordered transition matching, explicit guards, and deterministic commits are easier to test and easier to explain than implicit UI control flow.
- The core should stay framework-agnostic. Flow rules belong to the journey runtime; rendering belongs to the framework layer.
- React bindings should be thin and typed. They should expose the runtime cleanly, not become a second state system.
- Persistence should restore the journey's state without turning the runtime into storage glue. Recovery is valuable, but it must remain optional and modular.
- Optional capabilities should be plugins, not baseline cost. Persistence, execution-path analysis, analytics, autosave, diagnostics, and replay should extend the machine without bloating the core.
- Type safety should serve the flow model. Step ids, events, payloads, guards, and transition targets should be checked where they are authored, not left to runtime accidents.
- The library should optimize for product journeys specifically: onboarding, auth, checkout, recovery, review, confirmation, and other multi-step user flows.
- The goal is not to model every kind of state machine. The goal is to model real product journeys clearly, predictably, and with as little ceremony as possible.
