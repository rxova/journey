import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

type VersionBump = "patch" | "minor" | "major";

type ParsedArgs = {
  packageToken: string;
  bump: VersionBump;
  summary: string;
};

type PackageMeta = {
  name: string;
  shortNames: string[];
};

export type MainResult = {
  filePath: string;
  packageName: string;
  bump: VersionBump;
};

const VALID_BUMPS: readonly VersionBump[] = ["patch", "minor", "major"];

const readJson = <T>(filePath: string): T => {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
};

const listVersionedWorkspacePackages = (repoRoot: string): PackageMeta[] => {
  const configPath = path.join(repoRoot, ".changeset", "config.json");
  const config = readJson<{ ignore?: string[] }>(configPath);
  const ignored = new Set(config.ignore ?? []);
  const packageRoots = ["packages", "apps"];
  const packages: PackageMeta[] = [];

  for (const root of packageRoots) {
    const rootPath = path.join(repoRoot, root);
    let directories: string[];
    try {
      directories = readdirSync(rootPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      continue;
    }

    for (const directory of directories) {
      const packageJsonPath = path.join(rootPath, directory, "package.json");
      let packageJson: { name?: string };
      try {
        packageJson = readJson<{ name?: string }>(packageJsonPath);
      } catch {
        continue;
      }

      const packageName = packageJson.name?.trim();
      if (!packageName || ignored.has(packageName)) {
        continue;
      }

      const withoutScope = packageName.replace(/^@[^/]+\//, "");
      const withoutJourneyPrefix = withoutScope.replace(/^journey-/, "");
      const directoryAlias = directory.replace(/^journey-/, "");
      const shortNames = Array.from(
        new Set([
          packageName.toLowerCase(),
          withoutScope.toLowerCase(),
          withoutJourneyPrefix.toLowerCase(),
          directory.toLowerCase(),
          directoryAlias.toLowerCase()
        ])
      );

      packages.push({
        name: packageName,
        shortNames
      });
    }
  }

  packages.sort((a, b) => a.name.localeCompare(b.name));
  return packages;
};

const resolvePackageName = (packageToken: string, packages: readonly PackageMeta[]): string => {
  const normalizedToken = packageToken.trim().toLowerCase();
  if (!normalizedToken) {
    throw new Error("Missing package name token.");
  }

  const matches = packages.filter((candidate) => candidate.shortNames.includes(normalizedToken));
  if (matches.length === 1) {
    return matches[0]!.name;
  }

  if (matches.length > 1) {
    throw new Error(
      `Ambiguous package token "${packageToken}". Matched: ${matches.map((m) => m.name).join(", ")}`
    );
  }

  throw new Error(`Unknown package token "${packageToken}".`);
};

const parseVersionBump = (value: string): VersionBump => {
  if (VALID_BUMPS.includes(value as VersionBump)) {
    return value as VersionBump;
  }
  throw new Error(`Invalid bump "${value}". Expected one of: ${VALID_BUMPS.join(", ")}`);
};

const parseArgs = (argv: readonly string[]): ParsedArgs => {
  let packageToken = "";
  let bump: VersionBump | "" = "";
  const summaryParts: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token === "--package" || token === "-p") {
      packageToken = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--type" || token === "-t") {
      bump = parseVersionBump(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (token === "--summary" || token === "-s") {
      summaryParts.push(...argv.slice(index + 1));
      break;
    }

    if (!packageToken) {
      packageToken = token;
      continue;
    }
    if (!bump) {
      bump = parseVersionBump(token);
      continue;
    }

    summaryParts.push(token);
  }

  const summary = summaryParts.join(" ").trim();
  if (!packageToken || !bump || !summary) {
    throw new Error("Usage: changeset:pkg <package> <patch|minor|major> <summary>");
  }

  return { packageToken, bump, summary };
};

const buildChangesetFileContent = (
  packageName: string,
  bump: VersionBump,
  summary: string
): string => {
  return `---\n"${packageName}": ${bump}\n---\n\n${summary.trim()}\n`;
};

const createFileName = (packageName: string): string => {
  const packageSegment = packageName
    .replace(/^@/, "")
    .replace(/[^\w-]+/g, "-")
    .toLowerCase();
  const nonce = Date.now().toString(36);
  return `${packageSegment}-${nonce}.md`;
};

const printHelp = (packages: readonly PackageMeta[]): void => {
  console.log("Create a one-package changeset entry.");
  console.log("");
  console.log("Usage:");
  console.log("  pnpm run changeset:pkg -- <package> <patch|minor|major> <summary>");
  console.log("  pnpm run changeset:pkg -- -p <package> -t <patch|minor|major> -s <summary>");
  console.log("");
  console.log("Examples:");
  console.log('  pnpm run changeset:pkg -- core minor "Add async transition helpers."');
  console.log(
    '  pnpm run changeset:pkg -- @rxova/journey-react patch "Fix selector cache edge-case."'
  );
  console.log("");
  console.log("Known package tokens:");
  for (const pkg of packages) {
    console.log(`  - ${pkg.name}`);
  }
};

export const run = (
  argv: readonly string[] = process.argv.slice(2),
  repoRoot: string = process.cwd()
): MainResult => {
  const packages = listVersionedWorkspacePackages(repoRoot);

  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp(packages);
    process.exit(0);
  }

  const parsed = parseArgs(argv);
  const packageName = resolvePackageName(parsed.packageToken, packages);

  const changesetDir = path.join(repoRoot, ".changeset");
  mkdirSync(changesetDir, { recursive: true });

  const fileName = createFileName(packageName);
  const filePath = path.join(changesetDir, fileName);
  const content = buildChangesetFileContent(packageName, parsed.bump, parsed.summary);
  writeFileSync(filePath, content, "utf8");

  const relativePath = path.relative(repoRoot, filePath) || filePath;
  console.log(`Created ${relativePath}`);
  console.log(`Package: ${packageName}`);
  console.log(`Bump: ${parsed.bump}`);
  return {
    filePath,
    packageName,
    bump: parsed.bump
  };
};

export const isEntrypoint = (
  entryArg: string | undefined = process.argv[1],
  moduleUrl: string = import.meta.url
): boolean => {
  if (!entryArg) return false;
  return pathToFileURL(entryArg).href === moduleUrl;
};

/* c8 ignore next 5 */
if (isEntrypoint()) {
  try {
    run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
