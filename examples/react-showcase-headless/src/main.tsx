import React from "react";
import ReactDOM from "react-dom/client";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";
import App from "./App";
import { machine } from "./machine";
import "./demo/styles/demo.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

attachJourneyDevtools(machine, {
  machineId: "react-showcase-headless",
  label: "React Showcase Headless",
  appName: "React Showcase Headless",
  enabled: true,
  commandsEnabled: true
});

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
