/**
 * Adds Starlight frontmatter to the TypeDoc output.
 *
 * typedoc-plugin-markdown emits plain markdown with the symbol name as an H1.
 * Docusaurus took a page's title from that H1, so the generated trees needed no
 * frontmatter. Starlight's content collection requires an explicit `title` and
 * renders it itself, so without this every generated page fails the collection
 * schema — and the ones that got through would render their title twice.
 *
 * The H1 is lifted and dropped, exactly as apps/docs/scripts/migrate-content.js
 * did for the hand-written pages. `sidebar.label` is set from the file name
 * (the bare symbol) rather than the title, because the title carries the kind
 * and the type parameters — "Type Alias: CurrentStepBase<TStepId, TMeta>" is
 * accurate on the page and unreadable in a nav column.
 *
 * Runs after typedoc in the `docs:api:generate` chain; the trees it rewrites are
 * generated output and are gitignored/prettierignored.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";

const ROOTS = ["core", "react", "bridge"].map((s) =>
  join("apps/docs/src/content/docs", s, "api/reference")
);

/** Escape for a double-quoted YAML scalar, after undoing markdown escaping. */
const yamlString = (s) =>
  `"${s
    .replace(/\\([<>[\]|_*`])/g, "$1")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')}"`;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}

let written = 0;
for (const root of ROOTS) {
  if (!existsSync(root)) continue;
  for (const file of walk(root)) {
    const raw = readFileSync(file, "utf8");
    if (raw.startsWith("---\n")) continue; // already stamped

    const h1 = /^#\s+(.+?)\s*$/m.exec(raw);
    const stem = basename(file, extname(file));
    const title = h1 ? h1[1] : stem;
    const body = h1 ? raw.replace(h1[0], "").replace(/^\n+/, "") : raw;

    // README.md is the module index for its directory; the sidebar sources the
    // per-kind subfolders rather than the directory root, so it is never linked
    // from the nav — it still needs a title to satisfy the schema.
    const label = stem === "README" ? "Index" : stem;

    const front = `---\ntitle: ${yamlString(title)}\nsidebar:\n  label: ${yamlString(label)}\n---\n\n`;
    writeFileSync(file, front + body.trimStart());
    written++;
  }
}

console.log(`stamped frontmatter on ${written} generated API reference pages`);
