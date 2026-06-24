export type BigBoxCategorySeed = {
  code: string;
  name: string;
  skuCode: string;
  productStems: readonly string[];
};

export type BigBoxLeafCategorySeed = {
  code: string;
  name: string;
};

export type BigBoxSubcategorySeed = {
  code: string;
  name: string;
  leaves: readonly BigBoxLeafCategorySeed[];
};

/** Two subcategory levels under each department, each with leaf categories (depth 3). */
export const BIGBOX_CATEGORY_TREE: Record<string, readonly BigBoxSubcategorySeed[]> = {
  electronics: [
    {
      code: "audio",
      name: "Audio",
      leaves: [
        { code: "headphones", name: "Headphones & Earbuds" },
        { code: "speakers", name: "Speakers" },
      ],
    },
    {
      code: "computing",
      name: "Computing",
      leaves: [
        { code: "peripherals", name: "Keyboards & Mice" },
        { code: "webcams", name: "Webcams & Accessories" },
      ],
    },
  ],
  home_garden: [
    {
      code: "bedding",
      name: "Bedding",
      leaves: [
        { code: "sheets", name: "Sheets & Pillowcases" },
        { code: "pillows", name: "Pillows" },
      ],
    },
    {
      code: "decor",
      name: "Decor",
      leaves: [
        { code: "planters", name: "Planters & Garden" },
        { code: "lighting", name: "Lighting" },
      ],
    },
  ],
  tools_hardware: [
    {
      code: "power_tools",
      name: "Power Tools",
      leaves: [
        { code: "drills", name: "Drills & Drivers" },
        { code: "saws", name: "Saws & Grinders" },
      ],
    },
    {
      code: "hand_tools",
      name: "Hand Tools",
      leaves: [
        { code: "measuring", name: "Measuring & Layout" },
        { code: "tool_storage", name: "Storage & Organization" },
      ],
    },
  ],
  sporting_goods: [
    {
      code: "fitness",
      name: "Fitness",
      leaves: [
        { code: "yoga_training", name: "Yoga & Training" },
        { code: "team_sports", name: "Team Sports" },
      ],
    },
    {
      code: "outdoor",
      name: "Outdoor",
      leaves: [
        { code: "camping", name: "Camping" },
        { code: "cycling", name: "Cycling & Helmets" },
      ],
    },
  ],
  automotive: [
    {
      code: "fluids",
      name: "Fluids & Chemicals",
      leaves: [
        { code: "motor_oil", name: "Motor Oil & Fluids" },
        { code: "wash_care", name: "Wash & Care" },
      ],
    },
    {
      code: "accessories",
      name: "Accessories",
      leaves: [
        { code: "interior", name: "Interior Accessories" },
        { code: "lighting_elec", name: "Lighting & Electrical" },
      ],
    },
  ],
  pet_supplies: [
    {
      code: "dog",
      name: "Dog",
      leaves: [
        { code: "dog_food", name: "Dog Food & Treats" },
        { code: "dog_gear", name: "Dog Beds & Gear" },
      ],
    },
    {
      code: "cat",
      name: "Cat",
      leaves: [
        { code: "cat_food", name: "Cat Food & Litter" },
        { code: "cat_gear", name: "Cat Toys & Furniture" },
      ],
    },
  ],
  grocery_pantry: [
    {
      code: "pantry",
      name: "Pantry Staples",
      leaves: [
        { code: "cooking", name: "Cooking & Oil" },
        { code: "snacks", name: "Snacks & Bars" },
      ],
    },
    {
      code: "beverages",
      name: "Beverages",
      leaves: [
        { code: "coffee_tea", name: "Coffee & Tea" },
        { code: "water_drinks", name: "Water & Drinks" },
      ],
    },
  ],
  apparel_family: [
    {
      code: "mens_apparel",
      name: "Men's",
      leaves: [
        { code: "mens_tops", name: "Tops & Hoodies" },
        { code: "mens_bottoms", name: "Pants & Shorts" },
      ],
    },
    {
      code: "unisex_apparel",
      name: "Unisex",
      leaves: [
        { code: "outerwear", name: "Jackets & Rain Gear" },
        { code: "basics", name: "Socks & Accessories" },
      ],
    },
  ],
  furniture_home: [
    {
      code: "living",
      name: "Living Room",
      leaves: [
        { code: "seating", name: "Chairs & Ottomans" },
        { code: "tables", name: "Tables & Stands" },
      ],
    },
    {
      code: "office",
      name: "Office",
      leaves: [
        { code: "desks", name: "Desks & Lamps" },
        { code: "storage_furn", name: "Shelving & Storage" },
      ],
    },
  ],
  toys_games: [
    {
      code: "creative",
      name: "Creative Play",
      leaves: [
        { code: "building", name: "Building & Art" },
        { code: "plush", name: "Plush & Puzzles" },
      ],
    },
    {
      code: "games",
      name: "Games",
      leaves: [
        { code: "board_games", name: "Board & Card Games" },
        { code: "outdoor_toys", name: "Outdoor & RC Toys" },
      ],
    },
  ],
};

