import { createHash } from "node:crypto";
import type { FleetFarmCategoryConfig } from "./types.js";
import { FLEETFARM_CATEGORIES } from "./config.js";
import { simulatedRating } from "./facets.js";
import type { ScrapedProduct } from "./types.js";

type ProductTemplate = {
  title: string;
  brand: string;
  price: number;
  description: string;
  attributes: Record<string, string | number | boolean>;
};

const CATEGORY_TEMPLATES: Record<string, ProductTemplate[]> = {
  tools: [
    { title: "20V MAX Cordless Drill/Driver Kit", brand: "DEWALT", price: 129.99, description: "Compact drill with two batteries and charger.", attributes: { tool_type: "Drill", power_source: "Cordless", voltage: 20 } },
    { title: "M18 FUEL Impact Driver", brand: "Milwaukee", price: 179.0, description: "High-torque impact driver for fasteners.", attributes: { tool_type: "Drill", power_source: "Cordless", voltage: 18 } },
    { title: "7.5 Amp Angle Grinder", brand: "SKIL", price: 49.97, description: "4-1/2 in angle grinder for metal work.", attributes: { tool_type: "Grinder", power_source: "Corded" } },
    { title: "Mechanics Tool Set 230-Piece", brand: "CRAFTSMAN", price: 99.99, description: "Socket and wrench set with carry case.", attributes: { tool_type: "Hand Tools", power_source: "Manual" } },
    { title: "Tape Measure 25-Foot", brand: "Stanley", price: 14.97, description: "Classic tape measure with standout.", attributes: { tool_type: "Measuring", power_source: "Manual" } },
    { title: "Circular Saw 15 Amp", brand: "Ryobi", price: 89.0, description: "7-1/4 in circular saw for framing cuts.", attributes: { tool_type: "Saw", power_source: "Corded" } },
    { title: "Hammer Drill Kit", brand: "Bosch", price: 149.0, description: "Hammer drill for masonry applications.", attributes: { tool_type: "Drill", power_source: "Corded" } },
    { title: "Pliers Set 4-Piece", brand: "Channellock", price: 39.99, description: "Essential pliers assortment.", attributes: { tool_type: "Hand Tools", power_source: "Manual" } },
    { title: "Rotary Tool Kit", brand: "Dremel", price: 79.99, description: "Variable-speed rotary tool with accessories.", attributes: { tool_type: "Grinder", power_source: "Corded" } },
    { title: "Level 48-Inch", brand: "Empire", price: 24.99, description: "Aluminum box level for layout.", attributes: { tool_type: "Measuring", power_source: "Manual" } },
    { title: "Socket Set 3/8 Drive", brand: "GearWrench", price: 119.0, description: "Metric and SAE socket set.", attributes: { tool_type: "Hand Tools", power_source: "Manual" } },
    { title: "Jigsaw 6.5 Amp", brand: "Black+Decker", price: 44.99, description: "Orbital jigsaw for curved cuts.", attributes: { tool_type: "Saw", power_source: "Corded" } },
    { title: "Air Compressor 6 Gallon", brand: "PORTER-CABLE", price: 199.0, description: "Pancake compressor for nailers.", attributes: { tool_type: "Compressor", power_source: "Electric" } },
    { title: "Stud Finder", brand: "Zircon", price: 19.97, description: "Edge stud finder with AC detection.", attributes: { tool_type: "Measuring", power_source: "Battery" } },
    { title: "Reciprocating Saw", brand: "Metabo HPT", price: 99.0, description: "Variable-speed recip saw.", attributes: { tool_type: "Saw", power_source: "Corded" } },
    { title: "Workbench", brand: "Kobalt", price: 249.0, description: "Steel workbench with pegboard.", attributes: { tool_type: "Storage", power_source: "Manual" } },
    { title: "Hex Key Set", brand: "Bondhus", price: 12.99, description: "Ball-end hex key set.", attributes: { tool_type: "Hand Tools", power_source: "Manual" } },
    { title: "Oscillating Multi-Tool", brand: "Fein", price: 159.0, description: "Precision multi-tool for remodel work.", attributes: { tool_type: "Hand Tools", power_source: "Corded" } },
    { title: "Tool Box 26-Inch", brand: "Husky", price: 34.97, description: "Portable tool storage.", attributes: { tool_type: "Storage", power_source: "Manual" } },
    { title: "Laser Distance Measure", brand: "Bosch", price: 89.99, description: "165 ft laser measure.", attributes: { tool_type: "Measuring", power_source: "Battery" } },
  ],
  outdoor_power: [
    { title: "Gas Chainsaw 18-Inch", brand: "Husqvarna", price: 399.99, description: "Gas chainsaw for firewood and trimming.", attributes: { equipment_type: "Chainsaw", engine_displacement_cc: 50, bar_length_in: 18, fuel_type: "Gas" } },
    { title: "Battery Chainsaw 14-Inch", brand: "EGO", price: 299.0, description: "56V cordless chainsaw.", attributes: { equipment_type: "Chainsaw", bar_length_in: 14, fuel_type: "Battery" } },
    { title: "Self-Propelled Mower", brand: "Toro", price: 449.0, description: "Recycler mower with personal pace.", attributes: { equipment_type: "Mower", engine_displacement_cc: 163, bar_length_in: 22, fuel_type: "Gas" } },
    { title: "String Trimmer 28cc", brand: "Echo", price: 199.99, description: "Curved-shaft trimmer.", attributes: { equipment_type: "Trimmer", engine_displacement_cc: 28, bar_length_in: 17, fuel_type: "Gas" } },
    { title: "Leaf Blower 40V", brand: "Greenworks", price: 169.0, description: "Cordless blower with turbo mode.", attributes: { equipment_type: "Blower", fuel_type: "Battery" } },
    { title: "Snow Blower Two-Stage", brand: "Ariens", price: 1299.0, description: "28 in two-stage snow blower.", attributes: { equipment_type: "Snow Blower", engine_displacement_cc: 291, bar_length_in: 28, fuel_type: "Gas" } },
    { title: "Pressure Washer 3100 PSI", brand: "Generac", price: 379.0, description: "Gas pressure washer.", attributes: { equipment_type: "Pressure Washer", engine_displacement_cc: 196, fuel_type: "Gas" } },
    { title: "Riding Mower 42-Inch", brand: "Cub Cadet", price: 2499.0, description: "Lawn tractor with hydro transmission.", attributes: { equipment_type: "Mower", engine_displacement_cc: 547, bar_length_in: 42, fuel_type: "Gas" } },
    { title: "Pole Saw 8-Inch", brand: "Remington", price: 129.99, description: "Gas pole saw for high branches.", attributes: { equipment_type: "Chainsaw", engine_displacement_cc: 25, bar_length_in: 8, fuel_type: "Gas" } },
    { title: "Hedge Trimmer 22-Inch", brand: "Stihl", price: 349.0, description: "Double-sided hedge trimmer.", attributes: { equipment_type: "Trimmer", engine_displacement_cc: 24, bar_length_in: 22, fuel_type: "Gas" } },
    { title: "Chipper Shredder", brand: "Dirty Hand Tools", price: 899.0, description: "Gas chipper for yard debris.", attributes: { equipment_type: "Tiller", engine_displacement_cc: 196, fuel_type: "Gas" } },
    { title: "Tiller Cultivator", brand: "Earthquake", price: 279.0, description: "Front-tine garden tiller.", attributes: { equipment_type: "Tiller", engine_displacement_cc: 99, fuel_type: "Gas" } },
    { title: "Log Splitter 25-Ton", brand: "Champion", price: 1199.0, description: "Gas log splitter.", attributes: { equipment_type: "Tiller", engine_displacement_cc: 224, fuel_type: "Gas" } },
    { title: "Backpack Blower", brand: "Husqvarna", price: 329.99, description: "Commercial backpack blower.", attributes: { equipment_type: "Blower", engine_displacement_cc: 50, fuel_type: "Gas" } },
    { title: "Electric Mower 21-Inch", brand: "Ryobi", price: 399.0, description: "40V brushless mower.", attributes: { equipment_type: "Mower", bar_length_in: 21, fuel_type: "Battery" } },
    { title: "Edger 9-Inch", brand: "McLane", price: 449.0, description: "Gas lawn edger.", attributes: { equipment_type: "Trimmer", engine_displacement_cc: 87, bar_length_in: 9, fuel_type: "Gas" } },
    { title: "Zero-Turn Mower 42-Inch", brand: "Bad Boy", price: 3499.0, description: "Residential zero-turn mower.", attributes: { equipment_type: "Mower", engine_displacement_cc: 597, bar_length_in: 42, fuel_type: "Gas" } },
    { title: "Mini Tiller", brand: "Mantis", price: 349.0, description: "Compact tiller for beds.", attributes: { equipment_type: "Tiller", engine_displacement_cc: 25, fuel_type: "Gas" } },
    { title: "Wood Chipper Electric", brand: "Sun Joe", price: 199.0, description: "14 amp electric chipper.", attributes: { equipment_type: "Tiller", fuel_type: "Electric" } },
    { title: "Trimmer Mower", brand: "DR", price: 799.0, description: "Walk-behind trimmer mower.", attributes: { equipment_type: "Mower", engine_displacement_cc: 190, bar_length_in: 22, fuel_type: "Gas" } },
  ],
  clothing: [
    { title: "Duck Active Jac", brand: "Carhartt", price: 99.99, description: "Insulated work jacket.", attributes: { apparel_size: "L", apparel_gender: "Men", color: "Brown", apparel_type: "Jacket" } },
    { title: "Original Fit Jeans", brand: "Wrangler", price: 39.99, description: "Durable work jeans.", attributes: { apparel_size: "L", apparel_gender: "Men", color: "Blue", apparel_type: "Pants" } },
    { title: "Steel Toe Work Boot", brand: "Timberland PRO", price: 149.99, description: "Waterproof steel toe boot.", attributes: { apparel_size: "L", apparel_gender: "Men", color: "Tan", apparel_type: "Boots" } },
    { title: "Performance Hoodie", brand: "Under Armour", price: 54.99, description: "Moisture-wicking hoodie.", attributes: { apparel_size: "M", apparel_gender: "Men", color: "Black", apparel_type: "Shirt" } },
    { title: "Flannel Shirt", brand: "Legendary Whitetails", price: 34.99, description: "Soft brushed flannel.", attributes: { apparel_size: "XL", apparel_gender: "Men", color: "Red", apparel_type: "Shirt" } },
    { title: "Insulated Bib Overall", brand: "Berne", price: 89.99, description: "Cold-weather insulated bibs.", attributes: { apparel_size: "L", apparel_gender: "Men", color: "Brown", apparel_type: "Coveralls" } },
    { title: "Work Gloves Leather", brand: "Wells Lamont", price: 19.99, description: "Premium leather work gloves.", attributes: { apparel_size: "L", apparel_gender: "Unisex", color: "Tan", apparel_type: "Gloves" } },
    { title: "Rain Jacket", brand: "Helly Hansen", price: 119.0, description: "Waterproof shell jacket.", attributes: { apparel_size: "M", apparel_gender: "Men", color: "Blue", apparel_type: "Jacket" } },
    { title: "Cargo Work Pants", brand: "Dickies", price: 44.99, description: "Relaxed-fit cargo pants.", attributes: { apparel_size: "L", apparel_gender: "Men", color: "Tan", apparel_type: "Pants" } },
    { title: "Thermal Base Layer Top", brand: "ColdPruf", price: 24.99, description: "Heavyweight thermal top.", attributes: { apparel_size: "M", apparel_gender: "Men", color: "Black", apparel_type: "Shirt" } },
    { title: "Women's Softshell Jacket", brand: "Columbia", price: 79.99, description: "Wind-resistant softshell.", attributes: { apparel_size: "M", apparel_gender: "Women", color: "Blue", apparel_type: "Jacket" } },
    { title: "Women's Work Boot", brand: "Keen Utility", price: 129.99, description: "Composite toe work boot.", attributes: { apparel_size: "M", apparel_gender: "Women", color: "Gray", apparel_type: "Boots" } },
    { title: "High-Vis Safety Vest", brand: "Radians", price: 12.99, description: "ANSI Class 2 vest.", attributes: { apparel_size: "XL", apparel_gender: "Unisex", color: "Yellow", apparel_type: "Accessories" } },
    { title: "Merino Wool Socks 3-Pack", brand: "Darn Tough", price: 59.99, description: "Cushioned boot socks.", attributes: { apparel_size: "L", apparel_gender: "Unisex", color: "Gray", apparel_type: "Accessories" } },
    { title: "Insulated Beanie", brand: "Carhartt", price: 16.99, description: "Knit watch hat.", attributes: { apparel_size: "One Size", apparel_gender: "Unisex", color: "Black", apparel_type: "Accessories" } },
    { title: "Coveralls", brand: "Red Kap", price: 49.99, description: "Zip-front work coveralls.", attributes: { apparel_size: "L", apparel_gender: "Men", color: "Blue", apparel_type: "Coveralls" } },
    { title: "Fleece Vest", brand: "The North Face", price: 69.0, description: "Lightweight fleece vest.", attributes: { apparel_size: "L", apparel_gender: "Men", color: "Black", apparel_type: "Jacket" } },
    { title: "Youth Insulated Jacket", brand: "Browning", price: 89.99, description: "Youth hunting jacket.", attributes: { apparel_size: "M", apparel_gender: "Youth", color: "Yellow", apparel_type: "Jacket" } },
    { title: "Work Shorts", brand: "Caterpillar", price: 34.99, description: "Ripstop utility shorts.", attributes: { apparel_size: "L", apparel_gender: "Men", color: "Gray", apparel_type: "Pants" } },
    { title: "Balaclava", brand: "Ergodyne", price: 14.99, description: "Cold-weather face protection.", attributes: { apparel_size: "One Size", apparel_gender: "Unisex", color: "Black", apparel_type: "Accessories" } },
  ],
  fishing: [
    { title: "Spinning Reel Size 3000", brand: "Shimano", price: 79.99, description: "Smooth spinning reel.", attributes: { category_subtype: "Reel", caliber_or_line_rating: "Panfish" } },
    { title: "Baitcasting Combo", brand: "Abu Garcia", price: 129.99, description: "Rod and reel combo.", attributes: { category_subtype: "Rod", caliber_or_line_rating: "Bass" } },
    { title: "Tackle Box 3-Tray", brand: "Plano", price: 24.99, description: "Expandable tackle storage.", attributes: { category_subtype: "Tackle", caliber_or_line_rating: "General" } },
    { title: "Crankbait Lure 5-Pack", brand: "Rapala", price: 39.99, description: "Shallow diving crankbaits.", attributes: { category_subtype: "Lure", caliber_or_line_rating: "Bass" } },
    { title: "Spinning Rod 7-Foot", brand: "St. Croix", price: 149.0, description: "Medium-power spinning rod.", attributes: { category_subtype: "Rod", caliber_or_line_rating: "Walleye" } },
    { title: "Chest Waders", brand: "Hodgman", price: 89.99, description: "Bootfoot nylon waders.", attributes: { category_subtype: "Apparel", caliber_or_line_rating: "Trout" } },
    { title: "Game Cart", brand: "Kill Shot", price: 119.99, description: "Folding hunting cart.", attributes: { category_subtype: "Hunting", caliber_or_line_rating: "Deer" } },
    { title: "Trail Camera 20MP", brand: "Browning", price: 99.99, description: "Cellular trail camera.", attributes: { category_subtype: "Electronics", caliber_or_line_rating: "Deer" } },
    { title: "Duck Decoy Pack", brand: "Higdon", price: 79.99, description: "Foam duck decoy set.", attributes: { category_subtype: "Hunting", caliber_or_line_rating: "Waterfowl" } },
    { title: "Turkey Call Box", brand: "WoodHaven", price: 49.99, description: "Custom turkey box call.", attributes: { category_subtype: "Hunting", caliber_or_line_rating: "Turkey" } },
    { title: "Ice Fishing Auger 8-Inch", brand: "Eskimo", price: 449.0, description: "Gas ice auger.", attributes: { category_subtype: "Tackle", caliber_or_line_rating: "Panfish" } },
    { title: "Fishing Line 300-Yard", brand: "Berkley", price: 14.99, description: "Monofilament line.", attributes: { category_subtype: "Tackle", caliber_or_line_rating: "10 lb" } },
    { title: "Hunting Knife", brand: "Buck", price: 59.99, description: "Fixed-blade hunting knife.", attributes: { category_subtype: "Hunting", caliber_or_line_rating: "Deer" } },
    { title: "Bow Release", brand: "Tru-Fire", price: 89.99, description: "Wrist strap release aid.", attributes: { category_subtype: "Hunting", caliber_or_line_rating: "Deer" } },
    { title: "Fish Finder", brand: "Humminbird", price: 199.99, description: "Portable fish finder.", attributes: { category_subtype: "Electronics", caliber_or_line_rating: "Walleye" } },
    { title: "Soft Plastic Baits", brand: "Zoom", price: 6.99, description: "Creature bait bulk pack.", attributes: { category_subtype: "Lure", caliber_or_line_rating: "Bass" } },
    { title: "Tree Stand", brand: "Muddy", price: 149.99, description: "Hang-on tree stand.", attributes: { category_subtype: "Hunting", caliber_or_line_rating: "Deer" } },
    { title: "Fly Rod 5-Weight", brand: "Orvis", price: 169.0, description: "Clearwater fly rod.", attributes: { category_subtype: "Rod", caliber_or_line_rating: "Trout" } },
    { title: "Gun Safe Dehumidifier", brand: "GoldenRod", price: 29.99, description: "Safe moisture control.", attributes: { category_subtype: "Tackle", caliber_or_line_rating: "General" } },
    { title: "Spinning Lure Kit", brand: "Mepps", price: 34.99, description: "Inline spinner assortment.", attributes: { category_subtype: "Lure", caliber_or_line_rating: "Trout" } },
  ],
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function externalIdFor(categoryCode: string, title: string): string {
  const base = `${categoryCode}-${slugify(title)}`;
  return createHash("sha256").update(base).digest("hex").slice(0, 16);
}

function toScrapedProduct(category: FleetFarmCategoryConfig, template: ProductTemplate): ScrapedProduct {
  const externalId = externalIdFor(category.code, template.title);
  const price = template.price;
  const rating = simulatedRating(externalId);

  return {
    externalId,
    title: template.title,
    price,
    brand: template.brand,
    description: template.description,
    productUrl: `https://www.fleetfarm.com/demo/${category.code}/${slugify(template.title)}`,
    categoryPath: category.categoryPath,
    categoryCode: category.code,
    attributes: {
      ...template.attributes,
      brand: template.brand,
      price,
      rating,
      availability: "In Stock",
    },
  };
}

/** Curated FleetFarm-style fixture catalog for demo/offline seeding. */
export function getFixtureCatalog(categories: FleetFarmCategoryConfig[] = FLEETFARM_CATEGORIES): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];

  for (const category of categories) {
    const templates = CATEGORY_TEMPLATES[category.code] ?? [];
    const limited = templates.slice(0, category.maxProducts);
    for (const template of limited) {
      products.push(toScrapedProduct(category, template));
    }
  }

  return products;
}
