import { handleRoute } from '../../server/vercelEndpoint';

/**
 * Vercel Serverless Function: /api/opendota/*
 */
export default async function handler(req: any, res: any) {
  const slugPath = Array.isArray(req.query?.slug) ? req.query.slug.join('/') : '';
  const fullPath = `/api/opendota/${slugPath}`.replace(/\/+$/, '');
  return handleRoute(fullPath)(req, res);
}
