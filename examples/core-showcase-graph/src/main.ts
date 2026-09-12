import { mountCoreShowcase } from "./demo/core/showcase-demo";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
const { unmount } = mountCoreShowcase(root);

// Tear the old machine and listeners down before Vite swaps the module in.
import.meta.hot?.dispose(unmount);
