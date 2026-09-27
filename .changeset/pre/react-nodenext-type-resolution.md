---
"@rxova/journey-react": patch
---

Fix type resolution for consumers on `moduleResolution: "node16"` / `"nodenext"`. The published
`.d.ts` and `.d.cts` files carried extensionless relative imports, which those resolvers cannot
follow — all three entrypoints reported an internal resolution error. The published declarations
now carry explicit `.js` extensions, added at build time.

Also adds size budgets for the previously unmeasured `dist/client.js` and for `useJourney`.
