import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { productRoutes } from "./modules/product-core/product.routes.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(productRoutes, { prefix: "/api/v1" });

app.get("/health", async () => ({ status: "ok" }));

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
