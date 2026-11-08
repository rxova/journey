import { mountReactPluginDemo } from "./demo/react/plugin-demo";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
mountReactPluginDemo("persistence", root);
