---
id: index
title: Usage
sidebar_label: Overview
---

# Usage

Journey has three modes. Pick the one that fits your flow, then read its page for a full walkthrough.

| Mode                       | Factory                 | When to use                                                                                                                                                     |
| -------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [**Linear**](./linear)     | `createLinearJourney`   | Fixed step sequence. Steps are ordered; `goToNextStep` advances through them. Good for onboarding, checkout, multi-step forms.                                  |
| [**Graph**](./graph)       | `createGraphJourney`    | Branching, conditional routing, retries, custom events. Transitions are declared as an event map. Good for verification flows, support tooling, task-heavy UIs. |
| [**Headless**](./headless) | `createHeadlessJourney` | No transition graph. Caller drives navigation entirely via `goToStepById`. Good for custom renderers, server-assisted flows, non-React environments.            |

All three share the same runtime, snapshot shape, and observable API. The factory you choose determines the input contract and what navigation methods make sense at runtime.

:::tip Moving between modes
A linear flow often grows into a graph as product rules accumulate. A UI-bound flow often benefits from headless runtime boundaries later. The transition is a refactor of the definition, not the runtime.
:::
