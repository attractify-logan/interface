import { useState, useEffect, useCallback } from 'react';
import { GatewayClient } from '../gateway';

interface ConfigViewProps {
  getActiveClient: () => GatewayClient | null;
}

export default function ConfigView({ getActiveClient }: ConfigViewProps) {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const refresh = useCallback(async () => {
    const client = getActiveClient();
    if (!client?.connected) return;

    setLoading(true);
    setError(null);
    try {
      const res = await client.request('config.get', {});
      setConfig(res?.config || res);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, [getActiveClient]);

  useEffect(() => { refresh(); }, [refresh]);

  const filteredConfig = config && filter
    ? filterObj(config, filter.toLowerCase())
    : config;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto py-6 px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Configuration</h2>
          <button
            onClick={refresh}
            disabled={loading}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        </div>

        {/* Filter */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Filter keys..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-border-focus"
          />
        </div>

        {error && (
          <div className="text-sm text-red-400 mb-4">Error: {error}</div>
        )}

        {config ? (
          <pre className="bg-surface-raised border border-border rounded-lg p-4 text-xs text-text-secondary overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(filteredConfig, null, 2)}
          </pre>
        ) : (
          <div className="text-center text-text-muted py-12">
            <div className="text-3xl mb-3">⚙️</div>
            <div>{loading ? 'Loading configuration...' : 'No configuration available'}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple recursive filter for config object
function filterObj(obj: any, query: string): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj;

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.toLowerCase().includes(query)) {
      result[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      const filtered = filterObj(value, query);
      if (Object.keys(filtered).length > 0) {
        result[key] = filtered;
      }
    } else if (String(value).toLowerCase().includes(query)) {
      result[key] = value;
    }
  }
  return result;
}
