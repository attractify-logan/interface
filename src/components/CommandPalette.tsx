import { useState, useEffect, useRef, useMemo } from 'react';
import type { AggregatedAgent } from '../hooks/useAgentSpawn';
import type { SessionInfo, ModelInfo, Gateway } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AggregatedAgent[];
  sessions: SessionInfo[];
  gateways: Map<string, Gateway>; // Gateway map for New Chat selection
  onSpawnAgent: (config: {
    agentId: string;
    gatewayId: string;
    sessionName?: string;
    modelId?: string;
  }) => Promise<void>;
  onNewChat: (config?: {
    gatewayId?: string;
    agentId?: string;
    modelId?: string;
    sessionName?: string;
  }) => void;
  onSwitchSession: (key: string) => void;
  theme: 'dark' | 'light' | 'terminal' | 'amber';
}

type ActionType = 'quick' | 'agent' | 'session';

interface PaletteItem {
  id: string;
  type: ActionType;
  label: string;
  sublabel?: string;
  icon?: string;
  badge?: string;
  data?: AggregatedAgent | SessionInfo;
}

interface SpawnOptions {
  sessionName: string;
  modelId?: string;
  gatewayId?: string;
}

interface NewChatOptions {
  gatewayId: string;
  agentId?: string;
  modelId?: string;
  sessionName: string;
}

