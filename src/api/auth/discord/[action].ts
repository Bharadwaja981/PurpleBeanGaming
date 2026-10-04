import { handleRoute } from '../../../server/vercelEndpoint';

/**
 * Fallback Vercel Serverless Function for Discord OAuth:
 * - GET  /api/auth/discord/status
 * - POST /api/auth/discord/start
 * - GET  /api/auth/discord/callback
 * - POST /api/auth/discord/unlink
 */
export default async function handler(req: any, res: any) {
  const rawAction = req.query?.action || '';
  const cleanAction = rawAction.replace(/\.js$/, '');
  return handleRoute(`/api/auth/discord/${cleanAction}`)(req, res);
}
