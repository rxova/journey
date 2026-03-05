export type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: Array<number | string>;
};

export type SyncResult = {
  updated: boolean;
  targetVersion: string;
};

export function readJson(filePath: string): unknown;
export function parseVersion(version: string): ParsedVersion;
export function syncRootVersion(
  repoRoot: string,
  options?: {
    log?: (message: string) => void;
  }
): SyncResult;
export function runChangesetVersion(options?: {
  runner?: (file: string, args: string[], options: { cwd: string; stdio: string }) => void;
  cwd?: string;
  stdio?: string;
}): void;
export function main(options?: {
  repoRoot?: string;
  runChangesetVersionFn?: (options: { cwd: string; stdio: string }) => void;
  syncRootVersionFn?: (repoRoot: string) => SyncResult;
}): SyncResult;
export function isEntrypoint(entryArg?: string, moduleUrl?: string): boolean;
