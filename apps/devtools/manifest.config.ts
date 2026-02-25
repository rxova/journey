import { defineManifest } from "@crxjs/vite-plugin";
import packageJson from "./package.json";

const DYNAMIC_CONTENT_ENTRY_MATCH = ["http://*/*", "https://*/*"] as const;
const DEFAULT_HOST_PERMISSIONS = [
  "http://localhost/*",
  "https://localhost/*",
  "http://127.0.0.1/*",
  "https://127.0.0.1/*"
] as const;
const OPTIONAL_SITE_HOST_PERMISSIONS = ["http://*/*", "https://*/*"] as const;

export default defineManifest({
  manifest_version: 3,
  name: "Rxova Journey Devtools",
  version: packageJson.version,
  description: "Inspect and control Rxova Journey machines from Chrome DevTools.",
  devtools_page: "src/devtools.html",
  background: {
    service_worker: "src/background.ts",
    type: "module"
  },
  content_scripts: [
    {
      // Kept as a build entry. Runtime injection is handled from the background worker.
      matches: [...DYNAMIC_CONTENT_ENTRY_MATCH],
      js: ["src/content.ts"],
      run_at: "document_start"
    }
  ],
  permissions: ["scripting", "activeTab"],
  host_permissions: [...DEFAULT_HOST_PERMISSIONS],
  optional_host_permissions: [...OPTIONAL_SITE_HOST_PERMISSIONS],
  icons: {
    16: "icons/icon16.png",
    32: "icons/icon32.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png"
  }
});