export type BigBoxLeafRef = {
  departmentCode: string;
  departmentName: string;
  departmentSkuCode: string;
  subcategoryCode: string;
  subcategoryName: string;
  leafCode: string;
  leafName: string;
};

export function listBigBoxLeafCategories(): BigBoxLeafRef[] {
  const leaves: BigBoxLeafRef[] = [];
  for (const department of BIGBOX_CATEGORIES) {
    const subcategories = BIGBOX_CATEGORY_TREE[department.code] ?? [];
    for (const subcategory of subcategories) {
      for (const leaf of subcategory.leaves) {
        leaves.push({
          departmentCode: department.code,
          departmentName: department.name,
          departmentSkuCode: department.skuCode,
          subcategoryCode: subcategory.code,
          subcategoryName: subcategory.name,
          leafCode: leaf.code,
          leafName: leaf.name,
        });
      }
    }
  }
  return leaves;
}

function slugifyCode(code: string): string {
  return code.replace(/_/g, "-");
}

export function categoryPathSegments(
  departmentCode: string,
  subcategoryCode: string,
  leafCode: string,
): { slug: string; path: string; code: string } {
  const slug = slugifyCode(leafCode);
  const code = `${departmentCode}__${subcategoryCode}__${leafCode}`;
  const path = `${BIGBOX_ROOT.path}/${slugifyCode(departmentCode)}/${slugifyCode(subcategoryCode)}/${slug}`;
  return { slug, path, code };
}

/** Big-box retail departments (Target / Walmart–style aisles). */
export const BIGBOX_ROOT = {
  code: "big-box",
  name: "Big Box Store",
  slug: "big-box",
  path: "/big-box",
} as const;

