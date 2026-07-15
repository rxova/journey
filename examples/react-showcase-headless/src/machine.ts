import { createLinearJourney } from "@rxova/journey-core";
import type { JourneyEventPayloads, JourneySubscriptionEvent } from "@rxova/journey-core";
import {
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

const steps = [
  "login",
  "setup2fa",
  "verifyCode",
  "emailCode",
  "authenticatorCode",
  "loggedIn",
  "blocked"
] as const;

const initialContext: LoginContext = {
  username: "",
  password: "",
  twoFactorMethod: null,
  verificationCode: "",
  qrCode: null,
  error: null,
  attempts: 0
};

export const machine = createLinearJourney(
  {
    context: initialContext,
    steps
  },
  { autoStart: true }
);

const api = {
  updateContext: (updater: (context: LoginContext) => LoginContext) =>
    machine.context.update(updater),
  goToStepById: (stepId: StepId) => machine.navigate.goToStepById(stepId),
  goToPreviousStep: (count?: number) => machine.navigate.goToPreviousStep(count),
  goToLastVisitedStep: () => machine.navigate.goToLastVisitedStep(),
  resetJourney: () => machine.controls.restart(),
  completeJourney: () => machine.controls.complete(),
  terminateJourney: () => machine.controls.terminate()
};

type Snapshot = ReturnType<typeof machine.getSnapshot>;
type ObservedEvent = {
  [TEvent in JourneySubscriptionEvent]: { type: TEvent } & JourneyEventPayloads<
    LoginContext,
    StepId,
    Snapshot
  >[TEvent];
}[JourneySubscriptionEvent];

export const useJourneySnapshot = () => useSnapshotOf(machine);
export const useJourneyComputed = () => useSnapshotOf(machine).steps;
export const useJourneyApi = () => api;
export const useJourneyEvent = (listener: (event: ObservedEvent) => void) => {
  useEventOf(machine, "stepEnter", (payload) => listener({ type: "stepEnter", ...payload }));
  useEventOf(machine, "stepLeave", (payload) => listener({ type: "stepLeave", ...payload }));
  useEventOf(machine, "statusChange", (payload) => listener({ type: "statusChange", ...payload }));
  useEventOf(machine, "contextChange", (payload) =>
    listener({ type: "contextChange", ...payload })
  );
  useEventOf(machine, "navigationBlocked", (payload) =>
    listener({ type: "navigationBlocked", ...payload })
  );
  useEventOf(machine, "error", (payload) => listener({ type: "error", ...payload }));
};
