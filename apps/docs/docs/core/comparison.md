---
id: comparison
title: Comparison
---

# Comparison

Journey sits between a step-index hook and a general statechart engine.

| Need                              | Step-index hook | Journey   | General statechart  |
| --------------------------------- | --------------- | --------- | ------------------- |
| Ordered next/back flow            | Yes             | Yes       | Yes                 |
| Named, typed step ids             | Varies          | Yes       | Yes                 |
| Event-driven branches             | Usually manual  | Yes       | Yes                 |
| Realized timeline and pointer     | Usually no      | Yes       | Model it            |
| Async pre-commit gate             | Usually manual  | `onLeave` | Yes                 |
| Snapshot-visible entry state      | Usually manual  | Yes       | Model it            |
| Explicit lifecycle status/outcome | Usually no      | Yes       | Model it            |
| Observe-only plugin API           | Usually no      | Yes       | Ecosystem-dependent |
| Nested/parallel states            | No              | No        | Yes                 |
| Actor model                       | No              | No        | Yes                 |
| Framework-independent core        | Varies          | Yes       | Yes                 |

Use a simple hook when the flow is a few fixed screens and an index is enough. Use Journey when the
product needs branching, guarded movement, actual path history, lifecycle observation, or optional
persistence and replay without adopting general statechart semantics.

Use a statechart engine when nested or parallel states, actors, formal statechart behavior, or a
broader orchestration model are central to the problem.

See [Coming from XState](./coming-from-xstate) for a concept mapping and [Choosing a mode](./usage/)
for Journey's two definition shapes.
