---
"@rxova/journey-core": minor
---

Introduce a `JourneyError` class hierarchy so thrown errors can be distinguished
programmatically.

- `JourneyError` is the new base class for every error the runtime throws; catch
  it to separate journey failures from unrelated errors.
- The existing `JourneyTimeoutError` and `JourneyDisposedError` now extend
  `JourneyError` (no behavior change; their names and `instanceof Error` still
  hold).
- `JourneyDefinitionError` (extends `JourneyError`) is thrown at creation time
  for a structurally invalid definition. It carries a `code` discriminant
  (`JourneyDefinitionErrorCode`): `invalid-shape`, `unknown-step`,
  `reserved-step-id`, `duplicate-step`, `missing-initial`, `invalid-transition`,
  `invalid-timeout`, `invalid-effect`, `invalid-after`, or `self-transition`.

All definition-validation throws in `resolveJourneyDefinition` and
`createJourneyMachine` now use `JourneyDefinitionError`; error messages are
unchanged.
