---
"@rxova/journey-core": minor
---

Add `JourneyError`, so failures can be handled by code rather than by message text.

Every error Core throws itself was a bare `Error` with a prose message and no structure — the
offending step id existed only inside the interpolated string. Telling "duplicate plugin name" apart
from "unknown step in transition" meant matching on that text, which quietly made every message a
compatibility promise. Doing this before `1.0` is what avoids inheriting that promise.

```ts
import { createLinearJourney, isJourneyError } from "@rxova/journey-core";

try {
  createLinearJourney(definition, { startAt: idFromRoute });
} catch (error) {
  if (isJourneyError(error) && error.code === "unknown-step") {
    redirectToFirstStep(error.stepId);
  }
}
```

`JourneyError` extends `Error`, is named `"JourneyError"`, and keeps the existing `journey:` message
prefix, so anything currently matching on that text still works. It adds:

- **`code`** — a closed union: `empty-definition`, `duplicate-step-id`, `unknown-step`,
  `unknown-initial-step`, `dangling-transition`, `duplicate-plugin-name`, `storage-unavailable`,
  `async-commit`. Covered by semver; adding a member is a minor change.
- **`stepId`, `event`, `pluginName`** — the offender, where one applies.
- **`isJourneyError(value)`** — a narrowing helper, so consumers need not import the class.

Every throw site is converted: both factories, the builder, the converter, persistence storage
resolution, and the runtime's unknown-step, duplicate-plugin, and async-commit guards.

`NavigationResult.error` and the `error` subscription event deliberately stay `unknown`. They carry
whatever the caller's own navigation work or hooks threw, which Core cannot constrain — wrapping it
would hide the original. Error **messages** remain outside the stability contract: match on `code`.
