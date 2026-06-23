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

export type EventMap =
  | { type: "submitLogin"; payload: { username: string; password: string } }
  /** Submit a code for the machine to validate via the `verifyCode` handler. */
  | { type: "submitCode"; payload: { code: string } }
  | { type: "verifyCodeSuccess"; payload: { code: string } }
  | { type: "verifyCodeFailure"; payload: { code: string } }
  | { type: "setup2fa"; payload: { code: string } }
  | { type: "switchAuthMethod" };

export type StepMeta = { label: string; icon: string };

/**
 * Injected dependencies for guards/effects — see the Handlers docs. The flow
 * calls these instead of importing the API directly, so they can be swapped in
 * tests.
 */
export type AuthHandlers = {
  verifyCode: (code: string) => Promise<{ success: boolean }>;
};
