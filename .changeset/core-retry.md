---
"@rxova/journey-core": minor
---

Add `retry(run, { attempts, delayMs?, when?, timeoutMs? })`, which wraps a work `run` so a failure
tries it again. Each try gets its own `signal` and its `attempt` number; a try's `timeoutMs` aborts
it and counts as a failure, and the work's own signal cuts the wait between tries short, so
terminating the machine stops the loop. `commit` runs once, on the successful result. It is a plain
function around `run` rather than a runtime feature, so it works for graph, `always` and linear
navigation work, and it adds nothing to a machine that does not use it. Invalid `attempts` or
`timeoutMs` throw a `JourneyError` coded `invalid-retry`.
