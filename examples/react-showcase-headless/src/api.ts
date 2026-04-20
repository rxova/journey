const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const mockApi = {
  login: async (username: string, password: string) => {
    await delay(800);
    if (password === "blocked") return { success: false as const, method: null };
    const methods = ["no_2fa", "email", "authenticator"] as const;
    const method = methods[username.length % 3]!;
    return { success: true as const, method };
  },
  generateQrCode: async () => {
    await delay(400);
    return { qrCode: "otpauth://totp/App:user?secret=BASE32SECRET" };
  },
  verifyCode: async (code: string) => {
    await delay(600);
    return { success: code === "123456" };
  },
  sendEmailCode: async () => {
    await delay(500);
    return { sent: true };
  }
};
