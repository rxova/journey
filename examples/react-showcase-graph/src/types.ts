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
  verifyCodeSuccess: { code: string };
  verifyCodeFailure: { code: string };
  setup2fa: { code: string };
  switchAuthMethod: unknown;
};

export type StepMeta = { label: string; icon: string };
