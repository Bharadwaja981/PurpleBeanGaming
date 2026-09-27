/**
 * Purple Bean Gaming — Server-Side OpenDota Integration & Proxy
 * 
 * Securely manages OpenDota requests and credentials.
 * Ensures OPENDOTA_API_KEY is NEVER exposed to client bundles or browser network requests.
 * Tracks connection health, rate limits, and latency diagnostics.
 */

import { Router, Request, Response } from 'express';

export interface OpenDotaDiagnosticState {
  providerName: string;
  configured: boolean;
  status: 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR';
  lastSuccessfulRequest: string | null;
  lastError: string | null;
  lastTestedAt: string | null;
  latencyMs: number | null;
  rateLimitRemaining: number | null;
  rateLimitReset: string | null;
  maskedKey: string | null;
}

class OpenDotaServerManager {
  private diagnosticState: OpenDotaDiagnosticState = {
    providerName: 'OpenDota API v1',
    configured: false,
    status: 'NOT_CONFIGURED',
    lastSuccessfulRequest: null,
    lastError: null,
    lastTestedAt: null,
    latencyMs: null,
    rateLimitRemaining: null,
    rateLimitReset: null,
    maskedKey: null
  };

  constructor() {
    this.refreshConfigurationStatus();
  }

  public getApiKey(): string | undefined {
    return process.env.OPENDOTA_API_KEY?.trim();
  }

  public refreshConfigurationStatus() {
    const key = this.getApiKey();
    if (key && key.length > 0) {
      this.diagnosticState.configured = true;
      this.diagnosticState.maskedKey = `${key.slice(0, 4)}...${key.slice(-4)}`;
      // If previously not configured, set status to pending/ready
      if (this.diagnosticState.status === 'NOT_CONFIGURED') {
        this.diagnosticState.status = 'CONNECTED';
      }
    } else {
      this.diagnosticState.configured = false;
      this.diagnosticState.maskedKey = null;
      this.diagnosticState.status = 'NOT_CONFIGURED';
    }
  }

  public getStatus(): OpenDotaDiagnosticState {
    this.refreshConfigurationStatus();
    return { ...this.diagnosticState };
  }

  /**
   * Helper to perform OpenDota fetch attaching server-side API key if present
   */
  public async fetchOpenDota(endpoint: string, options: { timeoutMs?: number } = {}) {
    const key = this.getApiKey();
    const separator = endpoint.includes('?') ? '&' : '?';
    const targetUrl = key 
      ? `https://api.opendota.com/api${endpoint}${separator}api_key=${encodeURIComponent(key)}`
      : `https://api.opendota.com/api${endpoint}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 4000);

    const startTime = Date.now();
    try {
      const response = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;

      // Extract rate limit headers from OpenDota if available
      const remainingHeader = response.headers.get('x-rate-limit-remaining-minute') || response.headers.get('x-rate-limit-remaining-day');
      const resetHeader = response.headers.get('x-rate-limit-reset');

      if (remainingHeader) {
        this.diagnosticState.rateLimitRemaining = parseInt(remainingHeader, 10);
      }
      if (resetHeader) {
        this.diagnosticState.rateLimitReset = new Date(parseInt(resetHeader, 10) * 1000).toISOString();
      }

      if (response.ok) {
        this.diagnosticState.status = 'CONNECTED';
        this.diagnosticState.lastSuccessfulRequest = new Date().toISOString();
        this.diagnosticState.latencyMs = latencyMs;
        this.diagnosticState.lastError = null;
        const data = await response.json();
        return { ok: true, status: response.status, data, latencyMs };
      } else {
        const errorText = await response.text();
        const errMessage = `OpenDota HTTP ${response.status}: ${errorText.slice(0, 150)}`;
        this.diagnosticState.status = response.status === 429 ? 'ERROR' : 'ERROR';
        this.diagnosticState.lastError = errMessage;
        return { ok: false, status: response.status, error: errMessage, latencyMs };
      }
    } catch (err: any) {
      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;
      const isAbort = err.name === 'AbortError';
      const msg = isAbort ? 'OpenDota request timed out (>4000ms).' : (err.message || 'Network error reaching OpenDota.');
      this.diagnosticState.status = 'ERROR';
      this.diagnosticState.lastError = msg;
      this.diagnosticState.latencyMs = latencyMs;
      return { ok: false, status: 504, error: msg, latencyMs };
    }
  }

  /**
   * Diagnostic test connection endpoint
   */
  public async testConnection(): Promise<{ success: boolean; message: string; latencyMs?: number; diagnostic: OpenDotaDiagnosticState }> {
    this.refreshConfigurationStatus();
    const hasKey = Boolean(this.getApiKey());

    this.diagnosticState.lastTestedAt = new Date().toISOString();

    // Query lightweight status / metadata endpoint on OpenDota
    const result = await this.fetchOpenDota('/metadata', { timeoutMs: 3000 });

    if (result.ok) {
      this.diagnosticState.status = 'CONNECTED';
      this.diagnosticState.lastSuccessfulRequest = new Date().toISOString();
      return {
        success: true,
        message: hasKey 
          ? 'Successfully connected to OpenDota API using configured server key.' 
          : 'Successfully reached OpenDota public unauthenticated tier (No key configured).',
        latencyMs: result.latencyMs,
        diagnostic: this.getStatus()
      };
    } else {
      return {
        success: false,
        message: `Connection failed: ${result.error}`,
        latencyMs: result.latencyMs,
        diagnostic: this.getStatus()
      };
    }
  }
}

export const openDotaServerManager = new OpenDotaServerManager();

export const opendotaRouter = Router();

// 1. Integration Status
opendotaRouter.get('/status', (_req: Request, res: Response) => {
  res.json(openDotaServerManager.getStatus());
});

// 2. Test Connection (Admin diagnostic trigger)
opendotaRouter.post('/test', async (_req: Request, res: Response) => {
  const result = await openDotaServerManager.testConnection();
  res.json(result);
});

// 3. Proxy Player Profile
opendotaRouter.get('/players/:accountId', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const result = await openDotaServerManager.fetchOpenDota(`/players/${accountId}`);
  if (result.ok) {
    res.json(result.data);
  } else {
    res.status(result.status).json({ error: result.error });
  }
});

// 4. Proxy Win/Loss
opendotaRouter.get('/players/:accountId/wl', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const result = await openDotaServerManager.fetchOpenDota(`/players/${accountId}/wl`);
  if (result.ok) {
    res.json(result.data);
  } else {
    res.status(result.status).json({ error: result.error });
  }
});

// 5. Proxy Recent Matches
opendotaRouter.get('/players/:accountId/recentMatches', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const result = await openDotaServerManager.fetchOpenDota(`/players/${accountId}/recentMatches`);
  if (result.ok) {
    res.json(result.data);
  } else {
    res.status(result.status).json({ error: result.error });
  }
});

// 6. Proxy Player Heroes
opendotaRouter.get('/players/:accountId/heroes', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const result = await openDotaServerManager.fetchOpenDota(`/players/${accountId}/heroes`);
  if (result.ok) {
    res.json(result.data);
  } else {
    res.status(result.status).json({ error: result.error });
  }
});

// 7. Proxy Match Details
opendotaRouter.get('/matches/:matchId', async (req: Request, res: Response) => {
  const matchId = req.params.matchId;
  const result = await openDotaServerManager.fetchOpenDota(`/matches/${matchId}`);
  if (result.ok) {
    res.json(result.data);
  } else {
    res.status(result.status).json({ error: result.error });
  }
});
