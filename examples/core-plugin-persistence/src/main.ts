import { mountCorePluginDemo } from "./demo/core/plugin-demo";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
void mountCorePluginDemo("persistence", root);
