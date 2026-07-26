/**
 * One-shot migration of the Docusaurus docs tree into Starlight's content
 * collection. Kept in the repo rather than run-and-deleted so the transforms it
 * applied are auditable next to the diff they produced.
 *
 * Docusaurus and Starlight differ in the ways that mattered here:
 *
 *  1. Docusaurus takes a page's title from its first H1. Starlight requires an
 *     explicit `title` in frontmatter and renders it itself — so the H1 has to
 *     be lifted up, and then removed, or every page renders its title twice.
 *  2. Docusaurus has `:::info` and `:::warning` asides. Starlight has `note`,
 *     `tip`, `caution` and `danger`, so those two need mapping. Titled asides
 *     also change syntax: `:::tip Some title` -> `:::tip[Some title]`. Getting
 *     that wrong does not fail the build — remark simply stops recognising the
 *     directive and the block renders as literal `:::tip ... :::` text.
 *  3. Links were absolute doc-id paths (`/docs/core/recipes`). Those only ever
 *     resolved because Docusaurus served the docs at the domain root; under the
 *     rxova.org aggregator the site is mounted at /packages/journey/ and every
 *     one of them would 404. They become relative file links, which Astro
 *     resolves against the content collection and rewrites to the final URL,
 *     base path included. The `.md` extension is kept on purpose — stripping it
 *     leaves a literal relative URL that breaks the moment the site is mounted.
 *  4. Sidebar order and grouping lived in `sidebars/*.ts`. Starlight declares
 *     the sidebar in astro.config.mjs, so those are translated by hand there
 *     rather than encoded per page.
 *  5. `@theme/Tabs` and `@site/src/components/DocAccordion` are Docusaurus
 *     imports. Three files use them; they are repointed at local Starlight
 *     equivalents and renamed to `.mdx`.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";

const SRC = "docs";
const DEST = "src/content/docs";

/** Docusaurus aside type -> Starlight equivalent. */
const ASIDES = { info: "note", warning: "caution" };

/** Docusaurus routeBasePath -> content collection directory. */
const SECTIONS = { core: "core", react: "react", bridge: "bridge", devtool: "devtool" };

/**
 * `docs/core/api/overview.md` carried `slug: /api`, so seven pages link to it as
 * `/docs/core/api` — a URL with no matching file. Starlight derives slugs from
 * file paths, so the page keeps its real location and those links are pointed
 * at it directly.
 */
const SLUG_ALIASES = { "core/api": "core/api/overview" };

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".md") || entry.endsWith(".mdx")) out.push(full);
  }
  return out;
}

function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { data: {}, body: text };
  const data = {};
  for (const line of match[1].split("\n")) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line.trim());
    if (kv) data[kv[1]] = kv[2].trim();
  }
  return { data, body: text.slice(match[0].length) };
}

/** Escape a title for a double-quoted YAML scalar. */
const yamlString = (s) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * `/docs/core/architecture/send#queue` seen from `docs/core/overview.md`
 * becomes `./architecture/send.md#queue`. Posix separators: these end up in
 * markdown, not on disk.
 */
