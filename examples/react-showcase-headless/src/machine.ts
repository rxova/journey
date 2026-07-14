import { createHeadlessJourney } from "@rxova/journey-core";
import type { HeadlessJourneyDefinition, JourneyObservationEvent } from "@rxova/journey-core";
import {
  useJourneyComputed as useComputedOf,
  useJourneyEvent as useEventOf,
  useJourneySnapshot as useSnapshotOf
} from "@rxova/journey-react/headless";

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

const definition: HeadlessJourneyDefinition<LoginContext, StepId> = {
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

// The headless tier: the machine is created with core directly and can live
// anywhere (module scope here, for the demo). The zero-arg hooks below are
// thin app-local wrappers over the machine-argument headless hooks.
export const machine = createHeadlessJourney(definition);

export const useJourneySnapshot = () => useSnapshotOf(machine);
export const useJourneyComputed = () => useComputedOf(machine);
/** The machine IS the imperative API — no indirection needed. */
export const useJourneyApi = () => machine;
export const useJourneyEvent = (
  listener: (event: JourneyObservationEvent<StepId, never>) => void
) => useEventOf(machine, listener as never);
