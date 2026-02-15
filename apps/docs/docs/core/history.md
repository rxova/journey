---
title: History Behavior
sidebar_position: 7
---

History powers deterministic back navigation.

## `history` vs `visited`

- `history`: previous-step stack used by `HISTORY_TARGET`.
- `visited`: unique ordered list of all reached steps.

`visited` survives history trimming.

## `HISTORY_TARGET` Resolution

When transition target is `HISTORY_TARGET`:

1. Read latest entry from history.
2. Skip invalid entries.
3. Move to first valid prior step.
4. Remove consumed entry from history.

If no valid entry exists, machine stays on current step.

## Common Back Pattern

```ts
import { HISTORY_TARGET } from "@rxova/journey-core";

{ from: "*", event: "back", to: HISTORY_TARGET }
```

## Capacity and Trimming

Defaults:

- `maxHistory = 50`
- `maxHistory = null` disables trimming.

`onOverflow` gets:

- `previous`
- `next`
- `trimmed`
- `reason`: `"auto" | "hydrate" | "manual"`

## Manual APIs

```ts
machine.trimHistory(10);
machine.clearHistory();
```

## Design Guidance

- Keep global back rule near top-level transitions.
- For restricted back paths, add specific transitions before wildcard back.
- Use `visited` for analytics/progress, not `history`.
