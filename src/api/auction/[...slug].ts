import { handleRoute } from '../../server/vercelEndpoint';

/**
 * Consolidated Vercel Serverless Function for Auction:
 * - GET  /api/auction/:tournamentId
 * - POST /api/auction/:tournamentId/sync
 * - GET  /api/auction/:tournamentId/stream
 */
export default async function handler(req: any, res: any) {
  const slugPath = Array.isArray(req.query?.slug) ? req.query.slug.join('/') : (req.query?.slug || '');
  return handleRoute(`/api/auction/${slugPath}`)(req, res);
}
