---
title: "Usage"
---

# Usage

Journey is easiest to understand when you map it to the way your product uses it. Most teams end up in one of three modes: wizard, graph, or headless runtime.

## Wizard

Use Journey as a wizard when the user experience is mostly sequential, but you still want the runtime to stay honest about skips, exits, and async checks.

Good fit:

- onboarding
- checkout
- multi-step forms
- configuration flows

```ts
const journey = {
  initial: "profile",
  context: { isBusiness: false },
  steps: {
    profile: {},
    company: {},
    review: {}
  },
  transitions: {
    profile: {
      goToNextStep: [
        {
          to: "review",
          when: ({ context }) => !context.isBusiness
        },
        {
          to: "company",
          when: ({ context }) => context.isBusiness
        }
      ]
    },
    company: {
      goToNextStep: [{ to: "review" }]
    },
    review: {
      completeJourney: true
    }
  }
};
```

This is still a wizard experience, but it is already better modeled as explicit transitions than as a fixed array plus ad hoc button logic.

## Graph

Use Journey as a graph when the product genuinely has branches, retries, loops, or more than one valid completion path.

Good fit:

- verification and recovery flows
- support or operations tooling
- long-lived task flows
- flows with manual review or alternate resolution paths

```ts
const journey = {
  initial: "start",
  context: { isApproved: false },
  steps: {
    start: {},
    review: {},
    retry: {},
    approved: {},
    rejected: {}
  },
  transitions: {
    start: {
      goToNextStep: [{ to: "review" }]
    },
    review: {
      goToNextStep: [
        { to: "approved", when: ({ context }) => context.isApproved },
        { to: "retry", when: ({ context }) => !context.isApproved }
      ]
    },
    retry: {
      goToNextStep: [{ to: "review" }]
    },
    approved: {
      completeJourney: true
    },
    rejected: {
      terminateJourney: true
    }
  }
};
```

The win here is visibility. Instead of reading several components to reconstruct the flow, the team can inspect the graph directly.

## Headless

Use Journey as a headless runtime when you want the flow model without coupling it to any specific rendering layer.

Good fit:

- non-React environments
- complex server-assisted flows
- custom renderers
- telemetry-heavy runtime orchestration

```ts
const journeyMachine = createJourneyMachine(journey);
journeyMachine.startJourney();

journeyMachine.subscribe(() => {
  renderFromSnapshot(journeyMachine.getSnapshot());
});

journeyMachine.subscribeEvent((event) => {
  analytics.track(event.type, event);
});

await journeyMachine.goToStepById("review");
```

In headless mode, the caller drives forward navigation with `goToStepById(...)`. `goToNextStep()` and custom events remain no-op unless you add transitions and move into graph or linear mode.

This is the same runtime model. The difference is where the snapshot is rendered and who decides the next step.

## Choosing Between Them

- Choose **wizard** when the user experience is mostly linear but you still need a reliable runtime model.
- Choose **graph** when multiple valid paths are part of the product, not edge cases.
- Choose **headless** when the flow model matters more than framework integration.

You can also move between these modes over time. A wizard often becomes a graph. A UI-bound flow often benefits from headless runtime boundaries later.
