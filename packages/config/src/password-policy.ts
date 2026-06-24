export type PasswordValidationResult = {
  valid: boolean;
  errors: string[];
};

const MIN_LENGTH = 12;

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters`);
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must include a lowercase letter");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must include an uppercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must include a number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must include a symbol");
  }

  return { valid: errors.length === 0, errors };
}

export const PASSWORD_POLICY_SUMMARY = {
  minLength: MIN_LENGTH,
  requiresLowercase: true,
  requiresUppercase: true,
  requiresNumber: true,
  requiresSymbol: true,
};
