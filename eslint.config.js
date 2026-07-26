import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierConfig from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

const TEST_FILE_GLOBS = [
  "test/**/*.{ts,tsx,js,jsx,mts,cts,cjs}",
  "**/__tests__/**/*.{ts,tsx,js,jsx,mts,cts,cjs}",
  "**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts,cjs}"
];

export default [
  {
    ignores: [
      "dist/**",
      "**/dist/**",
      "coverage/**",
      "node_modules/**",
      "worktrees/**",
      "flow/**",
      "apps/docs/.astro/**",
      "apps/docs/dist/**",
      "**/.next/**",
      "**/*.d.ts",
      "**/*.d.ts.map"
    ]
  },
  js.configs.recommended,
  {
    files: [
      "scripts/**/*.{ts,js}",
      "packages/*/scripts/**/*.ts",
      "apps/*/scripts/**/*.js",
      "apps/*/src/plugins/**/*.js",
      "*.config.cjs",
      "*.config.js",
      "apps/*/*.config.js"
    ],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ["**/*.mjs"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Program",
          message: "Use .ts or .js files. .mjs is not allowed in this repository."
        }
      ]
    }
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module"
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }]
    }
  },
  {
    files: TEST_FILE_GLOBS,
    languageOptions: {
      globals: {
        ...globals.vitest,
        ...globals.jest,
        ...globals.browser,
        ...globals.node
      }
    }
  },
  prettierConfig
];
