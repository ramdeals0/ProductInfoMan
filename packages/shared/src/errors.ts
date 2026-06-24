export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function appError(message: string, statusCode: number): AppError {
  return new AppError(message, statusCode);
}
