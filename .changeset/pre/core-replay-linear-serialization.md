---
"@rxova/journey-core": minor
---

`toSerializable` is now linear in the number of distinct objects, and stack-safe.

The previous walk removed each node from its `seen` set on the way back up. That is correct for
cycles, but it meant a shared subtree was re-traversed once per path reaching it — so a context with
diamond-shaped sharing, which is routine for normalized or relational data, cost 2^N. The replay
plugin serializes the entire snapshot on every transition, status change, context change, blocked
navigation, and error, with `captureSnapshots` defaulting to `true`, so this ran on the hot path and
could freeze the event loop.

Measured on a diamond-shared structure, before → after:

| Depth | Before      | After   |
| ----- | ----------- | ------- |
| 14    | 21 ms       | 0.22 ms |
| 18    | 241 ms      | 0.06 ms |
| 20    | 932 ms      | 0.05 ms |
| 26    | not in 120s | 0.06 ms |
| 40    | infeasible  | 0.09 ms |

Two correctness fixes came with it:

- **Arrays are cycle-tracked.** They were matched before the object branch and never entered `seen`,
  so a self-referencing array recursed until the stack gave out. It now yields `"[circular]"` like
  any other cycle.
- **Depth is capped**, at 100 by default and configurable per call. A long parent/child chain used to
  overflow the stack, and the resulting `RangeError` was swallowed by listener isolation — the replay
  entry vanished with no signal. Nesting past the cap now serializes as `"[max-depth]"`.

`toSerializable`'s second parameter changes from an internal `WeakSet` accumulator to an options
object (`{ maxDepth? }`). Callers passing only a value — every documented use — are unaffected.
