import type { Gateway, Tab, SessionInfo, FederatedSession } from '../types';
import { generateGatewayColor, generateGatewayColorWithAlpha } from '../utils/colors';
import {
  MessageSquare,
  LayoutDashboard,
  Users,
  History,
  Box,
  Clock,
  Settings,
  Plus,
  Server,
  Moon,
  Sun,
  Terminal as TerminalIcon,
  Link2,
  Bell,
  BellOff,
  RefreshCw,
  Info
} from 'lucide-react';
import { useState } from 'react';
import {
  isNotificationEnabled,
  toggleNotification,
  requestNotificationPermission,
} from '../notificationPrefs';

interface SidebarProps {
  gateways: Map<string, Gateway>;
  activeGatewayId: string | null;
  activeTab: Tab;
  activeSessionKey: string;
  sessions: SessionInfo[];
  federatedSessions?: FederatedSession[];
  activeFederatedSessionId?: string | null;
  chatMode?: 'standard' | 'federated';
  onChatModeChange?: (mode: 'standard' | 'federated') => void;
  onSwitchGateway: (id: string) => void;
  onSwitchTab: (tab: Tab) => void;
  onSwitchSession: (key: string) => void;
  onSwitchFederatedSession?: (id: string) => void;
  onCreateSession: () => void;
  onOpenSettings: (gatewayId?: string) => void;
  onDeleteSession?: (key: string) => void;
  onDeleteFederatedSession?: (id: string) => void;
  onSwitchAgent?: (gatewayId: string, agentId: string) => void;
  onReconnectGateway?: (config: { id: string; name: string; url: string }) => Promise<void>;
  activeAgentId?: string | null;
  streaming?: boolean;
  theme: 'dark' | 'light' | 'terminal';
  onToggleTheme: () => void;
}

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'agents', label: 'Agents', icon: Users },
  { id: 'sessions', label: 'Sessions', icon: History },
  { id: 'nodes', label: 'Nodes', icon: Box },
  { id: 'cron', label: 'Cron', icon: Clock },
  { id: 'config', label: 'Config', icon: Settings },
  { id: 'about', label: 'About', icon: Info },
];

function formatSessionName(key: string, isFederated: boolean = false): string {
  if (isFederated) {
    // For federated sessions, show a friendly name
    return key.length > 20 ? key.slice(0, 20) + '…' : key;
  }
  if (key === 'main') return 'Main';
  if (key.startsWith('webchat-')) {
    const ts = parseInt(key.split('-')[1]);
    if (!isNaN(ts)) {
      return 'Chat ' + new Date(ts).toLocaleString(undefined, {
        month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });
    }
  }
  if (key.includes('subagent:')) {
    const parts = key.split(':');
    return `Sub: ${parts[parts.length - 1].slice(0, 8)}`;
  }
  return key.length > 20 ? key.slice(0, 20) + '…' : key;
}

