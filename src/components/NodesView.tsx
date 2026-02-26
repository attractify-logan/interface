import { useState, useEffect, useCallback } from 'react';
import type { NodeInfo, Gateway } from '../types';
import { GatewayClient } from '../gateway';
import { Box, RefreshCw, Server, Smartphone } from 'lucide-react';

interface NodeWithGateway extends NodeInfo {
  gatewayId: string;
  gatewayName: string;
}

interface NodesViewProps {
  gateways: Map<string, Gateway>;
  getClient: (gwId: string) => GatewayClient | null;
}

export default function NodesView({ gateways, getClient }: NodesViewProps) {
  const [allNodes, setAllNodes] = useState<NodeWithGateway[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const combined: NodeWithGateway[] = [];

    // Fetch nodes from ALL gateways
    const promises = Array.from(gateways.values()).map(async (gw) => {
      if (!gw.connected) return;

      const client = getClient(gw.config.id);
      if (!client?.connected) return;

      try {
        const res = await client.request('node.list', {});
        const nodes = res?.nodes || [];
        nodes.forEach((n: NodeInfo) => {
          combined.push({
            ...n,
            gatewayId: gw.config.id,
            gatewayName: gw.config.name,
          });
        });
      } catch { }
    });

    await Promise.all(promises);
    setAllNodes(combined);
    setLoading(false);
  }, [gateways, getClient]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto py-6 px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Nodes</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Manage paired devices across gateways</p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {allNodes.length === 0 ? (
          <div className="text-center text-[var(--color-text-muted)] py-16">
            <div className="text-6xl mb-4">📱</div>
            <div className="text-lg font-medium text-[var(--color-text-primary)]">No nodes paired</div>
            <div className="text-sm mt-2">Pair a device via the OpenClaw mobile app or CLI</div>
          </div>
        ) : (
          <div className="space-y-3">
            {allNodes.map(n => (
              <div
                key={`${n.gatewayId}-${n.id}`}
                className="p-5 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-focus)] transition-all duration-200 hover-lift"
                style={{
                  background: 'var(--gradient-card)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Smartphone size={20} className="text-[var(--color-text-secondary)]" />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[var(--color-surface)]`}
                        style={{
                          background: n.connected ? 'var(--status-online)' : 'var(--status-warning)',
                          boxShadow: n.connected
                            ? '0 0 8px var(--status-online)'
                            : '0 0 8px var(--status-warning)',
                        }}
                      />
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--color-text-primary)]">
                        {n.name || n.id}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1.5"
                          style={{
                            background: 'var(--gradient-card)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          <Server size={10} />
                          {n.gatewayName}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {n.platform || 'unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {n.connected ? (
                      <span className="text-[var(--status-online)] font-medium">Online</span>
                    ) : (
                      <span className="text-[var(--status-warning)] font-medium">Offline</span>
                    )}
                  </div>
                </div>
                {n.caps && n.caps.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {n.caps.map(c => (
                      <span
                        key={c}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium"
                        style={{
                          background: 'var(--color-surface-hover)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                {n.lastSeen && (
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Last seen: {new Date(n.lastSeen).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
