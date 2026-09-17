---
"@rxova/journey-react": patch
---

React 18.2 is now a verified minimum rather than an unverified claim. The peer range already said
`>=18.2.0`, but only React 19 was ever installed or tested, and the README said 19 while
`CONTRIBUTING.md` said 18+. All three now say 18.2+, and CI runs the React suite and a typecheck
against React 18.2 alongside the default 19.

One development-only difference is documented rather than papered over: React 18's StrictMode
re-mounts hooks on its second render pass, so `useJourney()`'s factory runs twice there and once
on React 19. Only the committed bundle is ever started — the discarded one never mounts, so its
start effect never runs and it holds no timers, subscriptions, or journey state.
