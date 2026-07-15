import React from "react";
import { useJourneyEvent, useJourneySnapshot } from "./machine";
import type { StepId } from "./machine";
import { Shell } from "./components/Shell";
import { Login } from "./steps/Login";
import { Setup2fa } from "./steps/Setup2fa";
import { VerifyCode } from "./steps/VerifyCode";
import { EmailCode } from "./steps/EmailCode";
import { AuthenticatorCode } from "./steps/AuthenticatorCode";
import { LoggedIn } from "./steps/LoggedIn";
import { Blocked } from "./steps/Blocked";

const views = {
  login: Login,
  setup2fa: Setup2fa,
  verifyCode: VerifyCode,
  emailCode: EmailCode,
  authenticatorCode: AuthenticatorCode,
  loggedIn: LoggedIn,
  blocked: Blocked
};

const EventLogger = () => {
  useJourneyEvent((event) => {
    if (event.type === "statusChange") {
      console.log(`[react headless] ${event.type}`, event);
    }
  });
  return null;
};

// Headless tier: no Provider or StepRenderer — the app owns rendering.
const ActiveStep = ({ fallback }: { fallback: React.ReactNode }) => {
  const snapshot = useJourneySnapshot();
  const currentStepId = snapshot.currentStep?.id as StepId | undefined;
  const StepComponent = currentStepId ? views[currentStepId] : undefined;
  return StepComponent ? <StepComponent key={currentStepId} /> : <>{fallback}</>;
};

export default function App() {
  return (
    <>
      <EventLogger />
      <Shell>
        <ActiveStep fallback={<p>Unknown step</p>} />
      </Shell>
    </>
  );
}
