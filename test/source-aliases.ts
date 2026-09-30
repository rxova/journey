import { fileURLToPath } from "node:url";

const at = (path: string): string => fileURLToPath(new URL(`../${path}`, import.meta.url));

/**
 * Every suite runs against the packages' sources, not their built dist: a
 * package's tests exercise its siblings exactly as they are in this checkout,
 * and no suite needs a build in front of it. The `/testing` entries are each
 * package's sanctioned bridge to its internals for tests.
 *
 * Longer specifiers come first: a string alias also matches `<find>/…`, so
 * `@rxova/journey-core` listed first would swallow `@rxova/journey-core/plugins`.
 */
export const sourceAliases = [
  {
    find: "@rxova/journey-core/connectors/immer",
    replacement: at("packages/core/src/connectors/immer/immer.ts")
  },
  { find: "@rxova/journey-core/plugins", replacement: at("packages/core/src/plugins/index.ts") },
  {
    find: "@rxova/journey-core/testing",
    replacement: at("packages/core/src/__tests__/helpers.ts")
  },
  { find: "@rxova/journey-core", replacement: at("packages/core/src/index.ts") },
  { find: "@rxova/journey-react/graph", replacement: at("packages/react/src/graph.tsx") },
  { find: "@rxova/journey-react/client", replacement: at("packages/react/src/client.ts") },
  {
    find: "@rxova/journey-react/testing",
    replacement: at("packages/react/src/__tests__/helpers.tsx")
  },
  { find: "@rxova/journey-react", replacement: at("packages/react/src/index.ts") },
  {
    find: "@rxova/journey-devtools-bridge/testing",
    replacement: at("packages/devtools-bridge/src/__tests__/helpers.ts")
  },
  {
    find: "@rxova/journey-devtools-bridge",
    replacement: at("packages/devtools-bridge/src/index.ts")
  }
];

/** The jsdom setup every suite shares. */
export const setupFile = at("test/setup.ts");
