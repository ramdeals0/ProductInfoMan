const SUMMARY_TEMPLATES = [
  (title: string, category: string) =>
    `${title} delivers dependable everyday value for ${category} shoppers seeking quality, smart pricing, and trusted performance at home.`,
  (title: string, category: string) =>
    `Shop ${title} for reliable ${category} performance, thoughtful design, and lasting value backed by clear specs and strong customer satisfaction.`,
  (title: string, category: string) =>
    `${title} combines practical features and durable construction, making it an easy choice for ${category} needs across busy households and daily routines.`,
] as const;

const SELLING_POINT_STEMS = [
  "Built for dependable everyday use with quality materials and consistent performance.",
  "Designed to simplify shopping with clear specs, trusted branding, and strong value.",
  "Offers versatile functionality that fits a wide range of household and lifestyle needs.",
  "Backed by thoughtful engineering for comfort, convenience, and long-term reliability.",
  "Easy to compare online with detailed attributes, ratings, and availability status.",
  "Ideal for shoppers who want practical features without paying for unnecessary extras.",
  "Ships ready to use with straightforward setup and intuitive out-of-box experience.",
  "Pairs well with related items in the same aisle for quick basket-building and gifting.",
  "Popular with repeat buyers thanks to balanced pricing and dependable quality.",
  "Supported by transparent product data for confident purchase decisions online.",
] as const;

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export type ProductMerchandisingCopy = {
  summary: string;
  sellingPoints: string[];
  description: string;
};

export function buildProductMerchandisingCopy(
  title: string,
  categoryLabel: string,
  index: number,
): ProductMerchandisingCopy {
  const summary = pick(SUMMARY_TEMPLATES, index)(title, categoryLabel);
  const normalizedSummary =
    wordCount(summary) > 24 ? summary.split(" ").slice(0, 20).join(" ").concat(".") : summary;

  const sellingPoints = SELLING_POINT_STEMS.map((stem, pointIndex) => {
    const variant = pick(
      [
        stem,
        `${title}: ${stem}`,
        `${categoryLabel} favorite — ${stem.charAt(0).toLowerCase()}${stem.slice(1)}`,
      ],
      index + pointIndex,
    );
    return variant;
  });

  const description = [
    normalizedSummary,
    "",
    "Highlights:",
    ...sellingPoints.map((point) => `• ${point}`),
  ].join("\n");

  return {
    summary: normalizedSummary,
    sellingPoints,
    description,
  };
}

export function defaultStorefrontAvailability(index: number, now = new Date()) {
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  startDate.setUTCDate(startDate.getUTCDate() - 30 - (index % 14));

  const discontinueDate = new Date(startDate);
  discontinueDate.setUTCFullYear(discontinueDate.getUTCFullYear() + 2);
  discontinueDate.setUTCMonth(discontinueDate.getUTCMonth() + (index % 6));

  return { startDate, discontinueDate };
}
