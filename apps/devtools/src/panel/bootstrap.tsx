import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { syncTheme } from "./theme";

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
