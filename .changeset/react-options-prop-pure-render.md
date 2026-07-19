---
"@rxova/journey-react": minor
---

**Breaking (pre-1.0):** `<LinearJourney>` takes core's creation options as one verbatim `options` prop (`JourneyRuntimeOptions`, frozen at mount) — the `startAt`, `persist`, and `plugins` props are removed; `startIndex` remains as JSX-order sugar. `autoStart` defaults to `true` and the start now runs in a layout effect instead of during render: render is pure (no entry hooks or persistence writes in render), the initial `stepEnter` reaches `onStepEnter`/`onStart`, and while idle only `fallback` renders — which is also what SSR emits (the client start re-renders synchronously before paint, so nothing flashes). With `autoStart: false`, start the machine yourself via `machineRef` or `machine.controls.start()`.
