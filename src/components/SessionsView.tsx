import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Plus, Trash2, Edit2, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { SessionInfo, Gateway } from '../types';

interface SessionWithGateway extends SessionInfo {
  gatewayId: string;
  gatewayName: string;
  lastMessagePreview?: string;
}

interface SessionsViewProps {
  sessions: SessionInfo[];
  activeSessionKey: string;
  gateways: Map<string, Gateway>;
  getActiveClient?: () => any;
  getClient: (gwId: string) => any;
  onSwitchSession: (key: string) => void;
  onCreateSession: () => void;
  onRefresh: () => void;
}

type SortField = 'activity' | 'messages' | 'gateway' | 'agent';
type SortDirection = 'asc' | 'desc';

export default function SessionsView({
  gateways,
  getClient,
  activeSessionKey,
  onSwitchSession,
  onCreateSession,
}: SessionsViewProps) {
  const [allSessions, setAllSessions] = useState<SessionWithGateway[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterGateway, setFilterGateway] = useState<string>('all');
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [filterKind, setFilterKind] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('activity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedSession, setSelectedSession] = useState<SessionWithGateway | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    const combined: SessionWithGateway[] = [];

    const promises = Array.from(gateways.values()).map(async (gw) => {
      if (!gw.connected) return;

      const client = getClient(gw.config.id);
      if (!client?.connected) return;

      try {
        const res = await client.request('sessions.list', {
          limit: 100,
          activeMinutes: 120,
          includeGlobal: true,
        });
        const sessions = res?.sessions || [];

        for (const s of sessions) {
          let lastMessagePreview = '';
          try {
            const hist = await client.request('chat.history', {
              sessionKey: s.key,
              limit: 1
            });
            if (hist?.messages?.[0]) {
              const msg = hist.messages[0];
              const content = Array.isArray(msg.content)
                ? msg.content.find((c: any) => c.type === 'text')?.text || ''
                : msg.content;
              lastMessagePreview = content.slice(0, 100);
            }
          } catch { }

          combined.push({
            ...s,
            gatewayId: gw.config.id,
            gatewayName: gw.config.name,
            lastMessagePreview,
          });
        }
      } catch { }
    });

    await Promise.all(promises);

    setAllSessions(combined);
    setLoading(false);
  }, [gateways, getClient]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleDelete = async (session: SessionWithGateway) => {
    if (!confirm(`Delete session "${session.title || session.key}"?`)) return;

    const client = getClient(session.gatewayId);
    if (!client?.connected) return;

    try {
      await client.request('sessions.delete', { key: session.key });
      setAllSessions(prev => prev.filter(s =>
        !(s.key === session.key && s.gatewayId === session.gatewayId)
      ));
      if (drawerOpen && selectedSession?.key === session.key) {
        setDrawerOpen(false);
        setSelectedSession(null);
      }
    } catch (e: any) {
      alert(`Failed to delete session: ${e.message}`);
    }
  };

  const handleUpdateLabel = async () => {
    if (!selectedSession) return;

    const client = getClient(selectedSession.gatewayId);
    if (!client?.connected) return;

    try {
      await client.request('sessions.patch', {
        key: selectedSession.key,
        label: labelValue
      });
      setAllSessions(prev => prev.map(s =>
        s.key === selectedSession.key && s.gatewayId === selectedSession.gatewayId
          ? { ...s, title: labelValue }
          : s
      ));
      setSelectedSession(prev => prev ? { ...prev, title: labelValue } : null);
      setEditingLabel(false);
    } catch (e: any) {
      alert(`Failed to update label: ${e.message}`);
    }
  };

  const openDrawer = (session: SessionWithGateway) => {
    setSelectedSession(session);
    setLabelValue(session.title || session.key);
    setEditingLabel(false);
    setDrawerOpen(true);
  };

  // Filter and sort
  let filteredSessions = allSessions.filter(s => {
    if (filterGateway !== 'all' && s.gatewayId !== filterGateway) return false;
    if (filterAgent !== 'all' && s.agentId !== filterAgent) return false;
    if (filterKind !== 'all' && s.kind !== filterKind) return false;
    if (searchText) {
      const search = searchText.toLowerCase();
      return (
        s.key.toLowerCase().includes(search) ||
        s.title?.toLowerCase().includes(search) ||
        s.channel?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  filteredSessions.sort((a, b) => {
    let aVal: any, bVal: any;
    switch (sortField) {
      case 'activity':
        aVal = a.lastActivity || 0;
        bVal = b.lastActivity || 0;
        break;
      case 'messages':
        aVal = a.messageCount || 0;
        bVal = b.messageCount || 0;
        break;
      case 'gateway':
        aVal = a.gatewayName;
        bVal = b.gatewayName;
        break;
      case 'agent':
        aVal = a.agentId || '';
        bVal = b.agentId || '';
        break;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Get unique agents and kinds for filters
  const uniqueAgents = Array.from(new Set(allSessions.map(s => s.agentId).filter(Boolean)));
  const uniqueKinds = Array.from(new Set(allSessions.map(s => s.kind).filter(Boolean)));

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc'
      ? <ChevronUp size={14} className="inline ml-1" />
      : <ChevronDown size={14} className="inline ml-1" />;
  };

  return (
    <div className="flex-1 overflow-hidden flex">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto py-6 px-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Sessions</h2>
            <div className="flex gap-3">
              <button
                onClick={onCreateSession}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors text-[var(--color-text-primary)] border border-[var(--color-border)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover)] flex items-center gap-1.5"
                style={{ background: 'var(--gradient-card)' }}
              >
                <Plus size={14} />
                New Chat
              </button>
              <button
                onClick={refresh}
                disabled={loading}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors flex items-center gap-1.5"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-input)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focus)]"
              />
            </div>

            {/* Gateway filter */}
            <select
              value={filterGateway}
              onChange={(e) => setFilterGateway(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-input)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]"
            >
              <option value="all">All Gateways</option>
              {Array.from(gateways.values()).map(gw => (
                <option key={gw.config.id} value={gw.config.id}>{gw.config.name}</option>
              ))}
            </select>

            {/* Agent filter */}
            {uniqueAgents.length > 0 && (
              <select
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-input)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]"
              >
                <option value="all">All Agents</option>
                {uniqueAgents.map(agent => (
                  <option key={agent} value={agent}>{agent}</option>
                ))}
              </select>
            )}

            {/* Kind filter */}
            {uniqueKinds.length > 0 && (
              <select
                value={filterKind}
                onChange={(e) => setFilterKind(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-input)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]"
              >
                <option value="all">All Kinds</option>
                {uniqueKinds.map(kind => (
                  <option key={kind} value={kind}>{kind}</option>
                ))}
              </select>
            )}
          </div>

          {/* Sessions Table */}
          {filteredSessions.length === 0 ? (
            <div className="text-center text-[var(--color-text-muted)] py-12">
              <div className="text-3xl mb-3">📋</div>
              <div>{allSessions.length === 0 ? 'No active sessions' : 'No sessions match your filters'}</div>
            </div>
          ) : (
            <div className="border border-[var(--color-border)] rounded-lg overflow-hidden" style={{ background: 'var(--gradient-card)' }}>
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                <div className="col-span-4">Session</div>
                <div
                  className="col-span-2 cursor-pointer hover:text-[var(--color-text-secondary)]"
                  onClick={() => handleSort('gateway')}
                >
                  Gateway <SortIcon field="gateway" />
                </div>
                <div
                  className="col-span-2 cursor-pointer hover:text-[var(--color-text-secondary)]"
                  onClick={() => handleSort('agent')}
                >
                  Agent <SortIcon field="agent" />
                </div>
                <div
                  className="col-span-2 cursor-pointer hover:text-[var(--color-text-secondary)]"
                  onClick={() => handleSort('messages')}
                >
                  Messages <SortIcon field="messages" />
                </div>
                <div
                  className="col-span-2 cursor-pointer hover:text-[var(--color-text-secondary)]"
                  onClick={() => handleSort('activity')}
                >
                  Activity <SortIcon field="activity" />
                </div>
              </div>

              {/* Table Body */}
              <div>
                {filteredSessions.map(s => (
                  <div
                    key={`${s.gatewayId}-${s.key}`}
                    className={`grid grid-cols-12 gap-4 px-4 py-3 border-b border-[var(--color-border)] transition-colors cursor-pointer group ${
                      activeSessionKey === s.key
                        ? 'bg-[var(--color-surface-hover)]'
                        : 'hover:bg-[var(--color-surface-hover)]'
                    }`}
                    onClick={() => openDrawer(s)}
                  >
                    <div className="col-span-4">
                      <div className="font-medium text-sm text-[var(--color-text-primary)] truncate">
                        {s.title || s.key}
                      </div>
                      {s.lastMessagePreview && (
                        <div className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                          {s.lastMessagePreview}
                        </div>
                      )}
                      {s.kind && (
                        <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] mt-1">
                          {s.kind}
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 text-sm text-[var(--color-text-secondary)] truncate">
                      {s.gatewayName}
                    </div>
                    <div className="col-span-2 text-sm text-[var(--color-text-secondary)] truncate">
                      {s.agentId || '-'}
                    </div>
                    <div className="col-span-2 text-sm text-[var(--color-text-secondary)]">
                      {s.messageCount ?? '-'}
                    </div>
                    <div className="col-span-2 flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        {s.lastActivity ? formatTime(s.lastActivity) : '-'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(s);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--status-offline)] p-1 rounded"
                        title="Delete session"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session Detail Drawer */}
      {drawerOpen && selectedSession && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer */}
          <div className="fixed right-0 top-0 bottom-0 w-96 bg-[var(--color-surface)] border-l border-[var(--color-border)] z-50 overflow-y-auto shadow-[var(--shadow-lg)]">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  {editingLabel ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={labelValue}
                        onChange={(e) => setLabelValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateLabel();
                          if (e.key === 'Escape') setEditingLabel(false);
                        }}
                        className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-input)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]"
                        autoFocus
                      />
                      <button
                        onClick={handleUpdateLabel}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-surface)] transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {selectedSession.title || selectedSession.key}
                      </h3>
                      <button
                        onClick={() => setEditingLabel(true)}
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                        title="Edit label"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Session Info */}
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Session Key</div>
                  <div className="text-sm text-[var(--color-text-primary)] font-mono bg-[var(--color-surface-raised)] px-3 py-2 rounded-lg border border-[var(--color-border)]">
                    {selectedSession.key}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Gateway</div>
                  <div className="text-sm text-[var(--color-text-primary)]">
                    {selectedSession.gatewayName}
                  </div>
                </div>

                {selectedSession.agentId && (
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Agent ID</div>
                    <div className="text-sm text-[var(--color-text-primary)]">
                      {selectedSession.agentId}
                    </div>
                  </div>
                )}

                {selectedSession.model && (
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Model</div>
                    <div className="text-sm text-[var(--color-text-primary)]">
                      {selectedSession.model}
                    </div>
                  </div>
                )}

                {selectedSession.kind && (
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Kind</div>
                    <div className="text-sm text-[var(--color-text-primary)]">
                      {selectedSession.kind}
                    </div>
                  </div>
                )}

                {selectedSession.channel && (
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Channel</div>
                    <div className="text-sm text-[var(--color-text-primary)]">
                      {selectedSession.channel}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Message Count</div>
                  <div className="text-sm text-[var(--color-text-primary)]">
                    {selectedSession.messageCount ?? 0}
                  </div>
                </div>

                {selectedSession.lastActivity && (
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Last Activity</div>
                    <div className="text-sm text-[var(--color-text-primary)]">
                      {new Date(selectedSession.lastActivity).toLocaleString()}
                    </div>
                  </div>
                )}

                {selectedSession.lastMessagePreview && (
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Last Message</div>
                    <div className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] px-3 py-2 rounded-lg border border-[var(--color-border)]">
                      {selectedSession.lastMessagePreview}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-6 pt-6 border-t border-[var(--color-border)] space-y-3">
                <button
                  onClick={() => {
                    onSwitchSession(selectedSession.key);
                    setDrawerOpen(false);
                  }}
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-focus)] font-medium text-sm transition-all"
                  style={{ background: 'var(--gradient-card)' }}
                >
                  Switch to Session
                </button>
                <button
                  onClick={() => handleDelete(selectedSession)}
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--status-offline)]/30 text-[var(--status-offline)] hover:bg-[var(--status-offline)]/10 font-medium text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  Delete Session
                </button>
              </div>
            </div>
          </div>
        </>
      )}
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