export default function Sidebar({
  gateways,
  activeGatewayId,
  activeTab,
  activeSessionKey,
  sessions,
  federatedSessions = [],
  activeFederatedSessionId,
  chatMode = 'standard',
  onChatModeChange,
  onSwitchGateway,
  onSwitchTab,
  onSwitchSession,
  onSwitchFederatedSession,
  onCreateSession,
  onOpenSettings,
  onDeleteSession,
  onDeleteFederatedSession,
  onSwitchAgent,
  onReconnectGateway,
  activeAgentId,
  streaming = false,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : TerminalIcon;
  const [reconnectingGateways, setReconnectingGateways] = useState<Set<string>>(new Set());
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>({});

  const handleNotificationToggle = async (gatewayId: string, agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Request permission if not already granted
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission && !isNotificationEnabled(gatewayId, agentId)) {
      alert('Notification permission denied. Please enable notifications in your browser settings.');
      return;
    }

    // Toggle the preference
    const newValue = toggleNotification(gatewayId, agentId);
    setNotificationPrefs(prev => ({
      ...prev,
      [`${gatewayId}:${agentId}`]: newValue
    }));
  };

  const handleReconnect = async (gw: Gateway, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onReconnectGateway) return;

    const gwId = gw.config.id;
    setReconnectingGateways(prev => new Set(prev).add(gwId));

    try {
      await onReconnectGateway({
        id: gw.config.id,
        name: gw.config.name,
        url: gw.config.url,
      });
    } catch (err) {
      console.error('Reconnect failed:', err);
    } finally {
      setReconnectingGateways(prev => {
        const next = new Set(prev);
        next.delete(gwId);
        return next;
      });
    }
  };

  return (
    <aside className="w-64 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none" style={{ lineHeight: 1 }}>🤡</span>
          <div>
            <h1 className="text-lg font-bold leading-none text-[var(--color-text-primary)]" style={{ lineHeight: 1 }}>
              Interface 🤡
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-1" style={{ lineHeight: 1 }}>Multi-Gateway Chat</p>
          </div>
        </div>
      </div>

      {/* Scrollable middle section */}
      <div className="flex-1 overflow-y-auto min-h-0">

      {/* New Chat Button with Mode Toggle */}
      {activeTab === 'chat' && (
        <div className="p-3 border-b border-[var(--color-border)]">
          {/* Mode Toggle */}
          {onChatModeChange && (
            <div className="flex gap-1 mb-2 p-1 bg-[var(--color-surface-hover)] rounded-lg">
              <button
                onClick={() => onChatModeChange('standard')}
                className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition-all ${
                  chatMode === 'standard'
                    ? 'bg-[var(--color-accent)] text-[var(--color-surface)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                Standard
              </button>
              <button
                onClick={() => onChatModeChange('federated')}
                className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition-all ${
                  chatMode === 'federated'
                    ? 'bg-[var(--color-accent)] text-[var(--color-surface)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                Federated
              </button>
            </div>
          )}

          <button
            onClick={onCreateSession}
            className="w-full py-2.5 px-4 rounded-xl border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-focus)] font-medium text-sm flex items-center gap-2 justify-center transition-all duration-200 hover-lift"
            style={{
              background: 'var(--gradient-card)',
            }}
          >
            <Plus size={16} />
            {chatMode === 'federated' ? 'New Federated Chat' : 'New Chat'}
          </button>
        </div>
      )}

      {/* Gateways */}
      <div className="p-3 border-b border-[var(--color-border)]">
        <div className="text-xs text-[var(--color-text-muted)] px-2 py-1 mb-2 font-semibold uppercase tracking-wide">
          Gateways
        </div>
        {Array.from(gateways.values()).map(gw => {
          const gatewayColor = generateGatewayColor(gw.config.id);
          const gatewayColorAlpha = generateGatewayColorWithAlpha(gw.config.id, 0.1);
          return (
          <div
            key={gw.config.id}
            className="relative group mb-2 transition-all duration-200"
          >
            <div
              className={`p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                activeGatewayId === gw.config.id
                  ? 'border-2 shadow-[var(--shadow-glow)]'
                  : 'border hover:border-[var(--color-border-focus)] hover-lift'
              }`}
              onClick={() => onSwitchGateway(gw.config.id)}
              title={gw.connected ? 'Connected' : 'Disconnected'}
              style={{
                background: activeGatewayId === gw.config.id
                  ? `linear-gradient(135deg, ${gatewayColorAlpha}, var(--color-surface-hover))`
                  : 'var(--gradient-card)',
                borderColor: activeGatewayId === gw.config.id ? gatewayColor : 'var(--color-border)',
                borderLeftWidth: '4px',
                borderLeftColor: gatewayColor,
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Server size={16} className="text-[var(--color-text-secondary)]" />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[var(--color-surface)] ${
                      gw.connected
                        ? 'bg-[var(--status-online)]'
                        : 'bg-[var(--status-offline)]'
                    }`}
                    style={{
                      boxShadow: gw.connected
                        ? '0 0 8px var(--status-online)'
                        : '0 0 8px var(--status-offline)'
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[var(--color-text-primary)] truncate">
                    {gw.config.name}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] truncate">
                    {gw.connected ? gw.defaultModel?.split('/').pop() || 'Connected' : 'Disconnected'}
                  </div>
                </div>
              </div>
              {/* Reconnect button for disconnected gateways */}
              {!gw.connected && onReconnectGateway && (
                <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                  <button
                    onClick={(e) => handleReconnect(gw, e)}
                    disabled={reconnectingGateways.has(gw.config.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg w-full text-xs font-medium transition-all text-[var(--color-text-primary)] bg-[var(--color-surface-hover)] hover:bg-[var(--color-accent)] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw
                      size={14}
                      className={reconnectingGateways.has(gw.config.id) ? 'animate-spin' : ''}
                    />
                    {reconnectingGateways.has(gw.config.id) ? 'Reconnecting...' : 'Reconnect'}
                  </button>
                </div>
              )}

              {/* Agents under this gateway */}
              {gw.connected && gw.agents && gw.agents.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--color-border)] space-y-0.5">
                  {gw.agents.map(agent => {
                    const isActive = activeGatewayId === gw.config.id && activeAgentId === agent.id;
                    // Get emoji from agent if available, otherwise use default
                    const agentEmoji = (agent as any).emoji || '🤖';
                    // Find subagent sessions for this agent
                    const subagentSessions = sessions.filter(s =>
                      s.key.includes('subagent:') && s.key.includes(agent.id)
                    );
                    const notifKey = `${gw.config.id}:${agent.id}`;
                    const notifEnabled = notificationPrefs[notifKey] ?? isNotificationEnabled(gw.config.id, agent.id);
                    return (
                      <div key={agent.id}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSwitchAgent?.(gw.config.id, agent.id);
                          }}
                          className={`flex items-center gap-2 px-1.5 py-1 rounded text-xs flex-1 text-left transition-colors ${
                            isActive
                              ? 'text-[var(--color-text-primary)] bg-[var(--color-surface-hover)] font-medium'
                              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
                          }`}
                        >
                          {isActive ? (
                            streaming ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-online)] flex-shrink-0 animate-pulse" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-online)] flex-shrink-0" />
                            )
                          ) : null}
                          <span className="text-sm">{agentEmoji}</span>
                          <span className="truncate flex-1">{agent.name || agent.id}</span>
                          {gw.defaultModel && (
                            <span className="text-[9px] font-mono bg-[var(--color-surface-raised)] px-1 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] flex-shrink-0">
                              {gw.defaultModel.split('/').pop()?.replace('claude-', '').replace('anthropic.', '')}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={(e) => handleNotificationToggle(gw.config.id, agent.id, e)}
                          className="p-1 rounded hover:bg-[var(--color-surface)] transition-colors flex-shrink-0"
                          title={notifEnabled ? 'Notifications enabled' : 'Notifications disabled'}
                        >
                          {notifEnabled ? (
                            <Bell size={12} className="text-[var(--color-accent)]" />
                          ) : (
                            <BellOff size={12} className="text-[var(--color-text-muted)]" />
                          )}
                        </button>
                        {/* Subagent sessions nested below */}
                        {subagentSessions.length > 0 && (
                          <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-[var(--color-border)] pl-2">
                            {subagentSessions.map(subSession => {
                              const isSubActive = activeSessionKey === subSession.key;
                              const parts = subSession.key.split(':');
                              const subName = parts[parts.length - 1].slice(0, 8);
                              return (
                                <button
                                  key={subSession.key}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSwitchSession(subSession.key);
                                  }}
                                  className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] w-full text-left transition-colors ${
                                    isSubActive
                                      ? 'text-[var(--color-text-primary)] bg-[var(--color-surface-hover)] font-medium'
                                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                                  }`}
                                  title={subSession.key}
                                >
                                  <span className="text-[10px]">└</span>
                                  <span className="truncate">Sub: {subName}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings(gw.config.id);
              }}
              className="absolute right-3 top-5 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] p-1 rounded"
              title="Gateway settings"
            >
              <Settings size={14} />
            </button>
          </div>
        );
        })}
        <button
          onClick={() => onOpenSettings()}
          className="w-full text-left px-3 py-2 rounded-lg text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-all duration-200 flex items-center gap-2"
        >
          <Plus size={12} />
          Add Gateway
        </button>
      </div>

      {/* Navigation */}
      <div className="p-3 border-b border-[var(--color-border)]">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onSwitchTab(tab.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm mb-1 transition-all duration-200 relative flex items-center gap-2.5 ${
                activeTab === tab.id
                  ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] font-semibold shadow-[var(--shadow-sm)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
              }`}
              style={{
                background: activeTab === tab.id ? 'var(--gradient-active)' : undefined,
              }}
            >
              {activeTab === tab.id && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/4 rounded-r"
                  style={{ background: 'var(--color-accent)' }}
                />
              )}
              <Icon size={16} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sessions (when on chat tab) */}
      {activeTab === 'chat' && (
        <div className="p-3">
          {/* Federated Sessions */}
          {federatedSessions.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between px-2 py-1 mb-2">
                <span className="text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wide">
                  Federated Sessions
                </span>
              </div>
              {federatedSessions.map(fs => (
                <div
                  key={fs.id}
                  className={`group relative w-full text-left rounded-lg px-3 py-2 text-sm mb-1 transition-all duration-200 ${
                    activeFederatedSessionId === fs.id
                      ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] font-medium shadow-[var(--shadow-sm)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
                  }`}
                  style={{
                    background: activeFederatedSessionId === fs.id ? 'var(--gradient-active)' : undefined,
                  }}
                >
                  {activeFederatedSessionId === fs.id && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/4 rounded-r"
                      style={{ background: 'var(--color-accent)' }}
                    />
                  )}
                  <button
                    onClick={() => onSwitchFederatedSession?.(fs.id)}
                    className="w-full text-left truncate pr-6 flex items-center gap-2"
                    title={fs.title || fs.id}
                  >
                    <Link2 size={14} className="flex-shrink-0" />
                    <span className="truncate">{fs.title || formatSessionName(fs.id, true)}</span>
                  </button>
                  {onDeleteFederatedSession && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this federated session?')) {
                          onDeleteFederatedSession(fs.id);
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--status-offline)] p-1 rounded"
                      title="Delete session"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Standard Sessions */}
          <div className="flex items-center justify-between px-2 py-1 mb-2">
            <span className="text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wide">
              Sessions
            </span>
          </div>
          {sessions.map(s => (
            <div
              key={s.key}
              className={`group relative w-full text-left rounded-lg px-3 py-2 text-sm mb-1 transition-all duration-200 ${
                activeSessionKey === s.key && !activeFederatedSessionId
                  ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] font-medium shadow-[var(--shadow-sm)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
              }`}
              style={{
                background: activeSessionKey === s.key && !activeFederatedSessionId ? 'var(--gradient-active)' : undefined,
              }}
            >
              {activeSessionKey === s.key && !activeFederatedSessionId && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/4 rounded-r"
                  style={{ background: 'var(--color-accent)' }}
                />
              )}
              <button
                onClick={() => onSwitchSession(s.key)}
                className="w-full text-left truncate pr-6"
                title={s.key}
              >
                {formatSessionName(s.key)}
              </button>
              {onDeleteSession && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this session?')) {
                      onDeleteSession(s.key);
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--status-offline)] p-1 rounded"
                  title="Delete session"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      </div>{/* end scrollable middle section */}

      {/* Footer */}
      <div className="p-3 border-t border-[var(--color-border)] flex items-center justify-between">
        <button
          onClick={() => onOpenSettings()}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors flex items-center gap-1.5 font-medium"
        >
          <Settings size={12} />
          Settings
        </button>
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-all duration-200"
          title={`Theme: ${theme} (click to cycle)`}
        >
          <ThemeIcon size={16} />
        </button>
      </div>
    </aside>
  );
}
