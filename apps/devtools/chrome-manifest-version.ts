const CHROME_VERSION_PART_MAX = 65_535;
const CHROME_RELEASE_BUILD = CHROME_VERSION_PART_MAX;
const CHROME_PRERELEASE_SEQUENCE_MAX = 9_999;
const CHROME_UNKNOWN_PRERELEASE_BASE = 50_000;
const SEMVER_PATTERN =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+(?<build>[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

const PRERELEASE_CHANNEL_BASES: Readonly<Record<string, number>> = {
  dev: 0,
  nightly: 0,
  canary: 0,
  alpha: 10_000,
  a: 10_000,
  beta: 20_000,
  b: 20_000,
  pre: 30_000,
  preview: 30_000,
  rc: 40_000
};

export type ChromeManifestVersion = Readonly<{
  version: string;
  versionName: string;
}>;

function assertChromeVersionPart(part: number, label: "major" | "minor" | "patch"): void {
  if (part > CHROME_VERSION_PART_MAX) {
    throw new Error(
      `Chrome extension ${label} version part must be <= ${CHROME_VERSION_PART_MAX}. Received ${part}.`
    );
  }
}

function toPrereleaseSequence(identifiers: readonly string[]): number {
  let sequence = 0;

  for (const identifier of identifiers) {
    if (!/^\d+$/.test(identifier)) {
      continue;
    }

    sequence = Math.min(
      CHROME_PRERELEASE_SEQUENCE_MAX,
      sequence * 100 + Number.parseInt(identifier, 10)
    );
  }

  return sequence;
}

function toPrereleaseBuild(prerelease: string): number {
  const identifiers = prerelease.split(".");
  const [channelIdentifier, ...remainingIdentifiers] = identifiers;

  if (channelIdentifier === undefined) {
    return 0;
  }

  if (/^\d+$/.test(channelIdentifier)) {
    return Math.min(CHROME_PRERELEASE_SEQUENCE_MAX, Number.parseInt(channelIdentifier, 10));
  }

  const channel = channelIdentifier.toLowerCase();
  const base = PRERELEASE_CHANNEL_BASES[channel] ?? CHROME_UNKNOWN_PRERELEASE_BASE;
  const sequence = toPrereleaseSequence(remainingIdentifiers);

  return Math.min(CHROME_RELEASE_BUILD - 1, base + sequence);
}

export function toChromeManifestVersion(versionName: string): ChromeManifestVersion {
  const match = SEMVER_PATTERN.exec(versionName);

  if (match?.groups === undefined) {
    throw new Error(
      `Invalid package version "${versionName}". Expected a semver string that can be converted to a Chrome extension manifest version.`
    );
  }

  const { major: majorText, minor: minorText, patch: patchText, prerelease } = match.groups;

  if (majorText === undefined || minorText === undefined || patchText === undefined) {
    throw new Error(`Invalid package version "${versionName}". Missing semver release parts.`);
  }

  const major = Number.parseInt(majorText, 10);
  const minor = Number.parseInt(minorText, 10);
  const patch = Number.parseInt(patchText, 10);

  assertChromeVersionPart(major, "major");
  assertChromeVersionPart(minor, "minor");
  assertChromeVersionPart(patch, "patch");

  const build = prerelease === undefined ? CHROME_RELEASE_BUILD : toPrereleaseBuild(prerelease);

  return {
    version: `${major}.${minor}.${patch}.${build}`,
    versionName
  };
}
