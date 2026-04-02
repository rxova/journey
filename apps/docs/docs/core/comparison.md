---
title: Comparison Table
sidebar_label: Comparison Table
---

"Others" refers to typical React step/wizard hook libraries — no specific library is named. ⚠️ means the feature exists in some libraries but is inconsistent, partial, or untyped. ❓ means it is not publicly verifiable.

| Category           | Feature                                                              | Journey   | Others            |
| ------------------ | -------------------------------------------------------------------- | --------- | ----------------- |
| **Architecture**   | Framework-agnostic core package                                      | ✅        | ❌                |
| **Architecture**   | TypeScript-first (strict generics throughout)                        | ✅        | ⚠️                |
| **Architecture**   | Zero dependencies                                                    | ✅        | ⚠️                |
| **Architecture**   | 95%+ test coverage, enforced in CI                                   | ✅        | ❓                |
| **Architecture**   | 7.13 kB (core, brotli)                                               | ✅        | ⚠️                |
| **Navigation**     | Linear (sequential) flow                                             | ✅        | ✅                |
| **Navigation**     | `goToNextStep()`                                                     | ✅        | ✅                |
| **Navigation**     | `goToPreviousStep()`                                                 | ✅        | ✅                |
| **Navigation**     | `isFirstStep` / `isLastStep`                                         | ✅        | ✅                |
| **Navigation**     | `stepCount` / total steps                                            | ✅        | ✅                |
| **Navigation**     | Active step index                                                    | ✅        | ✅                |
| **Navigation**     | `onStepChange` callback                                              | ✅        | ✅                |
| **Navigation**     | Start at a step other than the first                                 | ✅ by id  | ✅ by index       |
| **Navigation**     | Navigate to a specific step                                          | ✅ by id  | ✅ by index       |
| **Navigation**     | Graph mode (branching flows)                                         | ✅        | ❌                |
| **Navigation**     | Headless mode (caller-driven)                                        | ✅        | ❌                |
| **Computed state** | `isLoading` (global)                                                 | ✅        | ✅                |
| **Computed state** | `isLoading` per step                                                 | ✅        | ❌                |
| **Computed state** | Machine status (`isRunning`, `isComplete`, `isTerminated`, `isIdle`) | ✅        | ❌                |
| **Features**       | Shared typed context across all steps                                | ✅        | ❌                |
| **Features**       | Typed step metadata (`meta`)                                         | ✅        | ⚠️                |
| **Features**       | `onEnter` / `onLeave` per step                                       | ✅        | ⚠️                |
| **Features**       | Guarded transitions (`when`)                                         | ✅        | ❌                |
| **Features**       | Global transitions (cross-cutting events)                            | ✅        | ❌                |
| **Features**       | Pre-navigation async hook                                            | ✅ `when` | ✅ `handleStep()` |
| **Layout**         | UI-agnostic (you own the layout)                                     | ✅        | ❌                |
| **Layout**         | Built-in header / footer / wrapper slots                             | ❌        | ✅                |
| **Layout**         | Built-in UI (progress bar, stepper indicator)                        | ❌        | ⚠️                |
| **Layout**         | Animation / transition support                                       | ❌        | ⚠️                |
| **Layout**         | Form validation integration (e.g. RHF)                               | ❌        | ⚠️                |
| **Async**          | Async guards                                                         | ✅        | ❌                |
| **Async**          | Per-step async phase tracked in snapshot                             | ✅        | ❌                |
| **Async**          | Per-transition timeout with error phase                              | ✅        | ❌                |
| **History**        | Realized history timeline (not just index)                           | ✅        | ❌                |
| **History**        | `goToLastVisitedStep()`                                              | ✅        | ❌                |
| **History**        | Visited-steps map in snapshot                                        | ✅        | ❌                |
| **Observability**  | Typed lifecycle event stream                                         | ✅        | ❌                |
| **Observability**  | Chrome DevTools extension                                            | ✅        | ❌                |
| **Ecosystem**      | Plugin API                                                           | ✅        | ❌                |
| **Ecosystem**      | Persistence plugin (versioned + migrations)                          | ✅        | ❌                |
| **React**          | `useSyncExternalStore` (React 18 concurrent-safe)                    | ✅        | ❌                |
| **React**          | SSR / React Server Components compatible                             | ✅        | ⚠️                |
| **React**          | `useJourneyStepLifecycle` hook                                       | ✅        | ❌                |
| **React**          | `useJourneySelector` with custom equality                            | ✅        | ❌                |
