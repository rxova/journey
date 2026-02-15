import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierConfig from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

const TEST_FILE_GLOBS = [
  "test/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
  "**/__tests__/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
  "**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"
];

export default [
  {
    ignores: [
      "dist/**",
      "**/dist/**",
      "coverage/**",
      "node_modules/**",
      "flow/**",
      "apps/docs/.docusaurus/**",
      "apps/docs/build/**",
      "**/*.d.ts",
      "**/*.d.ts.map"
    ]
  },
  js.configs.recommended,
  {
    files: ["scripts/**/*.mjs", "*.config.cjs", "*.config.mjs"],
    languageOptions: {
      globals: {
        ...globals.node
      }
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
        ...globals.node
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
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
