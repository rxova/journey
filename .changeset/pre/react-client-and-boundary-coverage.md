---
"@rxova/journey-react": patch
---

Test-only. Covers three surfaces the package shipped without: the `./client` entry (previously
verified only by a string match for its `"use client"` directive against the built bundle), error
boundaries around `StepRenderer` and a throwing step view, and a suspending view inside
`<Suspense>`.

The client-entry test asserts its export surface matches the root entry, so a missing re-export
fails here rather than in a consumer's app.
