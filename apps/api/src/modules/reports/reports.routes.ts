import type { FastifyInstance } from "fastify";
import { ReportPeriodQuerySchema } from "@productinfoman/validation";
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

  app.get("/reports/dashboard", async (request, reply) => {
    try {
      const query = ReportPeriodQuerySchema.parse(request.query ?? {});
      const period = reportsService.resolveReportPeriod(query);
      const report = await reportsService.computeDashboard(request.organizationId, period);
      return reply.send(report);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/reports/completeness", async (request, reply) => {
    try {
      const query = ReportPeriodQuerySchema.parse(request.query ?? {});
      const period = reportsService.resolveReportPeriod(query);
      const report = await reportsService.computeCompletenessReport(request.organizationId, period);
      return reply.send(report);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/reports/workflow", async (request, reply) => {
    try {
      const query = ReportPeriodQuerySchema.parse(request.query ?? {});
      const period = reportsService.resolveReportPeriod(query);
      const report = await reportsService.computeWorkflowReport(request.organizationId, period);
      return reply.send(report);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/reports/imports", async (request, reply) => {
    try {
      const query = ReportPeriodQuerySchema.parse(request.query ?? {});
      const period = reportsService.resolveReportPeriod(query);
      const report = await reportsService.computeImportReport(request.organizationId, period);
      return reply.send(report);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/reports/publishes", async (request, reply) => {
    try {
      const query = ReportPeriodQuerySchema.parse(request.query ?? {});
      const period = reportsService.resolveReportPeriod(query);
      const report = await reportsService.computePublishReport(request.organizationId, period);
      return reply.send(report);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });
}
