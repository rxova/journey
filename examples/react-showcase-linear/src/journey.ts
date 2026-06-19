import { createLinearJourney } from "@rxova/journey-react";

export type StepId = "login" | "setup2fa" | "verifyCode" | "loggedIn";

export type LoginContext = {
  username: string;
  password: string;
  verificationCode: string;
  qrCode: string | null;
  error: string | null;
  attempts: number;
};

type StepMeta = { label: string };

export const journey = createLinearJourney<LoginContext, StepId, StepMeta>({
  context: {
    username: "",
    password: "",
    verificationCode: "",
    qrCode: null,
    error: null,
    attempts: 0
  },
  steps: [
    { id: "login", meta: { label: "Login" } },
    { id: "setup2fa", meta: { label: "Setup 2FA" } },
    { id: "verifyCode", meta: { label: "Verify Code" } },
    {
      id: "loggedIn",
      meta: { label: "Logged In" },
      onEnter: ({ context, dispatch }) => {
        if (context.attempts >= 3) {
          void dispatch({ type: "terminateJourney" });
          return;
        }
        alert("loggedIn");
        void dispatch({ type: "completeJourney" });
      }
    }
  ]
});
