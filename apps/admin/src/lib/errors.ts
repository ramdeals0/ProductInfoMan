import { ApiError } from "@productinfoman/api-client";

export const GENERIC_UI_ERROR_MESSAGE = "Something went wrong. Please try again.";

export function formatUserFacingError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode >= 500) return GENERIC_UI_ERROR_MESSAGE;
    return error.message || GENERIC_UI_ERROR_MESSAGE;
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    if (!message) return GENERIC_UI_ERROR_MESSAGE;
    if (message.includes("prisma.") || message.includes("Invalid `prisma.")) {
      return GENERIC_UI_ERROR_MESSAGE;
    }
    return message;
  }

  return GENERIC_UI_ERROR_MESSAGE;
}
