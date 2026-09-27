---
"@rxova/journey-react": major
---

Leave one way to read and one way to command. The bundle exposed ten hooks; three of them were not
reactive at all, and two more were second spellings of things that belong elsewhere.

## Renamed

- `useSubscribeEvent` → **`useEventEffect`**. It is an effect that happens to subscribe, and the
  name now puts it next to `useEffect` in a reader's head rather than next to `machine.subscriptions`.
- `useContext()` → **`useContextSelector(selector, equalityFn?)`**, selector required.
  `useContextSelector((context) => context)` is the explicit way to ask for the whole object and
  re-render on every context write — by construction rather than by accident.

## Removed

`useMachine()`, `useControls()` and `useNavigation()` are gone. None of them subscribed to anything;
each returned an object already reachable on the bundle. The machine's command groups are frozen
objects with stable references, so they are plain properties now: `machine`, `controls`, `navigate`
(linear) or `send` (graph), and `updateContext`.

## Step lifecycle hooks are effects

React step configs no longer accept Core's `onEnter` / `onLeave`. `<StepRenderer>` keys the active
view by step id, so a step's own component mounts when the step is entered and unmounts when it is
left — a `useEffect` with a cleanup says both, scoped to the component that cares and able to reach
component state and React context, which a hook running inside Core cannot.

This is enforced, not just documented. The tier's step types declare `onEnter?: never` and
`onLeave?: never`, because a bare `Omit` only rejects inline object literals: a step declared in its
own file and annotated with Core's `GraphStep<Bag>` would otherwise keep its hooks and compile
clean. Use `ReactLinearStepInput`, `ReactGraphStep<Bag>` and `ReactGraphDefinition<Bag>` where you
would have reached for Core's equivalents. Core keeps both hooks for machines driven outside React.

## Unchanged, deliberately

`autoStart` stays three-way in this tier — omitted starts the machine from a layout effect on first
mount, so subscribers attach before the initial `stepEnter` and SSR renders `fallback` on both
sides. Core's default is now `true`, which makes this tier's `options?.autoStart === true` guard
load-bearing: forwarding options unchanged would start every bundle inside the factory and break
hydration.
