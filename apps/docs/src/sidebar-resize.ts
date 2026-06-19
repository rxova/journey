const STORAGE_KEY = "journey-docs:sidebar-width";
const MIN_WIDTH = 200;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 300;
const HANDLE_ID = "sidebar-resize-handle";

function getSavedWidth(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const w = parseInt(saved ?? "", 10);
    if (Number.isFinite(w) && w >= MIN_WIDTH && w <= MAX_WIDTH) return w;
  } catch {
    // localStorage unavailable (SSR or private browsing)
  }
  return DEFAULT_WIDTH;
}

function setWidth(px: number): void {
  document.documentElement.style.setProperty("--doc-sidebar-width", `${px}px`);
}

function init(): void {
  setWidth(getSavedWidth());

  const container = document.querySelector<HTMLElement>(".theme-doc-sidebar-container");
  if (!container || container.querySelector(`#${HANDLE_ID}`)) return;

  const handle = document.createElement("div");
  handle.id = HANDLE_ID;
  handle.setAttribute("aria-hidden", "true");
  container.appendChild(handle);

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth =
      parseInt(
        getComputedStyle(document.documentElement).getPropertyValue("--doc-sidebar-width"),
        10
      ) || DEFAULT_WIDTH;

    container.style.setProperty("transition", "none", "important");
    document.body.dataset.sidebarResizing = "true";

    const onMove = (e: MouseEvent) => {
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + e.clientX - startX)));
    };

    const onUp = (e: MouseEvent) => {
      const final = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + e.clientX - startX));
      try {
        localStorage.setItem(STORAGE_KEY, String(final));
      } catch {
        // localStorage unavailable
      }
      container.style.removeProperty("transition");
      delete document.body.dataset.sidebarResizing;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

export function onRouteDidUpdate(): void {
  requestAnimationFrame(init);
}

if (typeof window !== "undefined") {
  setWidth(getSavedWidth());
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    requestAnimationFrame(init);
  }
}
