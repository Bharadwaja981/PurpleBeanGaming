/**
 * Purple Bean Gaming — Full-Stack Express & Vite Server Entry Point
 * 
 * Runs on port 3000 in dev (or process.env.PORT in production / Cloud Run).
 * Mounts server-authoritative competition API at /api/*
 * and mounts Vite development middleware in dev mode or static files in production.
 */

import { spawn } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';

const isTsxRunning = 
  process.execArgv.some(a => a.includes('tsx') || a.includes('loader.mjs') || a.includes('preflight.cjs')) || 
  process.env.__TSX_REGISTERED__ === '1' ||
  (process.argv[1] && process.argv[1].includes('tsx')) ||
  Boolean(process.env.npm_lifecycle_script?.includes('tsx'));

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
  const distPath = path.resolve(process.cwd(), 'dist');
  const indexPath = path.resolve(distPath, 'index.html');

  // Authoritative production check:
  // In Cloud Run, K_SERVICE or K_REVISION is set, or NODE_ENV=production, or dist/index.html exists when not running dev script
  const isProd = 
    process.env.NODE_ENV === 'production' || 
    Boolean(process.env.K_SERVICE) || 
    Boolean(process.env.K_REVISION) ||
    process.env.npm_lifecycle_event === 'start' ||
    (fs.existsSync(indexPath) && process.env.npm_lifecycle_event !== 'dev');

  const app = express();
  app.use(express.json());

  // Mount Trusted Server Authoritative API Routes
  app.use('/api', apiRouter);

  // Health check endpoint (for Cloud Run and monitoring probes)
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Purple Bean Gaming Authoritative Server',
      environment: isProd ? 'production' : 'development',
      port: PORT,
      timestamp: new Date().toISOString()
    });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not Found: Application assets not built.');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Purple Bean Gaming] Full-stack authoritative server active on http://0.0.0.0:${PORT} (mode: ${isProd ? 'production' : 'development'})`);
  });

  // Handle Cloud Run termination signals gracefully
  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
