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

// Mount the API router for both `/api` prefix AND `/` root prefix
// (Vercel serverless mounts can pass either /api/steam/... or /steam/...)
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Health check and root ping for Vercel deployment
app.get(['/api/health', '/health'], (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'purplebeangaming-api',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    status: 'ok',
    service: 'Purple Bean Gaming API (Vercel Serverless)',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    status: 'ok',
    service: 'Purple Bean Gaming API (Vercel Serverless Root)',
    timestamp: new Date().toISOString()
  });
});

export default app;
