import type { FastifyInstance } from 'fastify';

/**
 * OLANET AI route contract.
 *
 * The actual model call is intentionally kept server-side. This route is the
 * integration point for Circle-specific OLANET AI configuration and history.
 * It returns a clear configuration error until an AI provider is configured.
 */
export async function registerOlanetAIRoutes(app: FastifyInstance) {
  app.post('/api/ai/circle', async (request, reply) => {
    const body = request.body as {
      circleId?: number;
      message?: string;
      sessionId?: number;
    };

    if (!body?.circleId || !body?.message?.trim()) {
      return reply.code(400).send({ error: 'circleId and message are required.' });
    }

    return reply.code(503).send({
      error: 'OLANET AI provider is not configured yet.',
      aiName: 'OLANET AI',
      circleId: body.circleId,
      sessionId: body.sessionId ?? null,
    });
  });
}
