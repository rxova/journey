---
title: "Core Examples"
sidebar:
  label: "Examples"
---

Representative examples are useful when you want to see the runtime as a product shape, not as a list of features.

| Example                     | What it demonstrates                                                         | Good fit                               |
| --------------------------- | ---------------------------------------------------------------------------- | -------------------------------------- |
| Typed checkout wizard       | stable step ids, optional skip rules, typed payloads, completion             | onboarding, checkout, setup flows      |
| Verification graph          | branching, retry loops, timeout-aware guards, alternate completion paths     | KYC, approvals, support tooling        |
| Confirm-close flow          | wildcard or cross-cutting close handling with explicit exit confirmation     | long forms, draft-heavy flows          |
| Observable runtime          | `subscribe`, `subscribeSelector`, and `subscribeEvent` working together      | analytics, debugging, custom renderers |
| Persistence-enabled machine | resume-later behavior using the persistence plugin                           | multi-session flows                    |
| Structural path analysis    | execution-path inspection without running guards or committing runtime state | flow audits, product review, tests     |

## What To Look For In The Examples

- How many of the movement rules live in transitions instead of UI handlers
- Whether step ids stay stable as the flow grows
- Whether the snapshot alone can explain current runtime truth
- Whether the event stream is enough to understand how the machine changed

See package examples under `packages/core/examples` for runnable snippets, and pair them with [Recipes](./recipes.md) when you need smaller focused patterns.
