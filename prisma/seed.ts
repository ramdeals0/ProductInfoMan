import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const products = [
    {
      sku: "SKU-001",
      name: "Wireless Mouse",
      description: "Ergonomic wireless mouse with USB receiver",
      price: 29.99,
      quantity: 150,
    },
    {
      sku: "SKU-002",
      name: "Mechanical Keyboard",
      description: "Compact mechanical keyboard with RGB backlight",
      price: 89.99,
      quantity: 75,
    },
    {
      sku: "SKU-003",
      name: "USB-C Hub",
      description: "7-in-1 USB-C hub with HDMI and SD card reader",
      price: 45.5,
      quantity: 200,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: product,
      create: product,
    });
  }

  console.log(`Seeded ${products.length} products`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
