import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "Rxova Journey",
  tagline: "Declarative journey graphs for non-linear UI flows.",
  favicon: "img/rxova-logo-256.png",

  future: {
    v4: true
  },

  url: "https://rxova.org",
  baseUrl: "/",

  organizationName: "rxova",
  projectName: "journey",

  onBrokenLinks: "throw",

  i18n: {
    defaultLocale: "en",
    locales: ["en"]
  },

  presets: [
    [
      "classic",
      {
        docs: false,
        blog: false,
        theme: {
          customCss: "./src/css/custom.css"
        }
      } satisfies Preset.Options
    ]
  ],

  plugins: [
    [
      "@docusaurus/plugin-content-docs",
      {
        id: "core",
        path: "docs/core",
        routeBasePath: "docs/core",
        sidebarPath: "./sidebars/core.ts",
        editUrl: "https://github.com/rxova/journey/tree/main/apps/docs/",
        lastVersion: "current",
        versions: {
          current: {
            label: "0.6.1"
          }
        }
      }
    ],
    [
      "@docusaurus/plugin-content-docs",
      {
        id: "react",
        path: "docs/react",
        routeBasePath: "docs/react",
        sidebarPath: "./sidebars/react.ts",
        editUrl: "https://github.com/rxova/journey/tree/main/apps/docs/",
        lastVersion: "current",
        versions: {
          current: {
            label: "0.6.1"
          }
        }
      }
    ],
    [
      "@docusaurus/plugin-content-docs",
      {
        id: "bridge",
        path: "docs/bridge",
        sidebarPath: "./sidebars/bridge.ts",
        routeBasePath: "docs/bridge",
        editUrl: "https://github.com/rxova/journey/tree/main/apps/docs/",
        lastVersion: "current",
        versions: {
          current: {
            label: "0.6.1"
          }
        }
      }
    ],
    [
      "@docusaurus/plugin-content-docs",
      {
        id: "chrome-devtools",
        path: "docs/devtool",
        routeBasePath: "docs/devtool",
        sidebarPath: "./sidebars/chrome-devtools.ts",
        editUrl: "https://github.com/rxova/journey/tree/main/apps/docs/",
        lastVersion: "current",
        versions: {
          current: {
            label: "0.6.1"
          }
        }
      }
    ],
    [
      "@easyops-cn/docusaurus-search-local",
      {
        hashed: true,
        indexDocs: true,
        indexBlog: false
      }
    ]
  ],

  themeConfig: {
    image: "img/rxova-logo-1024.png",
    colorMode: {
      defaultMode: "light",
      respectPrefersColorScheme: false
    },
    navbar: {
      title: "Rxova Journey",
      logo: {
        alt: "Rxova Journey Mark",
        src: "img/rxova-logo-256.png",
        srcDark: "img/rxova-logo-256.png",
        width: 34,
        height: 34
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "coreSidebar",
          docsPluginId: "core",
          position: "left",
          label: "Core"
        },
        {
          type: "docSidebar",
          sidebarId: "reactSidebar",
          docsPluginId: "react",
          position: "left",
          label: "React"
        },
        {
          type: "docSidebar",
          sidebarId: "bridgeSidebar",
          docsPluginId: "bridge",
          position: "left",
          label: "Bridge"
        },
        {
          type: "docSidebar",
          sidebarId: "chromeDevtoolsSidebar",
          docsPluginId: "chrome-devtools",
          position: "left",
          label: "Chrome DevTools"
        },
        {
          href: "https://github.com/rxova/journey",
          label: "GitHub",
          className: "header-github-link",
          "aria-label": "GitHub repository",
          position: "right"
        }
      ]
    },
    footer: {
      style: "dark",
      copyright: `Copyright © ${new Date().getFullYear()} Rxova.`
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula
    }
  } satisfies Preset.ThemeConfig
};

export default config;
