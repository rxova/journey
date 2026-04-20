export type ThemeName = "dark" | "light";

export type DevtoolsThemeName = "dark" | "default";

type DevtoolsPanelsWithThemeHandler = typeof chrome.devtools.panels & {
  setThemeChangeHandler?: (callback?: (theme: DevtoolsThemeName) => void) => void;
  themeName?: string;
};

const getDevtoolsPanels = (): DevtoolsPanelsWithThemeHandler | undefined =>
  typeof chrome === "undefined"
    ? undefined
    : (chrome.devtools?.panels as DevtoolsPanelsWithThemeHandler | undefined);

export const applyTheme = (theme: ThemeName) => {
  document.documentElement.dataset.theme = theme;
};

export const guessSystemTheme = (mediaQuery?: MediaQueryList): ThemeName =>
  mediaQuery?.matches ? "dark" : "light";

export const normalizeTheme = (value: unknown): ThemeName | undefined => {
  if (value === "dark") {
    return "dark";
  }

  if (value === "default" || value === "light") {
    return "light";
  }

  return undefined;
};

export const syncTheme = () => {
  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
  const devtoolsPanels = getDevtoolsPanels();

  const updateTheme = (themeName?: DevtoolsThemeName) => {
    const chromeTheme = normalizeTheme(themeName ?? devtoolsPanels?.themeName);
    applyTheme(chromeTheme ?? guessSystemTheme(mediaQuery));
  };

  updateTheme();
  devtoolsPanels?.setThemeChangeHandler?.(updateTheme);

  if (typeof mediaQuery?.addEventListener === "function") {
    mediaQuery.addEventListener("change", () => updateTheme());
    return;
  }

  mediaQuery?.addListener?.(() => updateTheme());
};
