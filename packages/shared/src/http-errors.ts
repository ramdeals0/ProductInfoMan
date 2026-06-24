import { ZodError } from "zod";
import { AppError } from "./errors.js";

export const GENERIC_HTTP_ERROR_MESSAGE = "Something went wrong";

export type ResolvedHttpError = {
  statusCode: number;
  message: string;
  logDetail?: string;
  code?: string;
};

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const field = issue.path.length ? `${issue.path.join(".")}: ` : "";
      return `${field}${issue.message}`;
    })
    .join("; ");
}

function isNamedError(error: unknown, name: string): error is Error & { statusCode: number } {
  return (
    error instanceof Error &&
    error.name === name &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  );
}

export function resolveHttpError(error: unknown): ResolvedHttpError {
  if (error instanceof AppError) {
    return { statusCode: error.statusCode, message: error.message };
  }

  if (isNamedError(error, "AuthError")) {
    const code = (error as Error & { code?: string }).code;
    return { statusCode: error.statusCode, message: error.message, code };
  }

  if (error instanceof ZodError) {
    return { statusCode: 400, message: formatZodError(error) };
  }

  if (error && typeof error === "object" && "statusCode" in error) {
    const statusCode = Number((error as { statusCode: number }).statusCode);
    if (statusCode >= 400 && statusCode < 500) {
      const message =
        error instanceof Error
          ? error.message
          : typeof (error as { message?: unknown }).message === "string"
            ? (error as { message: string }).message
            : GENERIC_HTTP_ERROR_MESSAGE;
      return { statusCode, message };
    }
  }

  const logDetail =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";

  return {
    statusCode: 500,
    message: GENERIC_HTTP_ERROR_MESSAGE,
    logDetail,
  };
}
