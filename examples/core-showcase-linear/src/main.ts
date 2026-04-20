import { mountCoreShowcase } from "./demo/core/showcase-demo";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
void mountCoreShowcase("linear", root);
