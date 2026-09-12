---
title: "Examples"
---

The Core test suites are the source-aligned executable examples for the V1 runtime:

| Area                                    | Source                                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linear definitions and history          | [`packages/core/src/linear/__tests__/linear.test.ts`](https://github.com/rxova/journey/tree/main/packages/core/src/linear/__tests__/linear.test.ts) |
| Graph events, guards, hooks, and raises | [`packages/core/src/graph/__tests__/graph.test.ts`](https://github.com/rxova/journey/tree/main/packages/core/src/graph/__tests__/graph.test.ts)     |
| Graph builder                           | [`packages/core/src/graph/__tests__/builder.test.ts`](https://github.com/rxova/journey/tree/main/packages/core/src/graph/__tests__/builder.test.ts) |
| Lifecycle and async behavior            | [`packages/core/src/core/__tests__`](https://github.com/rxova/journey/tree/main/packages/core/src/core/__tests__)                                   |
| Built-in plugins                        | [`packages/core/src/plugins`](https://github.com/rxova/journey/tree/main/packages/core/src/plugins)                                                 |

Run the Core suite locally:

```bash
pnpm --filter @rxova/journey-core test
```

For focused application patterns, see [Recipes](./recipes). The standalone showcase applications
are being migrated independently and are not used as the V1 API reference.
