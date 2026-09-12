import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const collectDtsFiles = (dir: string): string[] => {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectDtsFiles(fullPath));
    } else if (entry.name.endsWith(".d.ts")) {
      results.push(fullPath);
    }
  }
  return results;
};

/**
 * Relative specifiers in emitted declarations, in every syntactic position
 * TypeScript can put one: `import`/`export ... from "x"` and the `import("x")`
 * type node.
 */
const RELATIVE_SPECIFIER = /(from\s*"|import\(\s*")(\.\.?\/[^"]*)(")/g;

/**
 * Rewrites extensionless relative specifiers in a declaration file to carry the
 * `.js` extension its runtime counterpart has.
 *
 * Source keeps extensionless imports — the repo's convention, and what
 * `moduleResolution: "Bundler"` allows — but `node16`/`nodenext` consumers
 * resolve declaration imports the same way they resolve runtime ones, so a
 * published `.d.ts` saying `from "./helpers"` fails for them while bundler and
 * CJS consumers stay green. Adding the extension here keeps both true.
 *
 * Deliberately strict: an unresolvable specifier throws rather than passing
 * through, because passing it through is exactly the silent breakage this
 * exists to prevent.
 */
const addDeclarationExtensions = (dtsPath: string, contents: string): string =>
  contents.replace(RELATIVE_SPECIFIER, (match, prefix: string, spec: string, suffix: string) => {
    if (/\.(js|cjs|mjs|json)$/.test(spec)) return match;

    const target = join(dirname(dtsPath), spec);
    if (existsSync(`${target}.d.ts`)) return `${prefix}${spec}.js${suffix}`;
    if (existsSync(join(target, "index.d.ts"))) return `${prefix}${spec}/index.js${suffix}`;

    throw new Error(
      `[copy-types] ${dtsPath}: cannot resolve "${spec}" to an emitted declaration. ` +
        `Expected ${spec}.d.ts or ${spec}/index.d.ts next to it.`
    );
  });

const distDir = process.argv[2] ?? "dist";
const entryTypeFiles = collectDtsFiles(distDir);

if (entryTypeFiles.length === 0) {
  console.warn(`[copy-types] Missing declaration files in ${distDir}, skipping .d.cts generation.`);
  process.exit(0);
}

for (const dtsPath of entryTypeFiles) {
  const name = basename(dtsPath, ".d.ts");
  const dctsPath = join(dirname(dtsPath), `${name}.d.cts`);
  const dtsMapPath = join(dirname(dtsPath), `${name}.d.ts.map`);
  const dctsMapPath = join(dirname(dtsPath), `${name}.d.cts.map`);
  const original = readFileSync(dtsPath, "utf8");
  const dts = addDeclarationExtensions(dtsPath, original);
  if (dts !== original) writeFileSync(dtsPath, dts, "utf8");

  const dtsSourceMapComment = `//# sourceMappingURL=${name}.d.ts.map`;
  const dctsSourceMapComment = `//# sourceMappingURL=${name}.d.cts.map`;
  const dcts = dts.split(dtsSourceMapComment).join(dctsSourceMapComment);

  writeFileSync(dctsPath, dcts, "utf8");

  if (existsSync(dtsMapPath)) {
    const map = JSON.parse(readFileSync(dtsMapPath, "utf8"));
    map.file = `${name}.d.cts`;
    writeFileSync(dctsMapPath, JSON.stringify(map), "utf8");
  }
}
