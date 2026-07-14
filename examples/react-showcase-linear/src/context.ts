export type LoginContext = {
  username: string;
  password: string;
  verificationCode: string;
  qrCode: string | null;
  error: string | null;
  attempts: number;
};

export const initialContext: LoginContext = {
  username: "",
  password: "",
  verificationCode: "",
  qrCode: null,
  error: null,
  attempts: 0
};
