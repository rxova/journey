---
"@rxova/journey-react": minor
"@rxova/journey-core": minor
---

# Add history management and trimming controls

- Core: `history` options with `maxHistory`, `onOverflow`, and manual `trimHistory`/`clearHistory`.
- React: pass `history` options through `<JourneyProvider>` and expose trim/clear in `useJourney` API.
- Docs: clarify history/visited behavior and overflow reasons.
