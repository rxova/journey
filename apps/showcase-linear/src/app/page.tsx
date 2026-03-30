"use client";

import React from "react";
import { journey } from "../journey";
import type { StepId } from "../journey";
import type { JourneyViews } from "@rxova/journey-react";
import { Shell } from "../components/Shell";
import { Login } from "../steps/Login";
import { Setup2fa } from "../steps/Setup2fa";
import { VerifyCode } from "../steps/VerifyCode";
import { LoggedIn } from "../steps/LoggedIn";

const views: JourneyViews<StepId> = {
  login: Login,
  setup2fa: Setup2fa,
  verifyCode: VerifyCode,
  loggedIn: LoggedIn
};

export default function Page() {
  return (
    <journey.JourneyProvider
      views={views}
      onStart={(event) => console.log("[linear] journey.start", event)}
      onComplete={(event) => console.log("[linear] journey.completed", event)}
      onTerminate={(event) => console.log("[linear] journey.terminated", event)}
    >
      <Shell>
        <journey.StepRenderer fallback={<p>Unknown step</p>} />
      </Shell>
    </journey.JourneyProvider>
  );
}
