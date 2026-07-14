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

const views: Record<StepId, React.ComponentType> = {
  login: Login,
  setup2fa: Setup2fa,
  verifyCode: VerifyCode,
  emailCode: EmailCode,
  authenticatorCode: AuthenticatorCode,
  loggedIn: LoggedIn,
  blocked: Blocked
};

const EventLogger = () => {
  journey.useEvent((event) => {
    if (
      event.type === "journey.start" ||
      event.type === "journey.reset" ||
      event.type === "journey.completed" ||
      event.type === "journey.terminated"
    ) {
      console.log(`[react graph] ${event.type}`, event);
    }
  });
  return null;
};

export default function App() {
  const detachRef = React.useRef<(() => void) | null>(null);
  const handleMachineRef = React.useCallback((machine: unknown) => {
    detachRef.current?.();
    detachRef.current = null;
    if (machine) {
      detachRef.current = attachJourneyDevtools(machine as never, {
        label: "React Showcase Graph",
        appName: "React Showcase Graph",
        enabled: true,
        commandsEnabled: true
      });
    }
  }, []);

  return (
    <journey.Provider views={views} machineRef={handleMachineRef}>
      <EventLogger />
      <Shell>
        <journey.StepRenderer fallback={<p>Unknown step</p>} />
      </Shell>
    </journey.Provider>
  );
}
