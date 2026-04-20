import React from "react";
import { JourneyProvider, StepRenderer, useJourneyEvent } from "./machine";
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
    if (
      event.type === "journey.start" ||
      event.type === "journey.reset" ||
      event.type === "journey.completed" ||
      event.type === "journey.terminated"
    ) {
      console.log(`[react headless] ${event.type}`, event);
    }
  });
  return null;
};

export default function App() {
  return (
    <JourneyProvider views={views}>
      <EventLogger />
      <Shell>
        <StepRenderer fallback={<p>Unknown step</p>} />
      </Shell>
    </JourneyProvider>
  );
}
