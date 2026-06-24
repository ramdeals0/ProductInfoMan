import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveHttpError } from "@productinfoman/shared";

export function sendRouteError(
  reply: FastifyReply,
  request: FastifyRequest,
  error: unknown,
): FastifyReply {
  const { statusCode, message, logDetail, code } = resolveHttpError(error);
  if (logDetail) {
    request.log.error({ err: error, detail: logDetail }, "Request failed");
  }
  return reply.code(statusCode).send({
    error: message,
    ...(code ? { code } : {}),
  });
}
