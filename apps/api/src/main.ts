import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { importRoutes } from "./modules/import/import.routes.js";
import { startImportWorker } from "./modules/import/import.queue.js";
import { integrationRoutes } from "./modules/integration/integration.routes.js";
import { startEventWorker } from "./modules/integration/integration.queue.js";
import { productRoutes } from "./modules/product-core/product.routes.js";
import { searchRoutes } from "./modules/search/search.routes.js";
import { startSearchWorker } from "./modules/search/search.queue.js";
import { publishRoutes } from "./modules/publish/publish.routes.js";
import { startPublishWorker } from "./modules/publish/publish.queue.js";
import { taxonomyRoutes } from "./modules/taxonomy/taxonomy.routes.js";
import { workflowRoutes } from "./modules/workflow/workflow.routes.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(productRoutes, { prefix: "/api/v1" });
await app.register(taxonomyRoutes, { prefix: "/api/v1" });
await app.register(importRoutes, { prefix: "/api/v1" });
await app.register(workflowRoutes, { prefix: "/api/v1" });
await app.register(searchRoutes, { prefix: "/api/v1" });
await app.register(publishRoutes, { prefix: "/api/v1" });
await app.register(integrationRoutes, { prefix: "/api/v1" });

await startImportWorker();
await startSearchWorker();
await startPublishWorker();
await startEventWorker();

app.get("/health", async () => ({ status: "ok" }));

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
