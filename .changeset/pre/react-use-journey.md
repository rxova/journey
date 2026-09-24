---
"@rxova/journey-react": minor
---

Add `useJourney(factory)`, which owns a bundle for one component instance: the factory runs once,
the bundle survives re-renders, and the machine is disposed when the component really unmounts.

This replaces the `useState` lazy initializer the README previously recommended for per-mount
isolation. React double-invokes those initializers under StrictMode, so that pattern built two
fully-configured machines per mount — two plugin `setup()` passes, two persistence reads and
writes, two armed autosave timers — and abandoned one without disposing it. `useJourney`
initializes into a ref and defers disposal by a macrotask, so StrictMode's simulated unmount
cancels it while a real unmount still disposes.

Also exports the `OwnedJourneyBundle` type, and documents the lifecycle of module-scope bundles:
they are never disposed, and one such bundle is shared by every request in a server process.
