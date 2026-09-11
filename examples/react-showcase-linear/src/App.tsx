import React from "react";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

import { loginJourney } from "./journey";
import { Shell } from "./components/Shell";
import { Login } from "./steps/Login";
import { Setup2fa } from "./steps/Setup2fa";
import { VerifyCode } from "./steps/VerifyCode";
import { LoggedIn } from "./steps/LoggedIn";

export default function App() {
  // The machine is standalone on the bundle — devtools attach to it directly.
  React.useEffect(
    () =>
      attachJourneyDevtools(loginJourney.machine as never, {
        machineId: "react-showcase-linear",
        label: "React Showcase Linear",
        appName: "React Showcase Linear",
        enabled: true,
        mutationsEnabled: true
      }),
    []
  );

  return (
    <loginJourney.Provider
      views={{
        login: <Login />,
        setup2fa: <Setup2fa />,
        verifyCode: <VerifyCode />,
        loggedIn: <LoggedIn />
      }}
    >
      <Shell>
        <loginJourney.StepRenderer fallback={<p>Starting…</p>} />
      </Shell>
    </loginJourney.Provider>
  );
}
