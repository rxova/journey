---
"@rxova/journey-core": major
---

Make persistence opt-in by removing persistence runtime/types from the package root exports.
Consumers must import persistence from `@rxova/journey-core/persistence` instead of the package root.
