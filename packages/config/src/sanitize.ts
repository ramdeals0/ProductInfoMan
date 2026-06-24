const HTML_TAG_PATTERN = /<[^>]*>/g;
const SCRIPT_PATTERN = /<\s*script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/\s*script\s*>/gi;

/** Strip script blocks and HTML tags from user-provided display strings. */
export function sanitizeDisplayText(value: string): string {
  return value.replace(SCRIPT_PATTERN, "").replace(HTML_TAG_PATTERN, "").trim();
}

export function sanitizeRecordStrings<T extends Record<string, unknown>>(record: T): T {
  const result = { ...record };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string") {
      (result as Record<string, unknown>)[key] = sanitizeDisplayText(value);
    }
  }
  return result;
}
