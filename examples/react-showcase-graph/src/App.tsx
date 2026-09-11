import React from "react";
import { journey } from "./journey";
import type { StepId } from "./journey";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";
import { Shell } from "./components/Shell";
import { Login } from "./steps/Login";
import { Setup2fa } from "./steps/Setup2fa";
import { VerifyCode } from "./steps/VerifyCode";
import { EmailCode } from "./steps/EmailCode";
import { AuthenticatorCode } from "./steps/AuthenticatorCode";
import { LoggedIn } from "./steps/LoggedIn";
import { Blocked } from "./steps/Blocked";

const views: Record<StepId, React.ReactNode> = {
  login: <Login />,
  setup2fa: <Setup2fa />,
  verifyCode: <VerifyCode />,
  emailCode: <EmailCode />,
  authenticatorCode: <AuthenticatorCode />,
  loggedIn: <LoggedIn />,
  blocked: <Blocked />
};

const EventLogger = () => {
  journey.useSubscribeEvent("statusChange", (event) => {
    console.log(`[react graph] ${event.previous} -> ${event.current}`, event);
  });
  return null;
};

export default function App() {
  // The machine is standalone on the bundle — devtools attach to it directly.
  React.useEffect(
    () =>
      attachJourneyDevtools(journey.machine as never, {
        label: "React Showcase Graph",
        appName: "React Showcase Graph",
        enabled: true,
        mutationsEnabled: true
      }),
    []
  );

  return (
    <journey.Provider views={views}>
      <EventLogger />
      <Shell>
        <journey.StepRenderer fallback={<p>Unknown step</p>} />
      </Shell>
    </journey.Provider>
  );
}
