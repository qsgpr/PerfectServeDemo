/** Public fictional credentials for this local demo; never use this as real authentication. */
export const DEMO_ACCOUNT = {
  email: "alex@shiftline.example",
  password: "Shiftline26!",
};
export interface DemoSession {
  id: string;
  name: string;
  email: string;
}
export interface AuthService {
  signIn(email: string, password: string): Promise<DemoSession>;
}
export function validateLogin(
  email: string,
  password: string,
): string | undefined {
  if (!email.trim()) return "Enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return "Enter a valid email address.";
  if (!password) return "Enter your password.";
}
export function createDemoAuthService(delay = 450): AuthService {
  return {
    async signIn(email, password) {
      const validation = validateLogin(email, password);
      if (validation) throw new Error(validation);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
      if (
        email.trim().toLowerCase() !== DEMO_ACCOUNT.email ||
        password !== DEMO_ACCOUNT.password
      ) {
        throw new Error(
          "Those details don’t match your account. Please try again.",
        );
      }
      return {
        id: "demo-user",
        name: "Alex Morgan",
        email: DEMO_ACCOUNT.email,
      };
    },
  };
}
