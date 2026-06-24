import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import {
  CreateImportTemplateSchema,
  ListImportRowsQuerySchema,
  ListImportsQuerySchema,
  UploadImportSchema,
} from "@productinfoman/validation";
import { sendRouteError } from "../../lib/route-errors.js";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt, assertRoleGroup } from "../../plugins/rbac.js";
import * as importService from "./import.service.js";

export async function importRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", authenticateJwt);

  app.post("/imports/upload", async (request, reply) => {
    try {
      assertRoleGroup(request, "IMPORT_OPS");
      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ error: "Import file is required" });
      }

      const query = request.query as { file_type?: string };
      const fields = file.fields as Record<string, { value?: string } | undefined>;
      const fileTypeRaw =
        fields.file_type?.value ??
        fields.fileType?.value ??
        query.file_type;
      const normalizedFileType = fileTypeRaw?.trim().toUpperCase();

      const input = UploadImportSchema.parse({
        importTemplateId: fields.importTemplateId?.value,
        importType: fields.importType?.value,
        duplicatePolicy: fields.duplicatePolicy?.value,
        blankCellPolicy: fields.blankCellPolicy?.value,
        sourceSystem: fields.sourceSystem?.value,
        fileType:
          normalizedFileType === "CSV" ||
          normalizedFileType === "XML" ||
          normalizedFileType === "JSON"
            ? normalizedFileType
            : undefined,
      });

      const buffer = await file.toBuffer();
      const job = await importService.uploadImport(request.organizationId, {
        ...input,
        fileName: file.filename,
        fileBuffer: buffer,
      });

      return reply.code(201).send(job);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/imports/:id/validate", async (request, reply) => {
    try {
      assertRoleGroup(request, "IMPORT_OPS");
      const { id } = request.params as { id: string };
      const job = await importService.validateImport(id, request.organizationId);
      return reply.send(job);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/imports/:id/start", async (request, reply) => {
    try {
      assertRoleGroup(request, "IMPORT_OPS");
      const { id } = request.params as { id: string };
      const job = await importService.startImport(id, request.organizationId);
      return reply.send(job);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/imports/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const job = await importService.getImportJob(id, request.organizationId);
      return reply.send(job);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/imports", async (request, reply) => {
    try {
      const query = ListImportsQuerySchema.parse(request.query ?? {});
      const result = await importService.listImportJobs(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/imports/:id/rows", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const query = ListImportRowsQuerySchema.parse(request.query ?? {});
      const rows = await importService.getImportRows(id, request.organizationId, query);
      return reply.send(rows);
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
      return sendRouteError(reply, request, e);
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
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/import-templates", async (request, reply) => {
    try {
      assertRoleGroup(request, "IMPORT_OPS");
      const body = CreateImportTemplateSchema.parse(request.body);
      const template = await importService.createImportTemplate(request.organizationId, body);
      return reply.code(201).send(template);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/import-templates", async (request, reply) => {
    try {
      const templates = await importService.listImportTemplates(request.organizationId);
      return reply.send({ items: templates });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });
}
