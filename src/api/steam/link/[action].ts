import { handleRoute } from '../../../server/vercelEndpoint';

/**
 * Fallback Vercel Serverless Function for Steam OpenID:
 * - GET  /api/steam/link/status
 * - POST /api/steam/link/start
 * - GET  /api/steam/link/callback
 * - POST /api/steam/link/unlink
 */
export default async function handler(req: any, res: any) {
  const rawAction = req.query?.action || '';
  const cleanAction = rawAction.replace(/\.js$/, '');
  return handleRoute(`/api/steam/link/${cleanAction}`)(req, res);
}
