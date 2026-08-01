import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const dist = new URL("../dist/", import.meta.url);
const filename = "rxova-page-bundle.json";
const manifest = {
  schema: 2,
  format: "html-page-component",
  project: "journey",
  base: "/packages/journey/"
};
await writeFile(new URL(filename, dist), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`Wrote ${join("apps/docs/dist", filename)}\n`);
