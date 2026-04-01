import { describe, expect, it } from "vitest";
import { toChromeManifestVersion } from "../chrome-manifest-version";

describe("toChromeManifestVersion", () => {
  it("maps stable semver to a Chrome-safe release version", () => {
    expect(toChromeManifestVersion("1.0.0")).toEqual({
      version: "1.0.0.65535",
      versionName: "1.0.0"
    });
  });

  it("maps prerelease semver into a lower Chrome build number and preserves the display version", () => {
    expect(toChromeManifestVersion("1.0.0-rc.1")).toEqual({
      version: "1.0.0.40001",
      versionName: "1.0.0-rc.1"
    });
  });

  it("keeps prerelease ordering monotonic within the same release line", () => {
    const alpha = toChromeManifestVersion("1.0.0-alpha.2");
    const beta = toChromeManifestVersion("1.0.0-beta.1");
    const rc = toChromeManifestVersion("1.0.0-rc.1");
    const stable = toChromeManifestVersion("1.0.0");

    expect(alpha.version).toBe("1.0.0.10002");
    expect(beta.version).toBe("1.0.0.20001");
    expect(rc.version).toBe("1.0.0.40001");
    expect(stable.version).toBe("1.0.0.65535");
  });

  it("rejects versions that cannot be represented in a Chrome manifest", () => {
    expect(() => toChromeManifestVersion("1.0")).toThrow(/Invalid package version/);
    expect(() => toChromeManifestVersion("70000.0.0")).toThrow(/must be <= 65535/);
  });
});
