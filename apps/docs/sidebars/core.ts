import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  coreSidebar: [
    "getting-started",
    {
      type: "category",
      label: "Overview",
      collapsed: false,
      items: [
        "overview",
        "about",
        "stability",
        "pre-1-0-migration",
        "typescript",
        "usage",
        "recipes",
        "examples"
      ]
    },
    {
      type: "category",
      label: "Machine Architecture",
      collapsed: false,
      items: [
        "architecture",
        "architecture/create-journey-machine",
        "architecture/journey-definition-resolver",
        "architecture/plugin-controller",
        "architecture/runtime",
        "architecture/async-state",
        "architecture/navigation",
        "architecture/send",
        "architecture/controls",
        "architecture/helpers"
      ]
    },
    {
      type: "category",
      label: "Plugins",
      items: [
        "plugins/overview",
        "plugins/authoring",
        "persistence",
        "autosave",
        "plugins/analytics-plugin",
        "plugins/replay-plugin",
        "plugins/diagnostics-plugin",
        "plugins/execution-paths-plugin"
      ]
    },
    {
      type: "category",
      label: "API",
      items: ["api/overview", "api/transitions-syntax", "api/graph-builder"]
    },
    {
      type: "category",
      label: "Runtime Reference",
      collapsed: false,
      items: ["runtime-reference", "snapshot", "lifecycle", "async", "history"]
    },
    "comparison",
    "faq",
    "releases"
  ]
};

export default sidebars;
