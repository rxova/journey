import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLinksValidator from "starlight-links-validator";
import sitemap from "@astrojs/sitemap";
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

  // Two pages the branch folded into others, kept as redirects rather than
  // dropped: they were live URLs under Docusaurus and are still linked from
  // outside the site. Docusaurus expressed these as <Redirect> stub pages,
  // which has no Starlight equivalent — the stubs are gone and the mapping
  // lives here instead. The branch's third stub, /core/usage, needs no entry:
  // usage/index.md already resolves to that exact URL.
  redirects: {
    "/core/about": "/core/overview",
    "/core/runtime-reference": "/core/concepts"
  },

  // Two pages (core/architecture, core/architecture/work-and-transitions) carry
  // ```mermaid fences. Docusaurus rendered them via @docusaurus/theme-mermaid;
  // Starlight has no built-in equivalent, and every drop-in (rehype-mermaid)
  // wants a headless browser at build time — which is the one thing the
  // pre-push gate in packages/common/tooling/verify.ts deliberately avoids
  // needing. Left as code blocks, which are readable but not diagrams. Wiring a
  // client-side renderer is a follow-up, not a rebase decision.
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
    // Nothing here enumerated these pages for a crawler. Fifty-eight pages of
    // prose answering the questions people actually type — branching wizards,
    // step history, guards that are async — and the only way into any of it was
    // following links from a site with no inbound ones.
    //
    // Emitted at the mount, not the domain root: under the aggregator this build
    // lives at /packages/journey/, so the file lands at <base>sitemap-index.xml
    // and claims only URLs beneath that prefix, which is the scope a sitemap at
    // a subpath is allowed to claim. rxova.org's root robots.txt is what points
    // at it — this build cannot serve a robots.txt any crawler would honour,
    // because robots.txt is read only from the origin root and this build never
    // owns one.
    sitemap({
      // The 404 page is served *as* a 404. Offering it invites Google to index
      // the error page itself, which is the standard way to earn a soft-404
      // flag. It is the only route here that is not a destination: this build
      // has no redirects and no non-HTML endpoints.
      filter: (page) => !/\/404\/?$/.test(new URL(page).pathname)
    }),
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
        // A direct transcription of the branch's four sidebars/*.ts files,
        // entry for entry, the same way the Docusaurus originals were
        // transcribed here before. The Core nav is task-shaped (Learn / Use it
        // / Understand it / Extend it / Reference) rather than
        // directory-shaped, which is why it stays spelled out: `autogenerate`
        // keys off directory structure and would flatten every one of those
        // groups. The trailing "API reference" groups are the TypeDoc output,
        // generated into the content collection by the `prebuild` hook.
        sidebar: [
          {
            label: "Core",
            items: [
              {
                label: "Learn",
                collapsed: false,
                items: ["core/overview", "core/getting-started", "core/concepts"]
              },
              {
                label: "Use it",
                collapsed: false,
                items: [
                  "core/usage/linear",
                  "core/usage/graph",
                  "core/usage/headless",
                  "core/usage/step-behavior",
                  "core/effects",
                  "core/handlers",
                  "core/recipes",
                  "core/examples"
                ]
              },
              {
                label: "Understand it",
                collapsed: true,
                items: [
                  {
                    label: "How it works",
                    collapsed: true,
                    items: [
                      "core/architecture",
                      "core/architecture/runtime",
                      "core/architecture/store",
                      "core/architecture/machine-surface",
                      "core/architecture/plugin-host",
                      "core/architecture/work-and-transitions"
                    ]
                  },
                  "core/snapshot",
                  "core/lifecycle",
                  "core/async",
                  "core/history"
                ]
              },
              {
                label: "Extend it",
                collapsed: true,
                items: [
                  {
                    label: "Connectors",
                    collapsed: true,
                    items: ["core/connectors/overview", "core/connectors/immer"]
                  },
                  "core/plugins/overview",
                  "core/plugins/authoring",
                  "core/persistence",
                  "core/autosave",
                  "core/plugins/analytics-plugin",
                  "core/plugins/replay-plugin",
                  "core/plugins/diagnostics-plugin",
                  "core/plugins/execution-paths-plugin",
                  "core/plugins/subscription-enhancer-plugin"
                ]
              },
              {
                label: "Reference",
                collapsed: true,
                items: [
                  "core/api/overview",
                  "core/api/machine-api",
                  "core/api/transitions-syntax",
                  "core/api/graph-builder",
                  "core/typescript",
                  "core/coming-from-xstate",
                  "core/stability",
                  "core/pre-1-0-migration",
                  "core/faq",
                  "core/releases"
                ]
              },
              {
                label: "API reference",
                collapsed: true,
                items: [
                  {
                    label: "Functions",
                    collapsed: true,
                    items: [{ autogenerate: { directory: "core/api/reference/functions" } }]
                  },
                  {
                    label: "Type aliases",
                    collapsed: true,
                    items: [{ autogenerate: { directory: "core/api/reference/type-aliases" } }]
                  }
                ]
              }
            ]
          },
          {
            label: "React",
            items: [
              { label: "Learn", collapsed: false, items: ["react/overview", "react/quickstart"] },
              {
                label: "Use it",
                collapsed: false,
                items: [
                  "react/provider-and-hooks",
                  "react/async-ui",
                  "react/patterns",
                  "react/examples"
                ]
              },
              {
                label: "Reference",
                collapsed: true,
                items: ["react/typescript", "react/devtools", "react/releases"]
              },
              {
                label: "API reference",
                collapsed: true,
                items: [{ autogenerate: { directory: "react/api/reference" } }]
              }
            ]
          },
          {
            label: "Bridge",
            items: [
              { label: "Learn", collapsed: false, items: ["bridge/getting-started"] },
              {
                label: "Use it",
                collapsed: false,
                items: ["bridge/bridge-api", "bridge/examples"]
              },
              {
                label: "Reference",
                collapsed: true,
                items: ["bridge/protocol", "bridge/releases"]
              },
              {
                label: "API reference",
                collapsed: true,
                items: [
                  {
                    label: "Functions",
                    collapsed: true,
                    items: [{ autogenerate: { directory: "bridge/api/reference/functions" } }]
                  },
                  {
                    label: "Type aliases",
                    collapsed: true,
                    items: [{ autogenerate: { directory: "bridge/api/reference/type-aliases" } }]
                  },
                  {
                    label: "Variables",
                    collapsed: true,
                    items: [{ autogenerate: { directory: "bridge/api/reference/variables" } }]
                  }
                ]
              }
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
