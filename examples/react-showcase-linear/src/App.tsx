import React from "react";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

import { loginJourney } from "./journey";
import type { LoginJourneyMachine } from "./journey";
import { Shell } from "./components/Shell";
import { Login } from "./steps/Login";
import { Setup2fa } from "./steps/Setup2fa";
import { VerifyCode } from "./steps/VerifyCode";
import { LoggedIn } from "./steps/LoggedIn";

export default function App() {
  // Devtools attach per machine instance (each Provider mount owns a machine).
  const detachRef = React.useRef<(() => void) | null>(null);
  const handleMachineRef = React.useCallback((machine: LoginJourneyMachine | null) => {
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
  }, []);

  return (
    <loginJourney.Provider
      wrapper={<Shell />}
      fallback={<p>Starting…</p>}
      machineRef={handleMachineRef}
      onStart={(snapshot) =>
        console.log("[react linear] journey.started at", snapshot.currentStep.id)
      }
      onComplete={({ snapshot }) =>
        console.log("[react linear] journey.completed", snapshot.context)
      }
    >
      <loginJourney.Step id="login">
        <Login />
      </loginJourney.Step>
      <loginJourney.Step id="setup2fa">
        <Setup2fa />
      </loginJourney.Step>
      <loginJourney.Step id="verifyCode">
        <VerifyCode />
      </loginJourney.Step>
      <loginJourney.Step id="loggedIn">
        <LoggedIn />
      </loginJourney.Step>
    </loginJourney.Provider>
  );
}
