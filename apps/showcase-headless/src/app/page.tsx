"use client";

import { JourneyProvider, StepRenderer } from "../machine";
import { Shell } from "../components/Shell";
import { Login } from "../steps/Login";
import { Setup2fa } from "../steps/Setup2fa";
import { VerifyCode } from "../steps/VerifyCode";
import { EmailCode } from "../steps/EmailCode";
import { AuthenticatorCode } from "../steps/AuthenticatorCode";
import { LoggedIn } from "../steps/LoggedIn";
import { Blocked } from "../steps/Blocked";

const views = {
  login: Login,
  setup2fa: Setup2fa,
  verifyCode: VerifyCode,
  emailCode: EmailCode,
  authenticatorCode: AuthenticatorCode,
  loggedIn: LoggedIn,
  blocked: Blocked
};

export default function Page() {
  return (
    <JourneyProvider
      views={views}
      onStart={(e) => console.log("[headless] start", e)}
      onComplete={(e) => console.log("[headless] complete", e)}
      onTerminate={(e) => console.log("[headless] terminate", e)}
    >
      <Shell>
        <StepRenderer fallback={<p>Unknown step</p>} />
      </Shell>
    </JourneyProvider>
  );
}