export const BIGBOX_CATEGORIES: readonly BigBoxCategorySeed[] = [
  {
    code: "electronics",
    name: "Electronics",
    skuCode: "ELEC",
    productStems: [
      "Wireless Earbuds",
      "Bluetooth Speaker",
      "USB-C Charging Cable",
      "LED Desk Lamp",
      "Portable Power Bank",
      "Wireless Mouse",
      "Mechanical Keyboard",
      "HD Webcam",
      "Tablet Stand",
      "Smart Plug 4-Pack",
    ],
  },
  {
    code: "home_garden",
    name: "Home & Garden",
    skuCode: "HOME",
    productStems: [
      "Microfiber Sheet Set",
      "Memory Foam Pillow",
      "Shower Curtain Liner",
      "Indoor Herb Garden Kit",
      "Ceramic Planter",
      "LED String Lights",
      "Storage Ottoman",
      "Kitchen Towel Set",
      "Area Rug",
      "Wall Clock",
    ],
  },
  {
    code: "tools_hardware",
    name: "Tools & Hardware",
    skuCode: "TOOL",
    productStems: [
      "Cordless Drill Kit",
      "Screwdriver Set",
      "Tape Measure",
      "Utility Knife",
      "Adjustable Wrench",
      "Hammer",
      "Safety Glasses",
      "Work Gloves",
      "Extension Cord",
      "Toolbox",
    ],
  },
  {
    code: "sporting_goods",
    name: "Sporting Goods",
    skuCode: "SPRT",
    productStems: [
      "Yoga Mat",
      "Insulated Water Bottle",
      "Camping Chair",
      "Resistance Band Set",
      "Basketball",
      "Soccer Ball",
      "Tennis Balls 3-Pack",
      "Bike Helmet",
      "Cooler Bag",
      "Jump Rope",
    ],
  },
  {
    code: "automotive",
    name: "Automotive",
    skuCode: "AUTO",
    productStems: [
      "Motor Oil 5W-30",
      "Windshield Washer Fluid",
      "Car Wash Kit",
      "Tire Pressure Gauge",
      "Jumper Cables",
      "Microfiber Wash Mitt",
      "Cup Holder Organizer",
      "Phone Mount",
      "LED Headlight Bulbs",
      "Cargo Trunk Organizer",
    ],
  },
  {
    code: "pet_supplies",
    name: "Pet Supplies",
    skuCode: "PET",
    productStems: [
      "Dry Dog Food",
      "Cat Litter",
      "Pet Bed",
      "Chew Toy",
      "Retractable Leash",
      "Stainless Food Bowl",
      "Grooming Brush",
      "Cat Scratching Post",
      "Pet Waste Bags",
      "Aquarium Starter Kit",
    ],
  },
  {
    code: "grocery_pantry",
    name: "Grocery & Pantry",
    skuCode: "GROC",
    productStems: [
      "Pasta Sauce",
      "Extra Virgin Olive Oil",
      "Peanut Butter",
      "Granola Bars 12-Pack",
      "Bottled Water 24-Pack",
      "Ground Coffee",
      "Cereal Family Size",
      "Canned Soup",
      "Rice 5 lb Bag",
      "Snack Mix Variety Pack",
    ],
  },
  {
    code: "apparel_family",
    name: "Clothing & Apparel",
    skuCode: "APRL",
    productStems: [
      "Crew Neck T-Shirt",
      "Fleece Hoodie",
      "Denim Jeans",
      "Athletic Shorts",
      "Socks 6-Pack",
      "Baseball Cap",
      "Rain Jacket",
      "Pajama Set",
      "Tank Top",
      "Windbreaker",
    ],
  },
  {
    code: "furniture_home",
    name: "Furniture",
    skuCode: "FURN",
    productStems: [
      "Bookshelf",
      "TV Stand",
      "Office Chair",
      "Dining Chair Set",
      "Coffee Table",
      "Nightstand",
      "Folding Table",
      "Desk Lamp",
      "Coat Rack",
      "Shoe Rack",
    ],
  },
  {
    code: "toys_games",
    name: "Toys & Games",
    skuCode: "TOYS",
    productStems: [
      "Building Block Set",
      "Board Game",
      "Plush Toy",
      "Puzzle 500 Pieces",
      "Remote Control Car",
      "Art Supply Kit",
      "Play-Doh Pack",
      "Card Game",
      "Outdoor Bubble Machine",
      "STEM Science Kit",
    ],
  },
] as const;

export const BIGBOX_BRANDS = [
  "Everyday Essentials",
  "HomeLine",
  "ProGrade",
  "ActiveLife",
  "FreshMarket",
  "TechHub",
  "ComfortZone",
  "TrailReady",
  "FamilyChoice",
  "ValueMax",
] as const;

export const BIGBOX_APPAREL_COLORS = ["Black", "Blue", "Gray", "Red", "White"] as const;
export const BIGBOX_APPAREL_SIZES = ["S", "M", "L", "XL"] as const;
