import { describe, expect, it } from "vitest";
import { AppError } from "./errors.js";
import { resolveHttpError } from "./http-errors.js";

describe("resolveHttpError", () => {
  it("returns AppError messages for client errors", () => {
    const error = new AppError("Not found", 404);
    expect(resolveHttpError(error)).toEqual({
      statusCode: 404,
      message: "Not found",
    });
  });

  it("hides internal error details for unknown failures", () => {
    const error = new Error("Invalid `prisma.workflowHistory.findMany()` invocation");
    const resolved = resolveHttpError(error);
    expect(resolved.statusCode).toBe(500);
    expect(resolved.message).toBe("Something went wrong");
    expect(resolved.logDetail).toContain("prisma");
  });

  it("preserves AuthError codes", () => {
    class AuthError extends Error {
      name = "AuthError";
      constructor(
        message: string,
        public statusCode: number,
        public code?: string,
      ) {
        super(message);
      }
    }

    const error = new AuthError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    expect(resolveHttpError(error)).toEqual({
      statusCode: 401,
      message: "Invalid email or password",
      code: "INVALID_CREDENTIALS",
    });
  });
});
