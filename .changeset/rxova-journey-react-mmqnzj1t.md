---
"@rxova/journey-react": minor
---

Align @rxova/journey-react with the @rxova/journey-core transition-definition refactor. React journey definitions now use the callback-scoped transition helpers exposed inside journey.transitions, including the preferred choose(({ when, otherwise }) => [...]) branching syntax. See the @rxova/journey-core release notes in this release for the full API change details.
