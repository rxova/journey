import { dirname, resolve, relative, sep } from "node:path";
import { visit } from "unist-util-visit";

/**
 * Rewrites relative `./foo.md` links between docs pages into real site URLs.
 *
 * Astro resolved these automatically for Markdown under `src/pages`, but the
 * content layer does not: a content collection entry is data, not a route, so
 * nothing rewrites its links and `./architecture.md` ships to the browser
 * verbatim and 404s. There is no build error and `starlight-links-validator`
 * skips relative links by design, so the failure is completely silent — it is
 * live right now on the sibling use-everywhere docs site, which made the same
 * assumption during its own Docusaurus migration.
 *
 * Writing the links as absolute site paths instead would trade this bug for the
 * one the aggregator build exists to catch: `/core/architecture/` is correct at
 * the domain root and wrong under /packages/journey/. Resolving them here keeps
 * the source portable and the output base-aware.
 *
 * @param {{ contentDir: string, base: string }} options
 */
export function rehypeRelativeDocLinks({ contentDir, base }) {
  const prefix = `/${base.replace(/^\/|\/$/g, "")}`.replace(/^\/$/, "");

  return (tree, file) => {
    const from = file.history?.[0] ?? file.path;
    if (!from) return;

    visit(tree, "element", (node) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string" || !href.startsWith(".")) return;

      const [path, hash] = href.split("#");
      if (!/\.mdx?$/.test(path)) return;

      // Lowercased because that is what the content layer does when it derives
      // a slug from a file name. Every hand-written page is already lowercase,
      // so this was invisible until the generated TypeDoc trees arrived with
      // CamelCase file names: `../type-aliases/CurrentStepBase.md` produced a
      // link to /CurrentStepBase/ while the page was served at
      // /currentstepbase/.
      const slug = relative(contentDir, resolve(dirname(from), path))
        .replace(/\.mdx?$/, "")
        .split(sep)
        .join("/")
        .toLowerCase();

      node.properties.href = `${prefix}/${slug}/${hash ? `#${hash}` : ""}`;
    });
  };
}
