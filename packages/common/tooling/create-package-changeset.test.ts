import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { run } from "./create-package-changeset";

const setupRepo = async () => {
  const root = await mkdtemp(join(tmpdir(), "create-package-changeset-"));

  await mkdir(join(root, ".changeset"), { recursive: true });
  await writeFile(
    join(root, ".changeset", "config.json"),
    JSON.stringify({ ignore: ["apps-demo"] }, null, 2),
    "utf8"
  );

  await mkdir(join(root, "packages", "core"), { recursive: true });
  await mkdir(join(root, "packages", "react"), { recursive: true });
  await mkdir(join(root, "packages", "devtools-bridge"), { recursive: true });
  await mkdir(join(root, "apps", "docs"), { recursive: true });
  await mkdir(join(root, "apps", "demo"), { recursive: true });

  await writeFile(
    join(root, "packages", "core", "package.json"),
    JSON.stringify({ name: "@rxova/journey-core", version: "0.6.4" }, null, 2),
    "utf8"
  );
  await writeFile(
    join(root, "packages", "react", "package.json"),
    JSON.stringify({ name: "@rxova/journey-react", version: "0.6.4" }, null, 2),
    "utf8"
  );
  await writeFile(
    join(root, "packages", "devtools-bridge", "package.json"),
    JSON.stringify({ name: "@rxova/journey-devtools-bridge", version: "0.6.4" }, null, 2),
    "utf8"
  );
  await writeFile(
    join(root, "apps", "docs", "package.json"),
    JSON.stringify({ name: "apps-docs", version: "0.6.3" }, null, 2),
    "utf8"
  );
  await writeFile(
    join(root, "apps", "demo", "package.json"),
    JSON.stringify({ name: "apps-demo", version: "0.0.0" }, null, 2),
    "utf8"
  );

  return root;
};

describe("create-package-changeset script", () => {
  it("creates one-package changeset using short package token", async () => {
    const root = await setupRepo();
    try {
      const result = run(["core", "minor", "Core specific update"], root);
      const created = await readFile(result.filePath, "utf8");

      expect(result.packageName).toBe("@rxova/journey-core");
      expect(result.bump).toBe("minor");
      expect(created).toContain('"@rxova/journey-core": minor');
      expect(created).toContain("Core specific update");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("supports flags and full package names", async () => {
    const root = await setupRepo();
    try {
      const result = run(
        ["--package", "@rxova/journey-react", "--type", "patch", "--summary", "React summary"],
        root
      );
      const created = await readFile(result.filePath, "utf8");

      expect(result.packageName).toBe("@rxova/journey-react");
      expect(created).toContain('"@rxova/journey-react": patch');
      expect(created).toContain("React summary");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects ignored packages", async () => {
    const root = await setupRepo();
    try {
      expect(() => run(["apps-demo", "patch", "Should fail"], root)).toThrow(
        'Unknown package token "apps-demo".'
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
