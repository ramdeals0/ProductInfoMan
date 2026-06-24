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

/** Normalize user input into a valid category slug (lowercase kebab-case). */
export function normalizeCategorySlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function isValidCategorySlug(value: string): boolean {
  return /^[a-z0-9-]+$/.test(value);
}

/** Suggest a slug from a display name. */
export function slugFromName(name: string): string {
  return normalizeCategorySlug(name);
}
