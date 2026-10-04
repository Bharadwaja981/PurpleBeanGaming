import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const entryPoints = [
  // Exact Discord handlers
  { in: 'src/api/auth/discord/status.ts', out: 'api/auth/discord/status' },
  { in: 'src/api/auth/discord/start.ts', out: 'api/auth/discord/start' },
  { in: 'src/api/auth/discord/callback.ts', out: 'api/auth/discord/callback' },
  { in: 'src/api/auth/discord/unlink.ts', out: 'api/auth/discord/unlink' },
  { in: 'src/api/auth/discord/[action].ts', out: 'api/auth/discord/[action]' },

  // Exact Steam handlers
  { in: 'src/api/steam/link/status.ts', out: 'api/steam/link/status' },
  { in: 'src/api/steam/link/start.ts', out: 'api/steam/link/start' },
  { in: 'src/api/steam/link/callback.ts', out: 'api/steam/link/callback' },
  { in: 'src/api/steam/link/unlink.ts', out: 'api/steam/link/unlink' },
  { in: 'src/api/steam/link/[action].ts', out: 'api/steam/link/[action]' },

  // Auction, OpenDota, Admin handlers
  { in: 'src/api/auction/[...slug].ts', out: 'api/auction/[...slug]' },
  { in: 'src/api/opendota/[...slug].ts', out: 'api/opendota/[...slug]' },
  { in: 'src/api/admin/[...slug].ts', out: 'api/admin/[...slug]' },
];

console.log('[buildApi] Bundling serverless function endpoints for Vercel Pro...');

async function run() {
  for (const ep of entryPoints) {
    await build({
      entryPoints: [join(rootDir, ep.in)],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      outfile: join(rootDir, `${ep.out}.js`),
      external: ['firebase-admin', 'express'],
      sourcemap: false,
      minify: false,
    });
    console.log(`✓ Bundled: ${ep.out}.js`);
  }
  console.log('[buildApi] All Vercel serverless functions bundled successfully.');
}

run().catch((err) => {
  console.error('[buildApi] Build failed:', err);
  process.exit(1);
});
