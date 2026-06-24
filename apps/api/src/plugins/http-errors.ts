import type { FastifyInstance } from "fastify";
import { resolveHttpError } from "@productinfoman/shared";

export async function registerHttpErrorHandlers(app: FastifyInstance): Promise<void> {
  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: "Not Found" });
  });

  app.setErrorHandler((error, request, reply) => {
    const { statusCode, message, logDetail } = resolveHttpError(error);
    if (logDetail) {
      request.log.error({ err: error, detail: logDetail }, "Unhandled request error");
    }
    return reply.code(statusCode).send({ error: message });
  });
}

export { resolveHttpError };
