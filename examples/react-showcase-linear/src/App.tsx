import React from "react";
import { Wizard } from "@rxova/journey-react";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

import { initialContext } from "./context";
import type { LoginContext } from "./context";
import { Shell } from "./components/Shell";
import { Login } from "./steps/Login";
import { Setup2fa } from "./steps/Setup2fa";
import { VerifyCode } from "./steps/VerifyCode";
import { LoggedIn } from "./steps/LoggedIn";

export default function App() {
  // Devtools attach per machine instance (the wizard owns its machine now).
  const detachRef = React.useRef<(() => void) | null>(null);
  const handleMachineRef = React.useCallback((machine: unknown) => {
    detachRef.current?.();
    detachRef.current = null;
    if (machine) {
      detachRef.current = attachJourneyDevtools(machine as never, {
        machineId: "react-showcase-linear",
        label: "React Showcase Linear",
        appName: "React Showcase Linear",
        enabled: true,
        commandsEnabled: true
      });
    }
  }, []);

  return (
    <Wizard
      context={initialContext}
      wrapper={<Shell />}
      fallback={<p>Unknown step</p>}
      machineRef={handleMachineRef}
      onComplete={({ context }) => console.log("[react linear] journey.completed", context)}
    >
      <Login id="login" />
      <Setup2fa id="setup2fa" />
      <VerifyCode id="verifyCode" />
      <Wizard.Step
        id="loggedIn"
        meta={{ label: "Logged In" }}
        onEnter={({ context, dispatch }) => {
          if ((context as LoginContext).attempts >= 3) {
            void dispatch({ type: "terminateJourney" });
            return;
          }
          void dispatch({ type: "completeJourney" });
        }}
      >
        <LoggedIn />
      </Wizard.Step>
    </Wizard>
  );
}
