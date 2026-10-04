import { handleRoute } from '../../../src/server/vercelEndpoint';

/**
 * Vercel Serverless Function: POST /api/auction/:tournamentId/sync
 */
export default async function handler(req: any, res: any) {
  const tournamentId = req.query?.tournamentId || req.query?.id || '';
  return handleRoute(`/api/auction/${tournamentId}/sync`)(req, res);
}
