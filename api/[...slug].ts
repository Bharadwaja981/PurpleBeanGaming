import express, { Request, Response, NextFunction } from 'express';
import { apiRouter } from '../src/server/apiRouter';

const app = express();

// Safe body parsing: If Vercel already parsed req.body, avoid re-reading stream
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

// Mount router on both `/api` and `/` so that routes match regardless of path normalization
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Fallback JSON 404 handler (guarantees NO HTML error pages)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `API endpoint ${req.method} ${req.originalUrl || req.url} not found`
  });
});

// Global error handler returning structured JSON
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Handler Error]:', err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      success: false,
      error: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An internal API error occurred'
    });
  }
});

export default async function handler(req: any, res: any) {
  try {
    // Normalise req.url if Vercel mapped it into slug params
    if (req.query?.slug && Array.isArray(req.query.slug)) {
      const slugPath = '/' + req.query.slug.join('/');
      if (!req.url || !req.url.includes(req.query.slug[0])) {
        const queryIdx = (req.url || '').indexOf('?');
        const queryPart = queryIdx >= 0 ? req.url.slice(queryIdx) : '';
        req.url = '/api' + slugPath + queryPart;
      }
    }
    return app(req, res);
  } catch (fatalErr: any) {
    console.error('[Fatal Handler Exception]:', fatalErr);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: fatalErr?.message || 'Serverless invocation error'
      }));
    }
  }
}
