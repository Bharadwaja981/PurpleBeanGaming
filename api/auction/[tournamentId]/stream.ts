import { handleRoute } from '../../../src/server/vercelEndpoint';

/**
 * Vercel Serverless Function: GET /api/auction/:tournamentId/stream
 */
export default async function handler(req: any, res: any) {
  const tournamentId = req.query?.tournamentId || req.query?.id || '';
  return handleRoute(`/api/auction/${tournamentId}/stream`)(req, res);
}