export function CommandPalette({
  isOpen,
  onClose,
  agents,
  sessions,
  gateways,
  onSpawnAgent,
  onNewChat,
  onSwitchSession,
  theme,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSpawnOptions, setShowSpawnOptions] = useState(false);
  const [showNewChatOptions, setShowNewChatOptions] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AggregatedAgent | null>(null);
  const [spawnOptions, setSpawnOptions] = useState<SpawnOptions>({
    sessionName: '',
  });
  const [newChatOptions, setNewChatOptions] = useState<NewChatOptions>({
    gatewayId: '',
    sessionName: '',
  });
  const [spawning, setSpawning] = useState(false);
  const [creating, setCreating] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build palette items
  const items = useMemo(() => {
    const quickActions: PaletteItem[] = [
      {
        id: 'new-chat',
        type: 'quick',
        label: 'New Chat',
        icon: '💬',
        sublabel: 'Start a fresh conversation',
      },
    ];

    const agentItems: PaletteItem[] = agents.map((agent) => ({
      id: `agent-${agent.id}-${agent.gatewayId}`,
      type: 'agent' as ActionType,
      label: agent.name,
      sublabel: agent.description,
      icon: agent.emoji,
      badge: agent.gatewayName,
      data: agent,
    }));

    const recentSessions: PaletteItem[] = sessions
      .slice(0, 10)
      .map((session) => ({
        id: `session-${session.key}`,
        type: 'session' as ActionType,
        label: session.title || session.key,
        sublabel: `${session.messageCount || 0} messages`,
        icon: '💬',
        badge: session.agentId,
        data: session,
      }));

    return { quickActions, agentItems, recentSessions };
  }, [agents, sessions]);

  // Filter items by query
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return [
        ...items.quickActions,
        ...items.agentItems,
        ...items.recentSessions,
      ];
    }

    const lowerQuery = query.toLowerCase();
    const filtered: PaletteItem[] = [];

    // Quick actions
    filtered.push(
      ...items.quickActions.filter(
        (item) =>
          item.label.toLowerCase().includes(lowerQuery) ||
          item.sublabel?.toLowerCase().includes(lowerQuery)
      )
    );

    // Agents
    filtered.push(
      ...items.agentItems.filter(
        (item) =>
          item.label.toLowerCase().includes(lowerQuery) ||
          item.sublabel?.toLowerCase().includes(lowerQuery) ||
          item.badge?.toLowerCase().includes(lowerQuery)
      )
    );

    // Sessions
    filtered.push(
      ...items.recentSessions.filter(
        (item) =>
          item.label.toLowerCase().includes(lowerQuery) ||
          item.badge?.toLowerCase().includes(lowerQuery)
      )
    );

    return filtered;
  }, [query, items]);

  // Auto-focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setShowSpawnOptions(false);
      setShowNewChatOptions(false);
      setSelectedAgent(null);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Reset selected index when filtered items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  // Auto-generate session name when agent selected
  useEffect(() => {
    if (selectedAgent) {
      const timestamp = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setSpawnOptions({
        sessionName: `${selectedAgent.name} - ${timestamp}`,
        gatewayId: selectedAgent.gatewayId,
      });
    }
  }, [selectedAgent]);

  // Initialize new chat options with first available gateway
  useEffect(() => {
    if (showNewChatOptions && gateways.size > 0 && !newChatOptions.gatewayId) {
      const firstGateway = Array.from(gateways.values())[0];
      const timestamp = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setNewChatOptions({
        gatewayId: firstGateway.config.id,
        agentId: firstGateway.defaultAgentId || firstGateway.agents[0]?.id,
        sessionName: `Chat - ${timestamp}`,
      });
    }
  }, [showNewChatOptions, gateways, newChatOptions.gatewayId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Spawning options view or New Chat options view
      if (showSpawnOptions || showNewChatOptions) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowSpawnOptions(false);
          setShowNewChatOptions(false);
          setSelectedAgent(null);
        }
        return;
      }

      // Main palette view
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredItems.length - 1 ? prev + 1 : prev
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;

        case 'Enter':
          e.preventDefault();
          handleSelectItem(filteredItems[selectedIndex]);
          break;

        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredItems, showSpawnOptions, showNewChatOptions]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[
        selectedIndex
      ] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const handleSelectItem = (item: PaletteItem) => {
    if (item.type === 'quick') {
      if (item.id === 'new-chat') {
        // Show new chat options instead of immediately creating
        setShowNewChatOptions(true);
      }
    } else if (item.type === 'agent') {
      setSelectedAgent(item.data as AggregatedAgent);
      setShowSpawnOptions(true);
    } else if (item.type === 'session' && item.data) {
      const sessionData = item.data as SessionInfo;
      onSwitchSession(sessionData.key);
      onClose();
    }
  };

  const handleSpawn = async () => {
    if (!selectedAgent) return;

    setSpawning(true);
    try {
      await onSpawnAgent({
        agentId: selectedAgent.id,
        gatewayId: spawnOptions.gatewayId || selectedAgent.gatewayId,
        sessionName: spawnOptions.sessionName || undefined,
        modelId: spawnOptions.modelId || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to spawn agent:', error);
    } finally {
      setSpawning(false);
    }
  };

  const handleCreateNewChat = () => {
    if (!newChatOptions.gatewayId) return;

    setCreating(true);
    try {
      onNewChat({
        gatewayId: newChatOptions.gatewayId,
        agentId: newChatOptions.agentId || undefined,
        modelId: newChatOptions.modelId || undefined,
        sessionName: newChatOptions.sessionName || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to create new chat:', error);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  const getSectionLabel = (index: number): string | null => {
    const item = filteredItems[index];
    const prevItem = index > 0 ? filteredItems[index - 1] : null;

    if (!prevItem || prevItem.type !== item.type) {
      if (item.type === 'quick') return 'QUICK ACTIONS';
      if (item.type === 'agent') return 'SPAWN AGENT';
      if (item.type === 'session') return 'RECENT SESSIONS';
    }
    return null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-32 animate-fade-in"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className={`relative w-full max-w-2xl mx-4 rounded-lg shadow-glow overflow-hidden animate-slide-up ${
          theme === 'terminal' ? 'scanline-overlay' : ''
        }`}
        style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main Palette View */}
        {!showSpawnOptions && !showNewChatOptions && (
          <>
            {/* Search Input */}
            <div
              className="border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search agents, sessions, actions..."
                className="w-full px-4 py-4 bg-transparent text-lg outline-none"
                style={{ color: 'var(--color-text-primary)' }}
              />
            </div>

            {/* Items List */}
            <div
              ref={listRef}
              className="max-h-96 overflow-y-auto"
              style={{ scrollbarGutter: 'stable' }}
            >
              {filteredItems.length === 0 && (
                <div
                  className="px-4 py-8 text-center"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  No results found
                </div>
              )}

              {filteredItems.map((item, index) => {
                const sectionLabel = getSectionLabel(index);

                return (
                  <div key={item.id}>
                    {/* Section Header */}
                    {sectionLabel && (
                      <div
                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {sectionLabel}
                      </div>
                    )}

                    {/* Item */}
                    <div
                      className={`px-4 py-3 cursor-pointer transition-all ${
                        index === selectedIndex
                          ? 'palette-item-selected'
                          : 'palette-item'
                      }`}
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Icon */}
                        <div className="text-2xl flex-shrink-0">{item.icon}</div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div
                            className="font-medium truncate"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {item.label}
                          </div>
                          {item.sublabel && (
                            <div
                              className="text-sm truncate"
                              style={{ color: 'var(--color-text-secondary)' }}
                            >
                              {item.sublabel}
                            </div>
                          )}
                        </div>

                        {/* Badge */}
                        {item.badge && (
                          <div
                            className="px-2 py-1 rounded text-xs font-medium flex-shrink-0"
                            style={{
                              background: 'var(--color-surface)',
                              color: 'var(--color-text-secondary)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            {item.badge}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div
              className="px-4 py-2 text-xs flex items-center justify-between border-t"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              <div className="flex gap-4">
                <span>
                  <kbd className="kbd">↑↓</kbd> Navigate
                </span>
                <span>
                  <kbd className="kbd">Enter</kbd> Select
                </span>
                <span>
                  <kbd className="kbd">Esc</kbd> Close
                </span>
              </div>
            </div>
          </>
        )}

        {/* Spawn Options View */}
        {showSpawnOptions && selectedAgent && (
          <div className="p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="text-4xl">{selectedAgent.emoji}</div>
              <div className="flex-1">
                <h2
                  className="text-xl font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Spawn {selectedAgent.name}
                </h2>
                <p
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {selectedAgent.description}
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Session Name */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Session Name
                </label>
                <input
                  type="text"
                  value={spawnOptions.sessionName}
                  onChange={(e) =>
                    setSpawnOptions((prev) => ({
                      ...prev,
                      sessionName: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded border outline-none focus:border-accent transition-colors"
                  style={{
                    background: 'var(--color-surface-input)',
                    color: 'var(--color-text-primary)',
                    borderColor: 'var(--color-border-input)',
                  }}
                  placeholder="Enter session name..."
                  autoFocus
                />
              </div>

              {/* Model Override */}
              {selectedAgent.models.length > 0 && (
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Model (Optional)
                  </label>
                  <select
                    value={spawnOptions.modelId || ''}
                    onChange={(e) =>
                      setSpawnOptions((prev) => ({
                        ...prev,
                        modelId: e.target.value || undefined,
                      }))
                    }
                    className="w-full px-3 py-2 rounded border outline-none focus:border-accent transition-colors"
                    style={{
                      background: 'var(--color-surface-input)',
                      color: 'var(--color-text-primary)',
                      borderColor: 'var(--color-border-input)',
                    }}
                  >
                    <option value="">Default</option>
                    {selectedAgent.models.map((model: ModelInfo) => (
                      <option key={model.id} value={model.id}>
                        {model.name || model.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Gateway Info */}
              <div
                className="px-3 py-2 rounded text-sm"
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Gateway: <strong>{selectedAgent.gatewayName}</strong>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSpawn}
                disabled={spawning || !spawnOptions.sessionName.trim()}
                className="flex-1 px-4 py-2 rounded font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed spawn-button"
                style={{
                  background: 'var(--color-accent)',
                  color: 'white',
                }}
              >
                {spawning ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Spawning...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    🚀 Launch
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setShowSpawnOptions(false);
                  setSelectedAgent(null);
                }}
                className="px-4 py-2 rounded font-medium transition-all"
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* New Chat Options View */}
        {showNewChatOptions && (
          <div className="p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="text-4xl">💬</div>
              <div className="flex-1">
                <h2
                  className="text-xl font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Start New Chat
                </h2>
                <p
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Select gateway, agent, and model for your conversation
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Gateway Selection */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Gateway
                </label>
                <select
                  value={newChatOptions.gatewayId}
                  onChange={(e) => {
                    const selectedGw = gateways.get(e.target.value);
                    setNewChatOptions((prev) => ({
                      ...prev,
                      gatewayId: e.target.value,
                      agentId: selectedGw?.defaultAgentId || selectedGw?.agents[0]?.id,
                      modelId: undefined, // Reset model when gateway changes
                    }));
                  }}
                  className="w-full px-3 py-2 rounded border outline-none focus:border-accent transition-colors"
                  style={{
                    background: 'var(--color-surface-input)',
                    color: 'var(--color-text-primary)',
                    borderColor: 'var(--color-border-input)',
                  }}
                  autoFocus
                >
                  {Array.from(gateways.values()).map((gw) => (
                    <option key={gw.config.id} value={gw.config.id}>
                      {gw.config.name} {!gw.connected && '(disconnected)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Agent Selection */}
              {newChatOptions.gatewayId && (() => {
                const selectedGw = gateways.get(newChatOptions.gatewayId);
                if (selectedGw && selectedGw.agents.length > 0) {
                  return (
                    <div>
                      <label
                        className="block text-sm font-medium mb-2"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Agent (Optional)
                      </label>
                      <select
                        value={newChatOptions.agentId || ''}
                        onChange={(e) =>
                          setNewChatOptions((prev) => ({
                            ...prev,
                            agentId: e.target.value || undefined,
                          }))
                        }
                        className="w-full px-3 py-2 rounded border outline-none focus:border-accent transition-colors"
                        style={{
                          background: 'var(--color-surface-input)',
                          color: 'var(--color-text-primary)',
                          borderColor: 'var(--color-border-input)',
                        }}
                      >
                        <option value="">Default Agent</option>
                        {selectedGw.agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.emoji ? `${agent.emoji} ` : ''}{agent.name || agent.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Model Selection */}
              {newChatOptions.gatewayId && (() => {
                const selectedGw = gateways.get(newChatOptions.gatewayId);
                if (selectedGw && selectedGw.models && selectedGw.models.length > 0) {
                  return (
                    <div>
                      <label
                        className="block text-sm font-medium mb-2"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Model (Optional)
                      </label>
                      <select
                        value={newChatOptions.modelId || ''}
                        onChange={(e) =>
                          setNewChatOptions((prev) => ({
                            ...prev,
                            modelId: e.target.value || undefined,
                          }))
                        }
                        className="w-full px-3 py-2 rounded border outline-none focus:border-accent transition-colors"
                        style={{
                          background: 'var(--color-surface-input)',
                          color: 'var(--color-text-primary)',
                          borderColor: 'var(--color-border-input)',
                        }}
                      >
                        <option value="">Default Model</option>
                        {selectedGw.models.map((model: ModelInfo) => (
                          <option key={model.id} value={model.id}>
                            {model.name || model.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Session Name */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Session Name (Optional)
                </label>
                <input
                  type="text"
                  value={newChatOptions.sessionName}
                  onChange={(e) =>
                    setNewChatOptions((prev) => ({
                      ...prev,
                      sessionName: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded border outline-none focus:border-accent transition-colors"
                  style={{
                    background: 'var(--color-surface-input)',
                    color: 'var(--color-text-primary)',
                    borderColor: 'var(--color-border-input)',
                  }}
                  placeholder="Enter session name..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateNewChat}
                disabled={creating || !newChatOptions.gatewayId}
                className="flex-1 px-4 py-2 rounded font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed spawn-button"
                style={{
                  background: 'var(--color-accent)',
                  color: 'white',
                }}
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    💬 Start Chat
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setShowNewChatOptions(false);
                  setNewChatOptions({
                    gatewayId: '',
                    sessionName: '',
                  });
                }}
                className="px-4 py-2 rounded font-medium transition-all"
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
