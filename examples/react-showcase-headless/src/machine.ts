import React from "react";
import { createLinearJourney } from "@rxova/journey-core";
import type { JourneyEventPayloads, JourneySubscriptionEvent } from "@rxova/journey-core";

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

// No React package needed to consume a caller-owned machine: the machine is a
// module-scope singleton, so the subscribe adapter is a stable plain function
// and React's own useSyncExternalStore is the whole bridge.
const subscribe = (onStoreChange: () => void) =>
  machine.subscriptions.subscribeSelector((snapshot) => snapshot, onStoreChange);

export const useJourneySnapshot = () =>
  React.useSyncExternalStore(subscribe, machine.getSnapshot, machine.getSnapshot);
export const useJourneyComputed = () => useJourneySnapshot().steps;

const useEventOf = <TEvent extends JourneySubscriptionEvent>(
  event: TEvent,
  listener: (payload: JourneyEventPayloads<LoginContext, StepId, Snapshot>[TEvent]) => void
): void => {
  const listenerRef = React.useRef(listener);
  listenerRef.current = listener;
  React.useEffect(
    () =>
      machine.subscriptions.subscribeEvent(event, (payload) =>
        listenerRef.current(payload as never)
      ),
    [event]
  );
};
export const useJourneyApi = () => api;
export const useJourneyEvent = (listener: (event: ObservedEvent) => void) => {
  useEventOf("stepEnter", (payload) => listener({ type: "stepEnter", ...payload }));
  useEventOf("stepLeave", (payload) => listener({ type: "stepLeave", ...payload }));
  useEventOf("statusChange", (payload) => listener({ type: "statusChange", ...payload }));
  useEventOf("contextChange", (payload) => listener({ type: "contextChange", ...payload }));
  useEventOf("navigationBlocked", (payload) => listener({ type: "navigationBlocked", ...payload }));
  useEventOf("error", (payload) => listener({ type: "error", ...payload }));
};
