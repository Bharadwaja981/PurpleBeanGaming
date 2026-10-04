import express, { Request, Response, NextFunction } from 'express';
import { apiRouter } from './apiRouter';

const app = express();

// Safe body parsing: If Vercel has already parsed req.body, don't read stream again
app.use((req: any, _res: any, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    next();
  } else {
    express.json()(req, _res, next);
  }
});

// Enable CORS for all incoming clients
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Mount the full authoritative API router for both `/api` and `/`
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Global fallback JSON 404 handler (never return HTML)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `API endpoint ${req.method} ${req.originalUrl || req.url} not found`
  });
});

// Global fallback JSON error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]:', err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      success: false,
      error: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An internal API error occurred'
    });
  }
});

/**
 * Creates a robust Vercel Serverless Function handler for a specific route.
 * Always normalizes req.url to defaultPath + query string so Express router
 * always matches with 100% precision, regardless of how Vercel proxies it.
 */
export function handleRoute(defaultPath: string) {
  return async function vercelHandler(req: any, res: any) {
    try {
      const rawUrl = req.url || '';
      const queryIdx = rawUrl.indexOf('?');
      const q = queryIdx >= 0 ? rawUrl.slice(queryIdx) : '';
      req.url = defaultPath + q;
      return app(req, res);
    } catch (err: any) {
      console.error('[Fatal Handler Error]:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          error: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'Serverless invocation error'
        }));
      }
    }
  };
}
