import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "Rxova Journey",
  tagline: "Declarative journey graphs for non-linear UI flows.",
  favicon: "img/rxova-logo-256.png",

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true // Improve compatibility with the upcoming Docusaurus v4
  },

  // Production URL/domain
  url: "https://rxova.org",
  // Serve docs at the domain root
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "rxova", // Usually your GitHub org/user name.
  projectName: "journey", // Usually your repo name.

  onBrokenLinks: "throw",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"]
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/rxova/journey/tree/main/apps/docs/"
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css"
        }
      } satisfies Preset.Options
    ]
  ],
  plugins: [
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
    // Replace with your project's social card
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
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs"
        },
        {
          href: "https://github.com/rxova/journey",
          label: "GitHub",
          position: "right"
        },
        {
          href: "https://www.npmjs.com/package/@rxova/journey-core",
          label: "Core",
          position: "right"
        },
        {
          href: "https://www.npmjs.com/package/@rxova/journey-react",
          label: "React",
          position: "right"
        },
        {
          href: "https://www.npmjs.com/package/@rxova/journey-vue",
          label: "Vue",
          position: "right"
        }
      ]
    },
    footer: {
      style: "dark",
      links: [
        {
          items: [
            {
              label: "Docs",
              to: "/docs/core/getting-started"
            },
            {
              label: "React Guide",
              to: "/docs/react/overview"
            },
            {
              label: "Vue Guide",
              to: "/docs/vue/overview"
            },
            {
              label: "@rxova/journey-core",
              href: "https://www.npmjs.com/package/@rxova/journey-core"
            },
            {
              label: "@rxova/journey-react",
              href: "https://www.npmjs.com/package/@rxova/journey-react"
            },
            {
              label: "@rxova/journey-vue",
              href: "https://www.npmjs.com/package/@rxova/journey-vue"
            },
            {
              label: "GitHub",
              href: "https://github.com/rxova/journey"
            }
          ]
        }
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Rxova.`
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["typescript", "tsx"]
    }
  } satisfies Preset.ThemeConfig
};

export default config;
