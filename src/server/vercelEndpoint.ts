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
 * Normalizes req.url to defaultPath + query string (stripping any accidental .js extension)
 * and returns a Promise that completes only when the HTTP response has finished sending.
 */
export function handleRoute(defaultPath: string) {
  return function vercelHandler(req: any, res: any): Promise<void> {
    return new Promise((resolve) => {
      try {
        const rawUrl = (req.url || '').replace(/\.js(\?|$)/, '$1');
        const queryIdx = rawUrl.indexOf('?');
        const q = queryIdx >= 0 ? rawUrl.slice(queryIdx) : '';
        const cleanDefaultPath = defaultPath.replace(/\.js$/, '');
        req.url = cleanDefaultPath + q;

        // Ensure lambda does not exit before response is fully transmitted
        res.once('finish', () => resolve());
        res.once('close', () => resolve());

        app(req, res, (err: any) => {
          if (err && !res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: false,
              error: 'INTERNAL_SERVER_ERROR',
              message: err?.message || 'Serverless invocation error'
            }));
          }
          resolve();
        });
      } catch (fatalErr: any) {
        console.error('[Fatal Handler Error]:', fatalErr);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: fatalErr?.message || 'Serverless invocation error'
          }));
        }
        resolve();
      }
    });
  };
}
