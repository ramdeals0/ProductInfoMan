import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import {
  CreateImportTemplateSchema,
  ListImportsQuerySchema,
  UploadImportSchema,
} from "@productinfoman/validation";
import { AppError } from "@productinfoman/shared";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt, assertRoles, ROLE_GROUPS } from "../../plugins/rbac.js";
import * as importService from "./import.service.js";

function handleError(error: unknown): { statusCode: number; message: string } {
  if (error instanceof AppError) {
    return { statusCode: error.statusCode, message: error.message };
  }
  if (error && typeof error === "object" && "statusCode" in error) {
    return {
      statusCode: (error as { statusCode: number }).statusCode,
      message: (error as Error).message,
    };
  }
  return { statusCode: 500, message: (error as Error).message ?? "Internal error" };
}

export async function importRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", authenticateJwt);

  app.post("/imports/upload", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.IMPORT_OPS);
      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ error: "CSV file is required" });
      }

      const fields = file.fields as Record<string, { value?: string } | undefined>;
      const input = UploadImportSchema.parse({
        importTemplateId: fields.importTemplateId?.value,
        importType: fields.importType?.value,
        duplicatePolicy: fields.duplicatePolicy?.value,
        blankCellPolicy: fields.blankCellPolicy?.value,
        sourceSystem: fields.sourceSystem?.value,
      });

      const buffer = await file.toBuffer();
      const job = await importService.uploadImport(request.organizationId, {
        ...input,
        fileName: file.filename,
        fileBuffer: buffer,
      });

      return reply.code(201).send(job);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/imports/:id/validate", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.IMPORT_OPS);
      const { id } = request.params as { id: string };
      const job = await importService.validateImport(id, request.organizationId);
      return reply.send(job);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/imports/:id/start", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.IMPORT_OPS);
      const { id } = request.params as { id: string };
      const job = await importService.startImport(id, request.organizationId);
      return reply.send(job);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/imports/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const job = await importService.getImportJob(id, request.organizationId);
      return reply.send(job);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/imports", async (request, reply) => {
    try {
      const query = ListImportsQuerySchema.parse(request.query ?? {});
      const result = await importService.listImportJobs(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/imports/:id/errors", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const errors = await importService.getImportErrors(id, request.organizationId);
      return reply.send({ items: errors });
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/imports/:id/report", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const report = await importService.getImportReport(id, request.organizationId);
      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="import-${id}-errors.csv"`);
      return reply.send(report);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/import-templates", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.IMPORT_OPS);
      const body = CreateImportTemplateSchema.parse(request.body);
      const template = await importService.createImportTemplate(request.organizationId, body);
      return reply.code(201).send(template);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/import-templates", async (request, reply) => {
    try {
      const templates = await importService.listImportTemplates(request.organizationId);
      return reply.send({ items: templates });
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });
}
