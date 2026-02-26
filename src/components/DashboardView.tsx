import { useState, useEffect, useCallback } from 'react';
import type { Gateway } from '../types';
import { GatewayClient } from '../gateway';
import { Activity, Server, MessageSquare, Box, RefreshCw } from 'lucide-react';

interface DashboardViewProps {
  gateways: Map<string, Gateway>;
  activeGateway: Gateway | null;
  getActiveClient: () => GatewayClient | null;
  getClient: (gwId: string) => GatewayClient | null;
}

interface GatewayStatusData {
  gatewayId: string;
  version?: string;
  uptime?: number;
  sessionCount: number;
  nodeCount: number;
  health?: any;
}

export default function DashboardView({ gateways, getClient }: DashboardViewProps) {
  const [gatewayStatuses, setGatewayStatuses] = useState<Map<string, GatewayStatusData>>(new Map());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const statusMap = new Map<string, GatewayStatusData>();

    // Fetch status for ALL gateways
    const promises = Array.from(gateways.values()).map(async (gw) => {
      if (!gw.connected) {
        statusMap.set(gw.config.id, {
          gatewayId: gw.config.id,
          sessionCount: 0,
          nodeCount: 0,
        });
        return;
      }

      const client = getClient(gw.config.id);
      if (!client?.connected) {
        statusMap.set(gw.config.id, {
          gatewayId: gw.config.id,
          sessionCount: 0,
          nodeCount: 0,
        });
        return;
      }

      try {
        const [statusRes, nodesRes, sessionsRes, healthRes] = await Promise.allSettled([
          client.request('status', {}),
          client.request('node.list', {}),
          client.request('sessions.list', { limit: 100 }),
          client.request('health', {}),
        ]);

        statusMap.set(gw.config.id, {
          gatewayId: gw.config.id,
          version: statusRes.status === 'fulfilled' ? statusRes.value?.version : undefined,
          uptime: statusRes.status === 'fulfilled' ? statusRes.value?.uptime : undefined,
          nodeCount: nodesRes.status === 'fulfilled' ? (nodesRes.value?.nodes?.length || 0) : 0,
          sessionCount: sessionsRes.status === 'fulfilled' ? (sessionsRes.value?.sessions?.length || 0) : 0,
          health: healthRes.status === 'fulfilled' ? healthRes.value : undefined,
        });
      } catch {
        statusMap.set(gw.config.id, {
          gatewayId: gw.config.id,
          sessionCount: 0,
          nodeCount: 0,
        });
      }
    });

    await Promise.all(promises);
    setGatewayStatuses(statusMap);
    setLoading(false);
  }, [gateways, getClient]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Calculate summary stats
  const totalGateways = gateways.size;
  const connectedGateways = Array.from(gateways.values()).filter(gw => gw.connected).length;
  const totalSessions = Array.from(gatewayStatuses.values()).reduce((sum, s) => sum + s.sessionCount, 0);
  const totalNodes = Array.from(gatewayStatuses.values()).reduce((sum, s) => sum + s.nodeCount, 0);

  if (gateways.size === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)]">
        <div className="text-center">
          <div className="text-6xl mb-4">🤡</div>
          <div className="text-lg font-medium text-[var(--color-text-primary)]">No gateways configured</div>
          <div className="text-sm mt-2">Add a gateway to get started with the federation</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto py-6 px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Gateway Federation</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Monitor all connected gateways</p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div
            className="p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-focus)] transition-all duration-200 hover-lift"
            style={{
              background: 'var(--gradient-card)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--color-surface-hover)]">
                <Server size={20} className="text-[var(--color-text-secondary)]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {connectedGateways}/{totalGateways}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">Connected Gateways</div>
              </div>
            </div>
          </div>

          <div
            className="p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-focus)] transition-all duration-200 hover-lift"
            style={{
              background: 'var(--gradient-card)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--color-surface-hover)]">
                <MessageSquare size={20} className="text-[var(--color-text-secondary)]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">{totalSessions}</div>
                <div className="text-xs text-[var(--color-text-muted)]">Total Sessions</div>
              </div>
            </div>
          </div>

          <div
            className="p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-focus)] transition-all duration-200 hover-lift"
            style={{
              background: 'var(--gradient-card)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--color-surface-hover)]">
                <Box size={20} className="text-[var(--color-text-secondary)]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">{totalNodes}</div>
                <div className="text-xs text-[var(--color-text-muted)]">Paired Nodes</div>
              </div>
            </div>
          </div>

          <div
            className="p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-focus)] transition-all duration-200 hover-lift"
            style={{
              background: 'var(--gradient-card)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--color-surface-hover)]">
                <Activity size={20} className="text-[var(--color-text-secondary)]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {Math.round((connectedGateways / totalGateways) * 100)}%
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">Health Status</div>
              </div>
            </div>
          </div>
        </div>

        {/* Gateway Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from(gateways.values()).map(gw => {
            const status = gatewayStatuses.get(gw.config.id);
            const uptimePercent = status?.uptime ? Math.min(100, (status.uptime / 86400000) * 100) : 0;

            return (
              <div
                key={gw.config.id}
                className="p-5 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-focus)] transition-all duration-200 hover-lift"
                style={{
                  background: 'var(--gradient-card)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <Server size={20} className="text-[var(--color-text-secondary)]" />
                    <span
                      className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[var(--color-surface)]`}
                      style={{
                        background: gw.connected ? 'var(--status-online)' : 'var(--status-offline)',
                        boxShadow: gw.connected
                          ? '0 0 8px var(--status-online)'
                          : '0 0 8px var(--status-offline)',
                      }}
                    />
                  </div>
                  {gw.identity?.emoji && <span className="text-xl">{gw.identity.emoji}</span>}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[var(--color-text-primary)] truncate">
                      {gw.config.name}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {gw.connected ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-[var(--color-surface-hover)]">
                    <div className="text-lg font-bold text-[var(--color-text-primary)]">
                      {gw.agents.length}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">Agents</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--color-surface-hover)]">
                    <div className="text-lg font-bold text-[var(--color-text-primary)]">
                      {status?.sessionCount || 0}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">Sessions</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--color-surface-hover)]">
                    <div className="text-lg font-bold text-[var(--color-text-primary)]">
                      {status?.nodeCount || 0}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">Nodes</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--color-surface-hover)]">
                    <div className="text-lg font-bold text-[var(--color-text-primary)] truncate">
                      {gw.defaultModel?.split('/').pop()?.slice(0, 8) || '—'}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">Model</div>
                  </div>
                </div>

                {/* Uptime Progress */}
                {status?.uptime !== undefined && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[var(--color-text-muted)]">Uptime</span>
                      <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                        {formatUptime(status.uptime)}
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--status-online)] transition-all duration-500"
                        style={{
                          width: `${uptimePercent}%`,
                          boxShadow: '0 0 8px var(--status-online)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}
