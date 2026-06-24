import type { FastifyInstance } from "fastify";
import { AppError } from "@productinfoman/shared";
import { resolveTenant } from "../../plugins/tenant.js";
import * as reportsService from "./reports.service.js";

function handleError(error: unknown): { statusCode: number; message: string } {
  if (error instanceof AppError) {
    return { statusCode: error.statusCode, message: error.message };
  }
  return { statusCode: 500, message: (error as Error).message ?? "Internal error" };
}

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);

  app.get("/reports/summary", async (request, reply) => {
    try {
      const report = await reportsService.getOperationsReport(request.organizationId);
      return reply.send(report);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });
}
