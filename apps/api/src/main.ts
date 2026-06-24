import "dotenv/config";
import { loadApiEnv } from "@productinfoman/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { importRoutes } from "./modules/import/import.routes.js";
import { startImportWorker } from "./modules/import/import.queue.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import { reportsRoutes } from "./modules/reports/reports.routes.js";
import { integrationRoutes } from "./modules/integration/integration.routes.js";
import { startEventWorker } from "./modules/integration/integration.queue.js";
import { productRoutes } from "./modules/product-core/product.routes.js";
import { searchRoutes } from "./modules/search/search.routes.js";
import { startSearchWorker } from "./modules/search/search.queue.js";
import { publishRoutes } from "./modules/publish/publish.routes.js";
import { startPublishWorker } from "./modules/publish/publish.queue.js";
import { taxonomyRoutes } from "./modules/taxonomy/taxonomy.routes.js";
import { workflowRoutes } from "./modules/workflow/workflow.routes.js";
import { mdmRoutes } from "./modules/mdm/mdm.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { registerRateLimitHook } from "./plugins/rate-limit.js";
import { registerSecurityPlugins } from "./plugins/security.js";

const env = loadApiEnv();
const corsOrigin = env.CORS_ORIGINS
  ? env.CORS_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean)
  : true;
const app = Fastify({
  logger: true,
  trustProxy: true,
  bodyLimit: env.JSON_BODY_LIMIT_BYTES,
});

await app.register(cors, {
  origin: corsOrigin,
  credentials: true,
});
await registerSecurityPlugins(app);
await app.register(authRoutes, { prefix: "/api/v1" });
await app.register(usersRoutes, { prefix: "/api/v1" });
await app.register(productRoutes, { prefix: "/api/v1" });
await app.register(taxonomyRoutes, { prefix: "/api/v1" });
await app.register(importRoutes, { prefix: "/api/v1" });
await app.register(workflowRoutes, { prefix: "/api/v1" });
await app.register(searchRoutes, { prefix: "/api/v1" });
await app.register(publishRoutes, { prefix: "/api/v1" });
await app.register(integrationRoutes, { prefix: "/api/v1" });
await app.register(auditRoutes, { prefix: "/api/v1" });
await app.register(reportsRoutes, { prefix: "/api/v1" });
await app.register(mdmRoutes, { prefix: "/api/v1" });

registerRateLimitHook(app);

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
