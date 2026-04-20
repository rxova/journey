import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const defaultRepoRoot = process.cwd();

export type ApiTSDocSource = {
  packageName: string;
  entry: string;
  tsconfig: string;
};

export type MissingTSDocItem = {
  packageName: string;
  exportName: string;
  source: string;
};

type LogFn = (message: string) => void;
type ExitFn = (code: number) => void;

type PackageManifest = {
  name?: unknown;
  private?: unknown;
};

export function resolveApiTSDocSources(repoRoot: string = defaultRepoRoot): ApiTSDocSource[] {
  const packagesDir = path.join(repoRoot, "packages");
  if (!existsSync(packagesDir)) {
    return [];
  }

  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort()
    .map((dirName): ApiTSDocSource | null => {
      const packageJsonPath = path.join(packagesDir, dirName, "package.json");
      if (!existsSync(packageJsonPath)) {
        return null;
      }

      let manifest: PackageManifest;
      try {
        manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageManifest;
      } catch {
        return null;
      }

      if (manifest.private === true || typeof manifest.name !== "string") {
        return null;
      }

      const entryRelative = path.posix.join("packages", dirName, "src/index.ts");
      const tsconfigRelative = path.posix.join("packages", dirName, "tsconfig.json");
      if (!existsSync(path.join(repoRoot, entryRelative))) {
        return null;
      }
      if (!existsSync(path.join(repoRoot, tsconfigRelative))) {
        return null;
      }

      return {
        packageName: manifest.name,
        entry: entryRelative,
        tsconfig: tsconfigRelative
      };
    })
    .filter((entry): entry is ApiTSDocSource => entry !== null);
}

export function toRepoPath(repoRoot: string, ...parts: string[]): string {
  return path.join(repoRoot, ...parts);
}

function formatDiagnostic(diag: ts.Diagnostic): string {
  return ts.flattenDiagnosticMessageText(diag.messageText, "\n");
}

export function parseTsConfig(tsconfigPath: string): ts.ParsedCommandLine {
  const loaded = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (loaded.error) {
    throw new Error(`Failed to read ${tsconfigPath}: ${formatDiagnostic(loaded.error)}`);
  }

  const parsed = ts.parseJsonConfigFileContent(
    loaded.config,
    ts.sys,
    path.dirname(tsconfigPath),
    { noEmit: true },
    tsconfigPath
  );

  if (parsed.errors.length > 0) {
    const firstError = parsed.errors[0];
    if (!firstError) {
      throw new Error(`Failed to parse ${tsconfigPath}: unknown parse error`);
    }
    throw new Error(`Failed to parse ${tsconfigPath}: ${formatDiagnostic(firstError)}`);
  }

  return parsed;
}

function resolveSymbol(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
  if (symbol.flags & ts.SymbolFlags.Alias) {
    try {
      return checker.getAliasedSymbol(symbol);
    } catch {
      return symbol;
    }
  }
  return symbol;
}

function hasFunctionDeclaration(declaration: ts.Declaration): boolean {
  return (
    declaration.kind === ts.SyntaxKind.FunctionDeclaration ||
    declaration.kind === ts.SyntaxKind.MethodDeclaration ||
    declaration.kind === ts.SyntaxKind.MethodSignature
  );
}

function symbolRequiresSummary(
  symbol: ts.Symbol,
  declarations: ts.Declaration[],
  checker: ts.TypeChecker
): boolean {
  if (declarations.some((declaration) => hasFunctionDeclaration(declaration))) {
    return true;
  }

  const declaration = declarations.find(
    (candidate) =>
      candidate.kind === ts.SyntaxKind.VariableDeclaration ||
      candidate.kind === ts.SyntaxKind.VariableStatement
  );

  if (!declaration) {
    return false;
  }

  const target = symbol.valueDeclaration ?? declaration;
  if (!target) {
    return false;
  }

  const symbolType = checker.getTypeOfSymbolAtLocation(symbol, target);
  return symbolType.getCallSignatures().length > 0;
}

