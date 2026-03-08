import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

export type ThemeName = "dark" | "light";
export type DevtoolsThemeName = "dark" | "default";

type DevtoolsPanelsWithThemeHandler = typeof chrome.devtools.panels & {
  setThemeChangeHandler?: (callback?: (theme: DevtoolsThemeName) => void) => void;
  themeName?: string;
};

function getDevtoolsPanels(): DevtoolsPanelsWithThemeHandler | undefined {
  return typeof chrome === "undefined"
    ? undefined
    : (chrome.devtools?.panels as DevtoolsPanelsWithThemeHandler | undefined);
}

export function applyTheme(theme: ThemeName) {
  // Align with apps/docs convention.
  document.documentElement.dataset.theme = theme;
}

export function guessSystemTheme(mediaQuery?: MediaQueryList): ThemeName {
  return mediaQuery?.matches ? "dark" : "light";
}

export function normalizeTheme(value: unknown): ThemeName | undefined {
  if (value === "dark") {
    return "dark";
  }

  if (value === "default" || value === "light") {
    return "light";
  }

  return undefined;
}

export function syncTheme() {
  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
  const devtoolsPanels = getDevtoolsPanels();

  const updateTheme = (themeName?: DevtoolsThemeName) => {
    const chromeTheme = normalizeTheme(themeName ?? devtoolsPanels?.themeName);

    applyTheme(chromeTheme ?? guessSystemTheme(mediaQuery));
  };

  updateTheme();

  devtoolsPanels?.setThemeChangeHandler?.(updateTheme);

  // Track system theme changes when the panel is not driven by a DevTools theme.
  if (typeof mediaQuery?.addEventListener === "function") {
    mediaQuery.addEventListener("change", () => updateTheme());
  } else {
    mediaQuery?.addListener?.(() => updateTheme());
  }
}

export function mountPanel(rootElement = document.getElementById("root")) {
  if (!rootElement) {
    throw new Error("Panel root element not found.");
  }

  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

export function bootstrapPanel() {
  syncTheme();
  mountPanel();
}
