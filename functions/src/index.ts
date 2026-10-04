import { onRequest } from 'firebase-functions/v2/https';
import express, { Request, Response } from 'express';
import { apiRouter } from '../../src/server/apiRouter';

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

// Production health check
app.get(['/api/health', '/health'], (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'purplebeangaming-api',
    provider: 'firebase-cloud-functions',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.get(['/api', '/'], (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'purplebeangaming-api',
    provider: 'firebase-cloud-functions',
    message: 'Purple Bean Gaming Authoritative API Gateway',
    timestamp: new Date().toISOString()
  });
});

// Mount the API router for both `/api` prefix and `/` root prefix
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Export the HTTPS Firebase Cloud Function
export const api = onRequest({
  cors: true,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 10,
  secrets: [
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_BOT_TOKEN',
    'DISCORD_GUILD_ID',
    'DISCORD_PBG_MEMBER_ROLE_ID',
    'DISCORD_REDIRECT_URI',
    'DISCORD_UNLINK_REVOKES_ROLE',
    'STEAM_WEB_API_KEY',
    'OPENDOTA_API_KEY'
  ]
}, app);
