export const AVAILABILITY_VALUES = ["In Stock", "Limited Stock", "Out of Stock"] as const;
export const FIT_VALUES = ["Regular", "Slim", "Relaxed"] as const;
export const MATERIAL_VALUES = [
  "Cotton",
  "Polyester",
  "Metal",
  "Plastic",
  "Wood",
  "Composite",
  "Leather",
  "Glass",
] as const;

export type MerchandisingAttributeValues = {
  price: number;
  rating: number;
  availability: (typeof AVAILABILITY_VALUES)[number];
  warranty_years: number;
  material: (typeof MATERIAL_VALUES)[number];
  fit: (typeof FIT_VALUES)[number];
};

export function merchandisingValuesForIndex(index: number): MerchandisingAttributeValues {
  return {
    price: Math.round((19.99 + (index % 80) + (index % 7) * 0.11) * 100) / 100,
    rating: Math.round((3.5 + (index % 16) / 10) * 10) / 10,
    availability: AVAILABILITY_VALUES[index % 2]!,
    warranty_years: 1 + (index % 5),
    material: MATERIAL_VALUES[index % MATERIAL_VALUES.length]!,
    fit: FIT_VALUES[index % FIT_VALUES.length]!,
  };
}

export function pickFrom<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!;
}
