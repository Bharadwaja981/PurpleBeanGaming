import express, { Request, Response } from 'express';
import { apiRouter } from '../src/server/apiRouter';

const app = express();
app.use(express.json());

// Enable CORS for web clients
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Dedicated health endpoint
app.get(['/api/health', '/health'], (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'purplebeangaming-api',
    status: 'ok',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString()
  });
});

app.get(['/api', '/'], (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'purplebeangaming-api',
    status: 'ok',
    message: 'Purple Bean Gaming Authoritative API Gateway',
    timestamp: new Date().toISOString()
  });
});

// Mount the API router for both `/api` prefix AND `/` root prefix
// This ensures that whether Vercel preserves the `/api` prefix or strips it,
// the route handler in apiRouter will match correctly.
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Error fallback handler - always returns JSON, never HTML
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('[API Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred.'
  });
});

export default app;
