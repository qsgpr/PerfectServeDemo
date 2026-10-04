import { describe, expect, it } from "vitest";
import {
  createDemoAuthService,
  DEMO_ACCOUNT,
  validateLogin,
} from "../src/features/auth/auth-service";
describe("local demo sign-in", () => {
  it("validates required fields and email format", () => {
    expect(validateLogin("", "")).toContain("email");
    expect(validateLogin("not-an-email", "demo")).toContain("valid email");
    expect(validateLogin(DEMO_ACCOUNT.email, "")).toContain("password");
  });
  it("accepts the fictional account and normalizes email only", async () => {
    const service = createDemoAuthService(0);
    await expect(
      service.signIn(
        ` ${DEMO_ACCOUNT.email.toUpperCase()} `,
        DEMO_ACCOUNT.password,
      ),
    ).resolves.toMatchObject({ id: "demo-user", email: DEMO_ACCOUNT.email });
    await expect(
      service.signIn(DEMO_ACCOUNT.email, ` ${DEMO_ACCOUNT.password}`),
    ).rejects.toThrow("don’t match");
  });
  it("rejects unknown credentials", async () => {
    await expect(
      createDemoAuthService(0).signIn("other@example.test", "anything"),
    ).rejects.toThrow("don’t match");
  });
});
