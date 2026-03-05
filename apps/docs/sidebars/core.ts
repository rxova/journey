import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  coreSidebar: [
    "overview",
    "architecture",
    "typescript",
    "getting-started",
    {
      type: "category",
      label: "API",
      items: ["api/overview", "api/transitions-syntax"]
    },
    {
      type: "category",
      label: "State & Runtime",
      items: ["snapshot", "lifecycle", "async"]
    },
    {
      type: "category",
      label: "Durability",
      items: ["history", "persistence"]
    },
    "recipes",
    "examples",
    "faq"
  ]
};

export default sidebars;
