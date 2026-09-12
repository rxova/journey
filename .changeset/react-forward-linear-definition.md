---
"@rxova/journey-react": patch
---

`createLinearJourney` now forwards the whole definition to core instead of hand-picking `steps`
and `context`. Its own `name` field is rest-destructured off and the remainder is passed through,
matching what the graph factory already did. The two are equivalent today, but the old shape would
have silently dropped any field core added to the linear definition later.
