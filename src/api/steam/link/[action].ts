import { handleRoute } from '../../../server/vercelEndpoint';

/**
 * Consolidated Vercel Serverless Function for Steam OpenID:
 * - GET  /api/steam/link/status
 * - POST /api/steam/link/start
 * - GET  /api/steam/link/callback
 * - POST /api/steam/link/unlink
 */
export default async function handler(req: any, res: any) {
  const action = req.query?.action || '';
  return handleRoute(`/api/steam/link/${action}`)(req, res);
}
