import React from "react";
import { PanelProvider } from "./context/PanelProvider";
import { AppShell } from "./components/AppShell";

export const App = () => (
  <PanelProvider>
    <AppShell />
  </PanelProvider>
);
