/** Normalize user input into a valid taxonomy key (lowercase snake_case). */
export function normalizeTaxonomyKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function isValidTaxonomyKey(value: string): boolean {
  return /^[a-z0-9_]+$/.test(value);
}
