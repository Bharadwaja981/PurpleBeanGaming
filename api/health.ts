import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Production Health Check Handler
 * GET /api/health
 *
 * Lightweight, zero-dependency endpoint that guarantees 200 OK
 * for Vercel, monitoring probes, and frontend heartbeat checks.
 */
export default function handler(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({
    ok: true,
    service: 'purplebeangaming-api',
    status: 'ok',
    timestamp: new Date().toISOString()
  }));
}
