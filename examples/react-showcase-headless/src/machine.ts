import { createJourney } from "@rxova/journey-react";
import type { JourneyDefinition } from "@rxova/journey-core";

export type StepId =
  | "login"
  | "setup2fa"
  | "verifyCode"
  | "emailCode"
  | "authenticatorCode"
  | "loggedIn"
  | "blocked";

export type LoginContext = {
  username: string;
  password: string;
  twoFactorMethod: "no_2fa" | "email" | "authenticator" | null;
  verificationCode: string;
  qrCode: string | null;
  error: string | null;
  attempts: number;
};

const definition: JourneyDefinition<LoginContext, StepId> = {
  initial: "login",
  context: {
    username: "",
    password: "",
    twoFactorMethod: null,
    verificationCode: "",
    qrCode: null,
    error: null,
    attempts: 0
  },
  steps: {
    login: {},
    setup2fa: {},
    verifyCode: {},
    emailCode: {},
    authenticatorCode: {},
    loggedIn: {
      onEnter: ({ dispatch }) => {
        void dispatch({ type: "completeJourney" });
      }
    },
    blocked: {
      onEnter: ({ dispatch }) => {
        void dispatch({ type: "terminateJourney" });
      }
    }
  }
  // No transitions — headless mode. All navigation via goToStepById.
};

export const {
  useJourneySnapshot,
  useJourneyComputed,
  useJourneyApi,
  useJourneyEvent,
  JourneyProvider,
  StepRenderer,
  machine
} = createJourney(definition);
