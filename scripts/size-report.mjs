import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const collectJsFiles = (dir) => {
  const entries = readdirSync(dir);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectJsFiles(fullPath));
      continue;
    }
    if (entry.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files.sort();
};

const files = collectJsFiles("dist");

for (const file of files) {
  const content = readFileSync(file);
  const gzip = gzipSync(content);
  console.log(`${file}: ${content.byteLength} bytes (${gzip.byteLength} bytes gzip)`);
}
