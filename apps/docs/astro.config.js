import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLinksValidator from "starlight-links-validator";
import { sharedStarlightConfig } from "@rxova/brand";
import { fileURLToPath } from "node:url";
import { unified } from "@astrojs/markdown-remark";
import { rehypeRelativeDocLinks } from "./src/plugins/rehype-relative-doc-links.js";

/**
 * Defaults keep journey's standalone build at the domain root; the rxova.org
 * aggregator sets DOCS_URL / DOCS_BASE_URL to mount these docs under
 * /packages/journey/. Same contract the Docusaurus config had.
 */
const site = process.env.DOCS_URL ?? "https://rxova.org";
const base = process.env.DOCS_BASE_URL ?? "/";

const contentDir = fileURLToPath(new URL("./src/content/docs", import.meta.url));

export default defineConfig({
  site,
  base,

  markdown: {
    // Resolves the 168 relative `./foo.md` links the migration produced into
    // real, base-aware URLs. Without it they ship verbatim and 404 — see the
    // plugin for why nothing else in the pipeline catches that.
    //
    // `processor: unified({...})` rather than a bare `markdown.rehypePlugins`:
    // Astro 7 deprecated the flat form and warns on every build.
    processor: unified({
      rehypePlugins: [[rehypeRelativeDocLinks, { contentDir, base }]]
    })
  },

  integrations: [
    starlight({
      ...sharedStarlightConfig({
        project: "journey",
        // These docs ship as a page component: rxova.org composes each rendered
        // body into its own header and footer, so this build must not draw the
        // umbrella footer itself. It was doing that by overriding Starlight's
        // `Footer` with a local wrapper around the default, and reconciling the
        // two sticky headers in a `page-component.css` of its own — both copies
        // of what @rxova/brand ships behind this flag since 0.9.0. One flag now
        // says what the build is, and the theme owns how that looks.
        pageComponent: true,
        customCss: ["./src/styles/journey.css"],
        // Docusaurus served the four products as four plugin instances with a
        // navbar tab each. Starlight is one site with one sidebar, so they
        // become four top-level groups.
        //
        // Spelled out rather than `autogenerate`d: the Core sidebar groups
        // pages that live in the same directory ("Overview", "Runtime
        // Reference") and pulls `persistence` and `autosave` up into "Plugins"
        // from outside `plugins/`. Autogeneration keys off directory structure
        // alone, so it would flatten both. This is a direct transcription of
        // the four sidebars/*.ts files, entry for entry.
        sidebar: [
          {
            label: "Core",
            items: [
              "core/getting-started",
              {
                label: "Overview",
                collapsed: false,
                items: [
                  "core/overview",
                  "core/about",
                  "core/stability",
                  "core/pre-1-0-migration",
                  "core/typescript",
                  "core/usage",
                  "core/recipes",
                  "core/examples"
                ]
              },
              {
                label: "Machine Architecture",
                collapsed: false,
                items: [
                  "core/architecture",
                  "core/architecture/create-journey-machine",
                  "core/architecture/journey-definition-resolver",
                  "core/architecture/plugin-controller",
                  "core/architecture/runtime",
                  "core/architecture/async-state",
                  "core/architecture/navigation",
                  "core/architecture/send",
                  "core/architecture/controls",
                  "core/architecture/helpers"
                ]
              },
              {
                label: "Plugins",
                items: [
                  "core/plugins/overview",
                  "core/plugins/authoring",
                  "core/persistence",
                  "core/autosave",
                  "core/plugins/analytics-plugin",
                  "core/plugins/replay-plugin",
                  "core/plugins/diagnostics-plugin",
                  "core/plugins/execution-paths-plugin"
                ]
              },
              {
                label: "API",
                items: [
                  "core/api/overview",
                  "core/api/transitions-syntax",
                  "core/api/graph-builder"
                ]
              },
              {
                label: "Runtime Reference",
                collapsed: false,
                items: [
                  "core/runtime-reference",
                  "core/snapshot",
                  "core/lifecycle",
                  "core/async",
                  "core/history"
                ]
              },
              "core/comparison",
              "core/faq",
              "core/releases"
            ]
          },
          {
            label: "React",
            items: [
              "react/overview",
              "react/quickstart",
              "react/provider-and-hooks",
              "react/patterns",
              "react/async-ui",
              "react/devtools",
              "react/examples",
              "react/releases"
            ]
          },
          {
            label: "Bridge",
            items: [
              "bridge/getting-started",
              "bridge/bridge-api",
              "bridge/protocol",
              "bridge/examples",
              "bridge/releases"
            ]
          },
          {
            label: "Chrome DevTools",
            items: [
              "devtool/overview",
              "devtool/panel-guide",
              "devtool/troubleshooting",
              "devtool/web-store",
              "devtool/privacy-policy",
              "devtool/releases"
            ]
          }
        ]
      }),

      // Overrides the shared default of '/favicon.svg'. There is no vector
      // rxova mark yet — only the logo PNGs — so this site ships the PNG from
      // its own public/ directory. Starlight resolves `favicon` against the
      // site's static directory, so it cannot be served from @rxova/brand.
      favicon: "/favicon.png",

      plugins: [
        // The failure mode this migration is most exposed to: the Docusaurus
        // site wrote ~90 absolute links of the form `/docs/core/foo`, resolved
        // by doc id. Those are now relative file links, and this fails the
        // build on any that did not survive the rewrite.
        starlightLinksValidator({ errorOnRelativeLinks: false })
      ]
    })
  ]
});
