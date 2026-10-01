import express, { Request, Response } from 'express';
import { apiRouter } from '../src/server/apiRouter';

const app = express();
app.use(express.json());

// Mount the API router
app.use('/api', apiRouter);

// Health check and root ping for Vercel deployment
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Purple Bean Gaming API (Vercel Serverless)',
    timestamp: new Date().toISOString()
  });
});

export default app;
