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

export type EventMap = {
  submitLogin: { username: string; password: string };
  /** Submit a code for the machine to validate via the `verifyCode` handler. */
  submitCode: { code: string };
  verifyCodeSuccess: { code: string };
  verifyCodeFailure: { code: string };
  setup2fa: { code: string };
  switchAuthMethod: unknown;
};

export type StepMeta = { label: string; icon: string };

/**
 * Injected dependencies for guards/effects — see the Handlers docs. The flow
 * calls these instead of importing the API directly, so they can be swapped in
 * tests.
 */
export type AuthHandlers = {
  verifyCode: (code: string) => Promise<{ success: boolean }>;
};
