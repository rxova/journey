import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
const PACKAGE_BOUNDARY_FILE_GLOBS = [
  "packages/*/src/**/*.{ts,tsx,mts,cts}",
  "packages/*/test/**/*.{ts,tsx,mts,cts}"
];
const REPO_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PACKAGES_ROOT = path.join(REPO_ROOT, "packages");
const WORKSPACE_PACKAGES = fs
  .readdirSync(PACKAGES_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const packageDir = path.join(PACKAGES_ROOT, entry.name);
    const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));
    const declaredWorkspaceDependencies = new Set(
      [
        ...Object.keys(packageJson.dependencies ?? {}),
        ...Object.keys(packageJson.devDependencies ?? {}),
        ...Object.keys(packageJson.peerDependencies ?? {}),
        ...Object.keys(packageJson.optionalDependencies ?? {})
      ].filter((dependencyName) => dependencyName.startsWith("@rxova/"))
    );

    return {
      dir: packageDir,
      dirName: entry.name,
      name: packageJson.name,
      declaredWorkspaceDependencies
    };
  });

function findWorkspacePackageForFile(filePath) {
  return WORKSPACE_PACKAGES.find(
    (workspacePackage) =>
      filePath === workspacePackage.dir || filePath.startsWith(`${workspacePackage.dir}${path.sep}`)
  );
}

function findWorkspacePackageForImport(specifier) {
  return WORKSPACE_PACKAGES.find(
    (workspacePackage) =>
      specifier === workspacePackage.name || specifier.startsWith(`${workspacePackage.name}/`)
  );
}

const workspacePlugin = {
  rules: {
    "enforce-package-boundaries": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Require internal workspace packages to be imported via their package name and only when declared."
        },
        schema: []
      },
      create(context) {
        const filename = context.filename ?? context.getFilename();

        if (!path.isAbsolute(filename)) {
          return {};
        }

        const sourcePackage = findWorkspacePackageForFile(filename);

        if (!sourcePackage) {
          return {};
        }

        function checkImport(node, sourceNode) {
          const specifier = sourceNode?.value;

          if (typeof specifier !== "string") {
            return;
          }

          if (specifier.startsWith(".")) {
            const resolvedPath = path.resolve(path.dirname(filename), specifier);
            const targetPackage = findWorkspacePackageForFile(resolvedPath);

            if (targetPackage && targetPackage.name !== sourcePackage.name) {
              context.report({
                node: sourceNode,
                message: `Import from ${targetPackage.name} via its package name instead of a relative path.`
              });
            }

            return;
          }

          const targetPackage = findWorkspacePackageForImport(specifier);

          if (!targetPackage || targetPackage.name === sourcePackage.name) {
            return;
          }

          if (!sourcePackage.declaredWorkspaceDependencies.has(targetPackage.name)) {
            context.report({
              node: sourceNode,
              message: `Declare ${targetPackage.name} in packages/${sourcePackage.dirName}/package.json before importing it.`
            });
          }
        }

        return {
          ExportAllDeclaration(node) {
            checkImport(node, node.source);
          },
          ExportNamedDeclaration(node) {
            if (node.source) {
              checkImport(node, node.source);
            }
          },
          ImportDeclaration(node) {
            checkImport(node, node.source);
          },
          ImportExpression(node) {
            checkImport(node, node.source);
          },
          TSImportType(node) {
            checkImport(node, node.argument);
          }
        };
      }
    }
  }
};

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
    rules: {
      "no-nested-ternary": "error"
    }
  },
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
    settings: {
      // useSafeLayoutEffect is useLayoutEffect on the client and useEffect on
      // the server. Without this its dependency arrays are invisible to
      // exhaustive-deps, which is most of the effects in packages/react.
      "react-hooks": { additionalHooks: "(useSafeLayoutEffect)" }
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }]
    }
  },
  {
    files: PACKAGE_BOUNDARY_FILE_GLOBS,
    plugins: {
      workspace: workspacePlugin
    },
    rules: {
      "workspace/enforce-package-boundaries": "error"
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
  {
    // Colocated tests must exercise the public entrypoints: import via the
    // package name (or its internal /testing alias), never by reaching into
    // src with parent-relative paths. Sibling imports (./fixtures) stay legal.
    files: [
      "packages/*/src/**/__tests__/**/*.{ts,tsx,mts,cts}",
      "apps/*/src/**/__tests__/**/*.{ts,tsx,mts,cts}"
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../**"],
              message:
                "Import via the package name (@rxova/…) instead of a parent-relative path; use the package's /testing alias for shared test helpers."
            }
          ]
        }
      ]
    }
  },
  prettierConfig
];
