import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  ExternalLink, 
  ShieldCheck, 
  Key,
  Server,
  Zap,
  Info
} from 'lucide-react';
import { fetchOpenDotaStatus, testOpenDotaConnection, OpenDotaDiagnosticState } from '../services/openDotaService';

export function OpenDotaIntegrationsManager() {
  const [status, setStatus] = useState<OpenDotaDiagnosticState | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await fetchOpenDotaStatus();
      setStatus(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testOpenDotaConnection();
      setTestResult(res);
      setStatus(res.diagnostic);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Connection test error: ${err.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = () => {
    if (!status) return null;
    if (status.status === 'CONNECTED') {
      return (
        <span className="bg-[#70FFAF] text-black px-2.5 py-1 border-2 border-black font-mono text-xs font-black uppercase inline-flex items-center gap-1.5 shadow-[2px_2px_0px_0px_#000]">
          <CheckCircle className="w-3.5 h-3.5 text-black" />
          CONNECTED
        </span>
      );
    }
    if (status.status === 'NOT_CONFIGURED') {
      return (
        <span className="bg-[#FFE600] text-black px-2.5 py-1 border-2 border-black font-mono text-xs font-black uppercase inline-flex items-center gap-1.5 shadow-[2px_2px_0px_0px_#000]">
          <AlertTriangle className="w-3.5 h-3.5 text-black" />
          NOT CONFIGURED
        </span>
      );
    }
    return (
      <span className="bg-[#FF70A6] text-black px-2.5 py-1 border-2 border-black font-mono text-xs font-black uppercase inline-flex items-center gap-1.5 shadow-[2px_2px_0px_0px_#000]">
        <XCircle className="w-3.5 h-3.5 text-black" />
        ERROR / UNREACHABLE
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header and Live Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#7C3AED]" />
            <h2 className="text-xl font-black uppercase text-black font-sans">
              OPENDOTA API INTEGRATION &amp; TELEMETRY
            </h2>
          </div>
          <p className="font-mono text-xs text-stone-600 mt-1">
            Authoritative player MMR telemetry, match verification, and Steam identity resolution via OpenDota v1.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <button
            onClick={loadStatus}
            disabled={loading}
            className="p-1.5 border-2 border-black bg-white hover:bg-stone-100 disabled:opacity-50 cursor-pointer shadow-[2px_2px_0px_0px_#000]"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Connection Test Result Banner */}
      {testResult && (
        <div
          className={`p-4 border-2 border-black font-mono text-xs space-y-1 shadow-[3px_3px_0px_0px_#000] ${
            testResult.success ? 'bg-[#70FFAF] text-black' : 'bg-[#FF70A6] text-black'
          }`}
        >
          <div className="font-black text-sm flex items-center gap-2">
            {testResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{testResult.success ? 'DIAGNOSTIC TEST PASSED' : 'DIAGNOSTIC TEST FAILED'}</span>
            {testResult.latencyMs !== undefined && (
              <span className="text-[11px] font-normal">({testResult.latencyMs}ms roundtrip)</span>
            )}
          </div>
          <p className="text-xs">{testResult.message}</p>
        </div>
      )}

      {/* Status Details Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
        <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000] space-y-2">
          <div className="flex items-center gap-1.5 text-stone-500 font-bold uppercase text-[10px]">
            <Server className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>Provider Information</span>
          </div>
          <div className="text-base font-black text-black">
            {status?.providerName || 'OpenDota API v1'}
          </div>
          <div className="text-stone-600 text-[11px]">
            Endpoint: <span className="font-bold">https://api.opendota.com/api</span>
          </div>
        </div>

        <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000] space-y-2">
          <div className="flex items-center gap-1.5 text-stone-500 font-bold uppercase text-[10px]">
            <Key className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>API Key Configuration</span>
          </div>
          <div className="text-base font-black text-black">
            {status?.configured ? (
              <span className="text-emerald-700 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" />
                Active ({status.maskedKey})
              </span>
            ) : (
              <span className="text-amber-700">Not Configured</span>
            )}
          </div>
          <div className="text-stone-600 text-[11px]">
            Storage: <span className="font-bold">Server Environment Secret Only</span>
          </div>
        </div>

        <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000] space-y-2">
          <div className="flex items-center gap-1.5 text-stone-500 font-bold uppercase text-[10px]">
            <Zap className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>Rate Limit Status</span>
          </div>
          <div className="text-base font-black text-black">
            {status?.rateLimitRemaining !== null && status?.rateLimitRemaining !== undefined
              ? `${status.rateLimitRemaining} calls remaining`
              : status?.configured
              ? 'Tiered (50K / day)'
              : 'Public Tier (60 / min)'}
          </div>
          <div className="text-stone-600 text-[11px]">
            Reset: <span className="font-bold">{status?.rateLimitReset || 'Continuous sliding window'}</span>
          </div>
        </div>
      </div>

      {/* Telemetry Log */}
      <div className="bg-stone-50 border-2 border-black p-4 space-y-3 font-mono text-xs">
        <h4 className="font-black text-black uppercase text-sm border-b border-black pb-1">
          LIFECYCLE TELEMETRY &amp; HEALTH
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
          <div>
            <span className="text-stone-500 block">Last Successful Request:</span>
            <span className="font-bold text-black">
              {status?.lastSuccessfulRequest ? new Date(status.lastSuccessfulRequest).toLocaleString() : 'No requests logged yet'}
            </span>
          </div>
          <div>
            <span className="text-stone-500 block">Last Tested Timestamp:</span>
            <span className="font-bold text-black">
              {status?.lastTestedAt ? new Date(status.lastTestedAt).toLocaleString() : 'Never tested'}
            </span>
          </div>
          <div>
            <span className="text-stone-500 block">Last Recorded Provider Error:</span>
            <span className="font-bold text-red-600">
              {status?.lastError || 'None (Operational)'}
            </span>
          </div>
          <div>
            <span className="text-stone-500 block">Roundtrip Latency:</span>
            <span className="font-bold text-black">
              {status?.latencyMs !== null && status?.latencyMs !== undefined ? `${status.latencyMs} ms` : 'N/A'}
            </span>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-stone-300">
          <div className="text-[11px] text-stone-500">
            Click to send an authoritative health probe to OpenDota via trusted server proxy.
          </div>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="bg-[#FFE600] hover:bg-yellow-400 text-black px-4 py-2 border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 cursor-pointer"
          >
            {testing ? 'Testing Connection...' : 'Test Connection →'}
          </button>
        </div>
      </div>

      {/* Production Configuration Guide */}
      <div className="bg-white border-2 border-black p-5 space-y-3 font-mono text-xs shadow-[3px_3px_0px_0px_#000]">
        <div className="flex items-center gap-2 text-stone-800 font-black uppercase text-sm border-b-2 border-black pb-2">
          <Info className="w-4 h-4 text-[#7C3AED]" />
          <span>PRODUCTION OPENDOTA_API_KEY CONFIGURATION GUIDE</span>
        </div>
        <p className="text-stone-700 leading-relaxed">
          OpenDota API keys provide dedicated rate limit allocations and bypass public request throttles. To protect the secret key from browser leakage, Purple Bean Gaming proxies all OpenDota operations through server endpoints.
        </p>
        <div className="p-3 bg-stone-100 border border-black space-y-2">
          <div className="font-bold text-black">How to configure in production:</div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-stone-700">
            <li>
              Acquire an OpenDota API Key from{' '}
              <a
                href="https://www.opendota.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="underline text-[#7C3AED] font-bold"
              >
                https://www.opendota.com/api-keys
              </a>.
            </li>
            <li>
              Set the environment variable on the hosting container or server:
              <pre className="bg-black text-[#FFE600] p-2 mt-1 border border-black font-mono text-xs">
                OPENDOTA_API_KEY=your_opendota_key_here
              </pre>
            </li>
            <li>
              <strong>Security Invariant:</strong> Never place the key in client-side variables (e.g. <code className="bg-stone-200 px-1">VITE_</code>), public Firestore documents, or git repositories.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
