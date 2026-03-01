import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: "category",
      label: "Core",
      collapsed: false,
      items: [
        "core/overview",
        "core/getting-started",
        "core/architecture",
        "core/api",
        {
          type: "category",
          label: "State & Runtime",
          items: ["core/snapshot", "core/lifecycle", "core/async"]
        },
        {
          type: "category",
          label: "Durability",
          items: ["core/history", "core/persistence"]
        },
        "core/recipes",
        "core/examples",
        "core/faq"
      ]
    },
    {
      type: "category",
      label: "React",
      collapsed: false,
      items: [
        "react/overview",
        "react/quickstart",
        "react/provider-and-hooks",
        "react/patterns",
        "react/async-ui",
        "react/examples"
      ]
    },
    {
      type: "category",
      label: "Devtool (Coming Soon)",
      collapsed: false,
      items: [
        "devtool/overview",
        "devtool/getting-started",
        "devtool/bridge-api",
        "devtool/panel-guide",
        "devtool/protocol",
        "devtool/examples",
        "devtool/troubleshooting",
        "devtool/web-store",
        "devtool/privacy-policy"
      ]
    }
  ]
};

export default sidebars;
