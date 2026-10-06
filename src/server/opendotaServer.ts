/**
 * Purple Bean Gaming — Server-Side OpenDota Integration & Telemetry Manager
 */

export interface OpenDotaServerStatus {
  providerName: string;
  status: 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR';
  hasApiKey: boolean;
  rateLimitRemaining?: number;
  lastCheckedAt?: string;
  maskedKey: string | null;
}

export interface OpenDotaConnectionTestResult {
  success: boolean;
  message: string;
  diagnostic: {
    maskedKey: string | null;
    httpStatus?: number;
    latencyMs?: number;
  };
}

class OpenDotaServerManager {
  private providerName = 'OpenDota API v1';
  private customApiKey: string | null = null;

  public setApiKey(key: string | null) {
    this.customApiKey = key;
  }

  public getApiKey(): string | null {
    return this.customApiKey || process.env.OPENDOTA_API_KEY || process.env.VITE_OPENDOTA_API_KEY || null;
  }

  public getMaskedKey(): string | null {
    const key = this.getApiKey();
    if (!key) return null;
    if (key.length <= 8) return '****...****';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }

  public getStatus(): OpenDotaServerStatus {
    const key = this.getApiKey();
    return {
      providerName: this.providerName,
      status: key ? 'CONNECTED' : 'NOT_CONFIGURED',
      hasApiKey: Boolean(key),
      maskedKey: this.getMaskedKey(),
      lastCheckedAt: new Date().toISOString()
    };
  }

  public async testConnection(fetchFn: typeof fetch = fetch): Promise<OpenDotaConnectionTestResult> {
    const key = this.getApiKey();
    const maskedKey = this.getMaskedKey();
    const startTime = Date.now();

    try {
      const url = key 
        ? `https://api.opendota.com/api/health?api_key=${encodeURIComponent(key)}`
        : 'https://api.opendota.com/api/health';

      const res = await fetchFn(url, { method: 'GET' });
      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        return {
          success: true,
          message: 'OpenDota API connection successful.',
          diagnostic: {
            maskedKey,
            httpStatus: res.status,
            latencyMs
          }
        };
      } else {
        return {
          success: false,
          message: `OpenDota API returned HTTP ${res.status}`,
          diagnostic: {
            maskedKey,
            httpStatus: res.status,
            latencyMs
          }
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `OpenDota API connection failed: ${err.message || 'Network error'}`,
        diagnostic: {
          maskedKey,
          latencyMs: Date.now() - startTime
        }
      };
    }
  }
}

export const openDotaServerManager = new OpenDotaServerManager();
