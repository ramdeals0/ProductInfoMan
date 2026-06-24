import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString });

pool.on("error", (err) => {
  console.error("Unexpected pg pool error", err);
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
export { pool };
