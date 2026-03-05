export type ReleaseNoteSource = {
  source: string;
  target: string;
  title: string;
  description: string;
};

export type SyncReleaseNotesResult = {
  updated: string[];
};

export type CheckReleaseNotesResult = {
  stale: string[];
};

export const releaseNoteSources: ReleaseNoteSource[];

export function toRepoPath(repoRoot: string, ...parts: string[]): string;
export function readUtf8(filePath: string): string;
export function normalizeChangelog(markdown: string): string;
export function renderReleaseDoc(entry: ReleaseNoteSource | undefined, body: string): string;
export function expectedContent(entry: ReleaseNoteSource | undefined, repoRoot?: string): string;
export function writeIfChanged(filePath: string, content: string): boolean;
export function checkMatches(filePath: string, content: string): boolean;
export function syncReleaseNotes(options?: {
  repoRoot?: string;
  sources?: ReleaseNoteSource[];
  log?: (message: string) => void;
}): SyncReleaseNotesResult;
export function checkReleaseNotes(options?: {
  repoRoot?: string;
  sources?: ReleaseNoteSource[];
  log?: (message: string) => void;
  error?: (message: string) => void;
  exit?: (code: number) => void;
}): CheckReleaseNotesResult;
export function main(options?: {
  argv?: string[];
  repoRoot?: string;
  sources?: ReleaseNoteSource[];
  log?: (message: string) => void;
  error?: (message: string) => void;
  exit?: (code: number) => void;
}): {
  updated?: string[];
  stale?: string[];
};
export function isEntrypoint(entryArg?: string, moduleUrl?: string): boolean;
