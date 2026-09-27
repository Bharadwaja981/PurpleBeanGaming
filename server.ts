/**
 * Purple Bean Gaming — Full-Stack Express & Vite Server Entry Point
 * 
 * Runs on port 3000. Mounts server-authoritative competition API at /api/*
 * and mounts Vite development middleware in dev mode or static files in production.
 */

import { spawn } from 'node:child_process';
import process from 'node:process';

const isTsxRunning = process.execArgv.some(a => a.includes('tsx')) || process.env.__TSX_REGISTERED__ === '1';

if (!isTsxRunning) {
  const child = spawn(process.execPath, ['--import', 'tsx', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, __TSX_REGISTERED__: '1' }
  });

  const forwardSignal = (signal: NodeJS.Signals) => {
    if (child.pid) child.kill(signal);
  };
  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    }
    process.exit(code ?? 0);
  });
} else {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

async function startServer() {
  const express = (await import('express')).default;
  const { apiRouter } = await import('./src/server/apiRouter');

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  const app = express();
  app.use(express.json());

  // Mount Trusted Server Authoritative API Routes
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Purple Bean Gaming Authoritative Server', timestamp: new Date().toISOString() });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Purple Bean Gaming] Full-stack authoritative server active on http://0.0.0.0:${PORT}`);
  });
}
