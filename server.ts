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
  if (!process.env.DISCORD_GUILD_ID) {
    process.env.DISCORD_GUILD_ID = '631715510631006219';
  }
  if (!process.env.DISCORD_PBG_MEMBER_ROLE_ID) {
    process.env.DISCORD_PBG_MEMBER_ROLE_ID = '1555885374713237524';
  }
  if (!process.env.DISCORD_PBG_PLAYER_ROLE_ID) {
    process.env.DISCORD_PBG_PLAYER_ROLE_ID = '1555884061111746651';
  }
  if (!process.env.DISCORD_PBG_CAPTAIN_ROLE_ID) {
    process.env.DISCORD_PBG_CAPTAIN_ROLE_ID = '1556338549807259658';
  }

  const express = (await import('express')).default;
  const { apiRouter } = await import('./src/server/apiRouter');

  // Dev mode determination:
  // AI Studio runs with NODE_ENV='development' or unset. Dev server must run on port 3000.
  const isDev = process.env.NODE_ENV !== 'production';
  const PORT = isDev ? 3000 : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

  const rootPath = process.cwd();
  const rootIndexPath = path.resolve(rootPath, 'index.html');
  const distPath = path.resolve(rootPath, 'dist');
  const distIndexPath = path.resolve(distPath, 'index.html');

  const app = express();
  app.use(express.json());

  // Mount Server-Authoritative Competition API Routes
  app.use('/api', apiRouter);

  // Health check endpoint (for Cloud Run and monitoring probes)
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'purplebeangaming-api',
      status: 'ok',
      environment: isDev ? 'development' : 'production',
      port: PORT,
      timestamp: new Date().toISOString()
    });
  });

  // If in development OR if production dist assets haven't been compiled yet:
  // Mount Vite development middlewares with live SPA HTML transformation.
  if (isDev || !fs.existsSync(distIndexPath)) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);

    // Dynamic HTML transformation for all SPA routes
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        if (!fs.existsSync(rootIndexPath)) {
          return next();
        }
        let template = fs.readFileSync(rootIndexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        if (vite.ssrFixStacktrace) {
          vite.ssrFixStacktrace(e);
        }
        next(e);
      }
    });
  } else {
    // Pure production mode with pre-compiled dist/ assets
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      if (fs.existsSync(distIndexPath)) {
        res.sendFile(distIndexPath);
      } else if (fs.existsSync(rootIndexPath)) {
        res.sendFile(rootIndexPath);
      } else {
        res.status(200).send('<!doctype html><html><body><div id="root"></div></body></html>');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Purple Bean Gaming] Full-stack server listening on http://0.0.0.0:${PORT} (${isDev ? 'dev mode with Vite middleware' : 'production static mode'})`);
  });

  // Handle termination signals gracefully
  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
