import React from "react";
import ReactDOM from "react-dom/client";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";
import App from "./App";
import { journey } from "./journey";
import "./demo/styles/demo.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

attachJourneyDevtools(journey.machine, {
  machineId: "react-showcase-linear",
  label: "React Showcase Linear",
  appName: "React Showcase Linear",
  enabled: true,
  commandsEnabled: true
});

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
