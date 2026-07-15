import React from "react";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";
import type { LinearJourneyMachine } from "@rxova/journey-react";

import { loginJourney } from "./journey";
import { initialContext } from "./context";
import type { LoginContext } from "./context";
import { Shell } from "./components/Shell";
import { Login } from "./steps/Login";
import { Setup2fa } from "./steps/Setup2fa";
import { VerifyCode } from "./steps/VerifyCode";
import { LoggedIn } from "./steps/LoggedIn";

const { LinearJourney } = loginJourney;

export default function App() {
  // Devtools attach per machine instance (the linear journey owns its machine).
  const detachRef = React.useRef<(() => void) | null>(null);
  const handleMachineRef = React.useCallback(
    (machine: LinearJourneyMachine<LoginContext> | null) => {
      detachRef.current?.();
      detachRef.current = null;
      if (machine) {
        detachRef.current = attachJourneyDevtools(machine as never, {
          machineId: "react-showcase-linear",
          label: "React Showcase Linear",
          appName: "React Showcase Linear",
          enabled: true,
          mutationsEnabled: true
        });
      }
    },
    []
  );

  return (
    <LinearJourney
      context={initialContext}
      wrapper={<Shell />}
      fallback={<p>Unknown step</p>}
      machineRef={handleMachineRef}
      onStart={({ stepId }) => console.log("[react linear] journey.started at", stepId)}
      onComplete={({ context }) => console.log("[react linear] journey.completed", context)}
    >
      <Login id="login" />
      <Setup2fa id="setup2fa" />
      <VerifyCode id="verifyCode" />
      <LinearJourney.Step id="loggedIn" meta={{ label: "Logged In" }}>
        <LoggedIn />
      </LinearJourney.Step>
    </LinearJourney>
  );
}
