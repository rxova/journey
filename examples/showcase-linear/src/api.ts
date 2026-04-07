const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const mockApi = {
  login: async (username: string, password: string) => {
    void username;
    void password;
    await delay(800);
    return { success: true, method: "no_2fa" as const };
  },
  generateQrCode: async () => {
    await delay(400);
    return { qrCode: "otpauth://totp/App:user?secret=BASE32SECRET" };
  },
  verifyCode: async (code: string) => {
    await delay(600);
    return { success: code === "123456" };
  }
};
