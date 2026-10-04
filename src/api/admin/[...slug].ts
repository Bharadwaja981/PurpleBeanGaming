import { handleRoute } from '../../server/vercelEndpoint';

/**
 * Vercel Serverless Function: /api/admin/*
 */
export default async function handler(req: any, res: any) {
  const slugPath = Array.isArray(req.query?.slug) ? req.query.slug.join('/') : (req.query?.slug || '');
  return handleRoute(`/api/admin/${slugPath}`)(req, res);
}
