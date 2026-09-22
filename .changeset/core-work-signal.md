---
"@rxova/journey-core": minor
---

Work now receives an `AbortSignal`. A graph send's `run` and navigation work's `run` get `signal`
in their arguments, and `commit` gets the same one. It aborts when the runtime stops waiting for the
call: on a timeout, with the timeout error as its `reason`, or when the machine is terminated,
restarted, or disposed mid-work. Before, a timed-out or abandoned call ran on to its own end with
nothing observing it; passing the signal to `fetch` or a client now stops it. A call that finishes
or fails on its own keeps a signal that never aborts.
