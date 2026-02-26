import { useState } from 'react';
import { Server, Plus, Activity, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import type { Gateway, SessionInfo } from '../types';
import type { AggregatedAgent, SpawnConfig } from '../hooks/useAgentSpawn';

interface AgentsViewProps {
  gateways: Map<string, Gateway>;
  sessions: SessionInfo[];
  aggregatedAgents: AggregatedAgent[];
  onSpawn: (config: SpawnConfig) => Promise<void>;
  onSwitchSession: (key: string) => void;
  onSwitchGateway: (gwId: string) => void;
  getClient: (gwId: string) => any;
}

interface GatewayWithAgents {
  gateway: Gateway;
  agents: AggregatedAgent[];
}

export default function AgentsView({
  gateways,
  sessions,
  aggregatedAgents,
  onSpawn,
  onSwitchSession,
  onSwitchGateway,
}: AgentsViewProps) {
  const [expandedGateways, setExpandedGateways] = useState<Set<string>>(new Set());
  const [expandedAgentSessions, setExpandedAgentSessions] = useState<Set<string>>(new Set());
  const [spawning, setSpawning] = useState<Set<string>>(new Set());

  // Group agents by gateway
  const gatewayGroups: GatewayWithAgents[] = Array.from(gateways.values())
    .map(gw => ({
      gateway: gw,
      agents: aggregatedAgents.filter(a => a.gatewayId === gw.config.id),
    }))
    .filter(g => g.gateway.connected && g.agents.length > 0);

  const toggleGateway = (gwId: string) => {
    setExpandedGateways(prev => {
      const next = new Set(prev);
      if (next.has(gwId)) {
        next.delete(gwId);
      } else {
        next.add(gwId);
      }
      return next;
    });
  };

  const toggleAgentSessions = (agentKey: string) => {
    setExpandedAgentSessions(prev => {
      const next = new Set(prev);
      if (next.has(agentKey)) {
        next.delete(agentKey);
      } else {
        next.add(agentKey);
      }
      return next;
    });
  };

  const handleSpawn = async (agentId: string, gatewayId: string) => {
    const spawnKey = `${gatewayId}-${agentId}`;
    setSpawning(prev => new Set(prev).add(spawnKey));

    try {
      await onSpawn({
        agentId,
        gatewayId,
      });
    } catch (error) {
      console.error('Failed to spawn agent:', error);
      alert(`Failed to spawn agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSpawning(prev => {
        const next = new Set(prev);
        next.delete(spawnKey);
        return next;
      });
    }
  };

  const getAgentSessions = (agentId: string): SessionInfo[] => {
    return sessions.filter(s => s.agentId === agentId);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  if (gatewayGroups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)]">
        <div className="text-center">
          <div className="text-6xl mb-4">🤖</div>
          <div className="text-lg font-medium text-[var(--color-text-primary)]">No agents available</div>
          <div className="text-sm mt-2">Connect to a gateway with configured agents</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto py-6 px-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Agents</h2>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Spawn and manage agent sessions across gateways
              </p>
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-all"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          {/* Gateway Cards */}
          <div className="space-y-4">
            {gatewayGroups.map(({ gateway, agents }) => {
              const isExpanded = expandedGateways.has(gateway.config.id);
              const totalSessions = agents.reduce((sum, a) => sum + a.activeSessions, 0);

              return (
                <div
                  key={gateway.config.id}
                  className="border border-[var(--color-border)] rounded-xl overflow-hidden transition-all duration-200 hover:border-[var(--color-border-focus)]"
                  style={{
                    background: 'var(--gradient-card)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {/* Gateway Header */}
                  <button
                    onClick={() => toggleGateway(gateway.config.id)}
                    className="w-full p-5 flex items-center gap-4 text-left hover:bg-[var(--color-surface-hover)] transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown size={20} className="text-[var(--color-text-secondary)]" />
                      ) : (
                        <ChevronRight size={20} className="text-[var(--color-text-secondary)]" />
                      )}
                    </div>

                    <div className="relative flex-shrink-0">
                      <Server size={24} className="text-[var(--color-text-secondary)]" />
                      <span
                        className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[var(--color-surface)]"
                        style={{
                          background: gateway.connected ? 'var(--status-online)' : 'var(--status-offline)',
                          boxShadow: gateway.connected
                            ? '0 0 8px var(--status-online)'
                            : '0 0 8px var(--status-offline)',
                        }}
                      />
                    </div>

                    {gateway.identity?.emoji && (
                      <span className="text-2xl flex-shrink-0">{gateway.identity.emoji}</span>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {gateway.config.name}
                        </h3>
                        <span className="text-xs px-2 py-1 rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                          {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                        {gateway.config.url}
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-medium text-[var(--color-text-primary)]">
                          {gateway.defaultModel?.split('/').pop()?.slice(0, 10) || '—'}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">Default Model</div>
                      </div>
                      {totalSessions > 0 && (
                        <div className="text-center">
                          <div className="font-medium text-[var(--color-text-primary)]">{totalSessions}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">Active Sessions</div>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Agent Rows */}
                  {isExpanded && (
                    <div className="border-t border-[var(--color-border)] animate-fade-in">
                      <div className="divide-y divide-[var(--color-border)]">
                        {agents.map(agent => {
                          const agentKey = `${agent.gatewayId}-${agent.id}`;
                          const sessionsExpanded = expandedAgentSessions.has(agentKey);
                          const agentSessions = getAgentSessions(agent.id);
                          const isSpawning = spawning.has(agentKey);

                          return (
                            <div key={agentKey} className="bg-[var(--color-surface-raised)]">
                              <div className="px-6 py-4 flex items-center gap-4">
                                <div className="text-2xl flex-shrink-0">{agent.emoji}</div>

                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-[var(--color-text-primary)]">
                                    {agent.name}
                                  </div>
                                  <div className="text-sm text-[var(--color-text-muted)] mt-0.5 line-clamp-1">
                                    {agent.description}
                                  </div>
                                </div>

                                <div className="flex-shrink-0 flex items-center gap-3">
                                  {agent.activeSessions > 0 && (
                                    <button
                                      onClick={() => toggleAgentSessions(agentKey)}
                                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-secondary)]"
                                    >
                                      <Activity size={14} />
                                      {agent.activeSessions} {agent.activeSessions === 1 ? 'session' : 'sessions'}
                                      {sessionsExpanded ? (
                                        <ChevronDown size={14} />
                                      ) : (
                                        <ChevronRight size={14} />
                                      )}
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleSpawn(agent.id, agent.gatewayId)}
                                    disabled={isSpawning}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover)] transition-all disabled:opacity-50 text-[var(--color-text-primary)]"
                                    style={{
                                      background: 'var(--gradient-card)',
                                    }}
                                  >
                                    <Plus size={16} />
                                    {isSpawning ? 'Spawning...' : 'New Session'}
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Sessions List */}
                              {sessionsExpanded && agentSessions.length > 0 && (
                                <div className="px-6 pb-4 animate-fade-in">
                                  <div className="pl-10 space-y-2">
                                    {agentSessions.map(session => (
                                      <button
                                        key={session.key}
                                        onClick={() => {
                                          onSwitchGateway(agent.gatewayId);
                                          onSwitchSession(session.key);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover)] transition-all text-left"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                            {session.title || session.key}
                                          </div>
                                          <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-3 mt-1">
                                            {session.messageCount !== undefined && (
                                              <span>{session.messageCount} messages</span>
                                            )}
                                            {session.lastActivity && (
                                              <span>{formatTime(session.lastActivity)}</span>
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}
