import React, { type ChangeEvent } from "react";
import {
  useActiveDocContext,
  useDocsVersion,
  useVersions
} from "@docusaurus/plugin-content-docs/client";

import styles from "./styles.module.css";

const VERSION_PREFIX_BY_PLUGIN: Record<string, string> = {
  core: "Core",
  react: "React",
  bridge: "Bridge",
  "chrome-devtools": "Chrome DevTools"
};

function getTargetPath(
  versionName: string,
  pluginVersionPath: string,
  alternateDocVersions: Record<string, { path: string }> | undefined
): string {
  const alternatePath = alternateDocVersions?.[versionName]?.path;
  return alternatePath ?? pluginVersionPath;
}

export default function DocsVersionControls(): React.JSX.Element {
  const docsVersion = useDocsVersion();
  const versions = useVersions(docsVersion.pluginId);
  const activeDocContext = useActiveDocContext(docsVersion.pluginId);

  const prefix = VERSION_PREFIX_BY_PLUGIN[docsVersion.pluginId];
  const showDropdown = Boolean(prefix) && versions.length > 1;
  const chipLabel = prefix ? `${prefix} ${docsVersion.label}` : docsVersion.label;

  const handleVersionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const versionName = event.target.value;
    const selectedVersion = versions.find((version) => version.name === versionName);
    if (!selectedVersion) {
      return;
    }

    const targetPath = getTargetPath(
      selectedVersion.name,
      selectedVersion.path,
      activeDocContext?.alternateDocVersions as Record<string, { path: string }> | undefined
    );
    window.location.assign(targetPath);
  };

  return (
    <div className={styles.wrap}>
      {showDropdown ? (
        <label className={styles.dropdownWrap}>
          <span className={styles.dropdownLabel}>{prefix}</span>
          <select
            className={styles.dropdown}
            value={docsVersion.version}
            onChange={handleVersionChange}
            aria-label={`${prefix} docs version`}
          >
            {versions.map((version) => (
              <option key={version.name} value={version.name}>
                {version.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span className={styles.chip}>{chipLabel}</span>
      )}
    </div>
  );
}