function toRelativeLink(fromFile, target) {
  const [path, hash = ""] = target.split("#");
  const withoutPrefix = path.replace(/^\/docs\//, "").replace(/\/$/, "");
  const resolved = SLUG_ALIASES[withoutPrefix] ?? withoutPrefix;
  const [section, ...rest] = resolved.split("/");
  if (!SECTIONS[section]) return null;

  const targetFile = join(SRC, section, `${rest.join("/")}.md`);
  let rel = relative(dirname(fromFile), targetFile).split(sep).join("/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return hash ? `${rel}#${hash}` : rel;
}

const stats = { files: 0, lifted: 0, asides: 0, asideTitles: 0, links: 0, mdx: 0, labels: 0 };
const unresolved = [];

for (const file of walk(SRC)) {
  const raw = readFileSync(file, "utf8");
  const { data, body: originalBody } = parseFrontmatter(raw);
  let body = originalBody;
  stats.files++;

  // 1. Repoint the three files that import components, before the H1 lift —
  //    the imports sit above the H1 in the Docusaurus sources.
  const usesComponents = /@theme\/Tabs|@theme\/TabItem|@site\/src\/components\/DocAccordion/.test(
    body
  );
  if (usesComponents) {
    body = body
      .replace(/^import Tabs from "@theme\/Tabs";\n/m, "")
      .replace(
        /^import TabItem from "@theme\/TabItem";\n/m,
        `import { Tabs, TabItem } from '@astrojs/starlight/components';\n`
      )
      .replace(
        /^import DocAccordion, \{ DocAccordionItem \} from "@site\/src\/components\/DocAccordion";\n/m,
        `import DocAccordion from '../../../components/DocAccordion.astro';\nimport DocAccordionItem from '../../../components/DocAccordionItem.astro';\n`
      );
    // Starlight's TabItem keys off `label` alone; Docusaurus also carried a
    // `value` used for tab-group syncing, which has no equivalent here.
    body = body.replace(/<TabItem\s+value="[^"]*"\s+/g, "<TabItem ");
    stats.mdx++;
  }

  // 2. Lift the first H1 into `title` and drop it from the body.
  let title = data.title;
  const h1 = /^#\s+(.+?)\s*$/m.exec(body);
  if (!title && h1) {
    title = h1[1];
    body = body.replace(h1[0], "").replace(/^\n+/, "");
    stats.lifted++;
  }
  if (!title) throw new Error(`${file}: no title and no H1 to lift`);

  // 3. Map the asides Starlight does not have, and bracket titled asides.
  body = body.replace(/^:::(\w+)([ \t]+(?!\[)(.+?))?[ \t]*$/gm, (whole, kind, _sp, rawTitle) => {
    const mapped = ASIDES[kind] ?? kind;
    if (!ASIDES[kind] && !rawTitle) return whole;
    if (ASIDES[kind]) stats.asides++;
    if (rawTitle) stats.asideTitles++;
    return rawTitle ? `:::${mapped}[${rawTitle}]` : `:::${mapped}`;
  });

  // 4. Screenshots moved from `static/img/` (served verbatim at the domain
  //    root) into `src/assets/`, so Astro's image pipeline optimises them and,
  //    more to the point, rewrites the URL. An absolute `/img/...` is invisible
  //    in a root build and 404s the moment the site is mounted at
  //    /packages/journey/ — the exact failure the second CI build exists to
  //    catch, but for assets rather than links.
  body = body.replace(
    /\]\(\/img\//g,
    `](${"../".repeat(relative(SRC, file).split(sep).length + 2)}assets/`
  );

  // 5. Absolute doc-id links -> relative file links.
  body = body.replace(/\]\((\/docs\/[^)\s]*)\)/g, (whole, target) => {
    const rel = toRelativeLink(file, target);
    if (!rel) {
      unresolved.push(`${file}: ${target}`);
      return whole;
    }
    stats.links++;
    return `](${rel})`;
  });

  const front = [`title: ${yamlString(title.replace(/`/g, ""))}`];
  if (data.description) front.push(`description: ${data.description}`);
  // 22 pages have a `sidebar_label` that differs from the title — "Core
  // Examples" in the heading, "Examples" in the nav. Starlight nests it under
  // `sidebar.label`; dropping it would rename a fifth of the nav entries.
  if (data.sidebar_label && data.sidebar_label !== title) {
    front.push(`sidebar:\n  label: ${yamlString(data.sidebar_label)}`);
    stats.labels++;
  }

  const target = join(DEST, relative(SRC, file)).replace(/\.md$/, usesComponents ? ".mdx" : ".md");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `---\n${front.join("\n")}\n---\n\n${body.trimStart()}`);
}

console.log(`migrated ${stats.files} files`);
console.log(`  titles lifted from H1:  ${stats.lifted}`);
console.log(`  asides remapped:        ${stats.asides}`);
console.log(`  aside titles bracketed: ${stats.asideTitles}`);
console.log(`  absolute links rewired: ${stats.links}`);
console.log(`  files needing MDX:      ${stats.mdx}`);
console.log(`  sidebar labels kept:    ${stats.labels}`);
if (unresolved.length) {
  console.log(`\n  UNRESOLVED (${unresolved.length}):`);
  for (const entry of unresolved) console.log(`    ${entry}`);
}
