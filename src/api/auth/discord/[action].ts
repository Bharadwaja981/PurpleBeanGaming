import { handleRoute } from '../../../server/vercelEndpoint';

/**
 * Consolidated Vercel Serverless Function for Discord OAuth:
 * - GET  /api/auth/discord/status
 * - POST /api/auth/discord/start
 * - GET  /api/auth/discord/callback
 * - POST /api/auth/discord/unlink
 */
export default async function handler(req: any, res: any) {
  const action = req.query?.action || '';
  return handleRoute(`/api/auth/discord/${action}`)(req, res);
}
