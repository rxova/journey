---
"@rxova/journey-react": patch
---

A bundle now opens a single machine subscription for its whole component tree instead of one per
mounted hook. Core runs every registered selector on every publish, so subscribing per hook made
it repeat identical selector and equality work once per subscriber — five subscribed components
meant five subscriptions and five times the per-publish cost. It is now constant regardless of
how many views are mounted, and the subscription is released when the last one unmounts.

The multiplexer and the selection cache moved to `@rxova/journey-common/bindings`, since both are
pure logic a Vue or Angular wrapper would otherwise reimplement. No new published package: common
is internal and bundled into the wrapper.