function declarationSource(declaration: ts.Declaration, repoRoot: string): string {
  const sourceFile = declaration.getSourceFile();
  const relativePath = path.relative(repoRoot, sourceFile.fileName).replace(/\\/g, "/");
  const location = ts.getLineAndCharacterOfPosition(sourceFile, declaration.getStart(sourceFile));
  return `${relativePath}:${location.line + 1}`;
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

export function collectMissingTSDocForSource(
  entry: ApiTSDocSource,
  repoRoot = defaultRepoRoot
): MissingTSDocItem[] {
  const tsconfigPath = toRepoPath(repoRoot, entry.tsconfig);
  const entryPath = toRepoPath(repoRoot, entry.entry);
  const parsed = parseTsConfig(tsconfigPath);

  const rootNames = Array.from(new Set([...parsed.fileNames, entryPath]));
  const createProgramOptions: ts.CreateProgramOptions = {
    rootNames,
    options: {
      ...parsed.options,
      noEmit: true
    }
  };
  if (parsed.projectReferences) {
    createProgramOptions.projectReferences = parsed.projectReferences;
  }

  const program = ts.createProgram(createProgramOptions);
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(entryPath);

  if (!sourceFile) {
    throw new Error(`Missing entry source file: ${entry.entry}`);
  }

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    throw new Error(`Cannot resolve module symbol for: ${entry.entry}`);
  }

  return checker
    .getExportsOfModule(moduleSymbol)
    .filter((symbol) => symbol.getName() !== "default" && !symbol.getName().startsWith("__"))
    .map((symbol) => {
      const resolved = resolveSymbol(symbol, checker);
      const declarations =
        resolved.getDeclarations()?.filter((declaration) => !ts.isSourceFile(declaration)) ?? [];

      if (declarations.length === 0 || !symbolRequiresSummary(resolved, declarations, checker)) {
        return null;
      }

      const summary = ts.displayPartsToString(resolved.getDocumentationComment(checker)).trim();
      if (summary.length > 0) {
        return null;
      }

      const firstDeclaration = declarations[0];
      if (!firstDeclaration) {
        return null;
      }

      return {
        packageName: entry.packageName,
        exportName: symbol.getName(),
        source: declarationSource(firstDeclaration, repoRoot)
      };
    })
    .filter(isNotNull)
    .sort((a, b) => a.exportName.localeCompare(b.exportName));
}

type CheckPublicApiTSDocOptions = {
  repoRoot?: string;
  sources?: readonly ApiTSDocSource[];
  log?: LogFn;
  error?: LogFn;
  exit?: ExitFn;
};

export function checkPublicApiTSDoc({
  repoRoot = defaultRepoRoot,
  sources,
  log = console.log,
  error = console.error,
  exit = (code) => process.exit(code)
}: CheckPublicApiTSDocOptions = {}): { missing: MissingTSDocItem[] } {
  const resolvedSources = sources ?? resolveApiTSDocSources(repoRoot);
  const missing = resolvedSources.flatMap((entry) => collectMissingTSDocForSource(entry, repoRoot));

  if (missing.length > 0) {
    error("Public API TSDoc summaries are missing. Add JSDoc/TSDoc to these exports:");
    for (const item of missing) {
      error(`- ${item.packageName}#${item.exportName} (${item.source})`);
    }
    exit(1);
    return { missing };
  }

  log("Public API TSDoc summaries are up to date.");
  return { missing };
}

export function main(
  options: CheckPublicApiTSDocOptions = {}
): { missing: MissingTSDocItem[] } {
  return checkPublicApiTSDoc(options);
}

export function isEntrypoint(
  entryArg: string | undefined = process.argv[1],
  moduleUrl = import.meta.url
): boolean {
  if (!entryArg) return false;
  return pathToFileURL(entryArg).href === moduleUrl;
}

/* c8 ignore next 3 */
if (isEntrypoint()) {
  main();
}
