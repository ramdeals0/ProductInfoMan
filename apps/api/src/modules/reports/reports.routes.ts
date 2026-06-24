import type { FastifyInstance } from "fastify";
import { ReportPeriodQuerySchema } from "@productinfoman/validation";
import { sendRouteError } from "../../lib/route-errors.js";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt } from "../../plugins/rbac.js";
import * as reportsService from "./reports.service.js";

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", authenticateJwt);

  app.get("/reports/summary", async (request, reply) => {
    try {
      const report = await reportsService.getOperationsReport(request.organizationId);
      return reply.send(report);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/reports/dashboard", async (request, reply) => {
    try {
      const query = ReportPeriodQuerySchema.parse(request.query ?? {});
      const period = reportsService.resolveReportPeriod(query);
      const report = await reportsService.computeDashboard(request.organizationId, period);
      return reply.send(report);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/reports/completeness", async (request, reply) => {
    try {
      const query = ReportPeriodQuerySchema.parse(request.query ?? {});
      const period = reportsService.resolveReportPeriod(query);
      const report = await reportsService.computeCompletenessReport(request.organizationId, period);
      return reply.send(report);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/reports/workflow", async (request, reply) => {
    try {
      const query = ReportPeriodQuerySchema.parse(request.query ?? {});
      const period = reportsService.resolveReportPeriod(query);
      const report = await reportsService.computeWorkflowReport(request.organizationId, period);
      return reply.send(report);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/reports/imports", async (request, reply) => {
    try {
      const query = ReportPeriodQuerySchema.parse(request.query ?? {});
      const period = reportsService.resolveReportPeriod(query);
      const report = await reportsService.computeImportReport(request.organizationId, period);
      return reply.send(report);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/reports/publishes", async (request, reply) => {
    try {
      const query = ReportPeriodQuerySchema.parse(request.query ?? {});
      const period = reportsService.resolveReportPeriod(query);
      const report = await reportsService.computePublishReport(request.organizationId, period);
      return reply.send(report);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });
}
