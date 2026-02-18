import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./panel.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Panel root element not found.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
