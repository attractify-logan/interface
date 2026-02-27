import { useState, useEffect, useCallback } from 'react';
import { useGateways } from './hooks/useGateways';
import { useAgentSpawn } from './hooks/useAgentSpawn';
import { useFederatedChat } from './hooks/useFederatedChat';
import { loadTheme, saveTheme, loadSidebarOpen, saveSidebarOpen } from './store';
import type { Tab, Theme, FederatedSessionGateway } from './types';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import ChatView from './components/ChatView';
import FederatedChatView from './components/FederatedChatView';
import DashboardView from './components/DashboardView';
import AgentsView from './components/AgentsView';
import SessionsView from './components/SessionsView';
import NodesView from './components/NodesView';
import CronView from './components/CronView';
import ConfigView from './components/ConfigView';
import AboutView from './components/AboutView';
import SettingsModal from './components/SettingsModal';
import { CommandPalette } from './components/CommandPalette';
import { SpawnFAB } from './components/SpawnFAB';

export default function App() {
  const gw = useGateways();
  const federatedChat = useFederatedChat(gw.gateways);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsGatewayId, setSettingsGatewayId] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(loadSidebarOpen());
  const [theme, setTheme] = useState<Theme>(loadTheme());
  const [selectedModels, setSelectedModels] = useState<Map<string, string>>(new Map());
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Federated chat mode state
  const [chatMode, setChatMode] = useState<'standard' | 'federated'>('standard');
  const [showFederatedSetup, setShowFederatedSetup] = useState(false);
  const [selectedGateways, setSelectedGateways] = useState<Set<string>>(new Set());

  // Agent spawn hook
  const { aggregatedAgents, spawnAgent } = useAgentSpawn(
    gw.gateways,
    gw.getClient,
    gw.sessions,
    gw.switchSession,
    gw.switchGateway
  );

  // Show settings if no gateways
  useEffect(() => {
    if (gw.gateways.size === 0) {
      // Delay slightly to avoid flash
      const t = setTimeout(() => {
        if (gw.gateways.size === 0) setShowSettings(true);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [gw.gateways.size]);

  // Theme
  useEffect(() => {
    document.documentElement.classList.remove('light', 'terminal', 'amber');
    if (theme === 'light') document.documentElement.classList.add('light');
    if (theme === 'terminal') document.documentElement.classList.add('terminal');
    if (theme === 'amber') document.documentElement.classList.add('amber');
    saveTheme(theme);
  }, [theme]);

  // Sidebar persistence
  useEffect(() => {
    saveSidebarOpen(sidebarOpen);
  }, [sidebarOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const TABS_LIST: Tab[] = ['chat', 'dashboard', 'agents', 'sessions', 'nodes', 'cron', 'config', 'about'];

    const handler = (e: KeyboardEvent) => {
      // Cmd+K open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      // Cmd+B toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarOpen(prev => !prev);
      }
      // Cmd+N new chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        gw.createSession();
        setActiveTab('chat');
      }
      // Cmd+, open settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      }
      // Cmd+1-7 switch tabs
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '7') {
        e.preventDefault();
        const tabIndex = parseInt(e.key, 10) - 1;
        if (tabIndex < TABS_LIST.length) {
          setActiveTab(TABS_LIST[tabIndex]);
        }
      }
      // Escape closes settings
      if (e.key === 'Escape' && showSettings) {
        setShowSettings(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSettings, gw.createSession]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      if (prev === 'dark') return 'light';
      if (prev === 'light') return 'terminal';
      if (prev === 'terminal') return 'amber';
      return 'dark';
    });
  }, []);

  const handleSwitchSession = useCallback((key: string) => {
    gw.switchSession(key);
    setActiveTab('chat');
  }, [gw.switchSession]);

  const handleNewChat = useCallback(() => {
    if (chatMode === 'federated') {
      // Show federated setup UI
      setShowFederatedSetup(true);
      setSelectedGateways(new Set());
    } else {
      gw.createSession();
      setActiveTab('chat');
    }
  }, [chatMode, gw.createSession]);

  const handleCreateFederatedSession = useCallback(async () => {
    if (selectedGateways.size === 0) return;

    const gateways: FederatedSessionGateway[] = Array.from(selectedGateways).map(gwId => ({
      gateway_id: gwId,
      session_key: `webchat-${Date.now()}`, // Create a new session key for each gateway
    }));

    try {
      await federatedChat.createSession(undefined, gateways);
      setShowFederatedSetup(false);
      setSelectedGateways(new Set());
      setActiveTab('chat');
    } catch (err) {
      console.error('Failed to create federated session:', err);
    }
  }, [selectedGateways, federatedChat]);

  const handleSpawnAgent = useCallback(async (config: {
    agentId: string;
    gatewayId: string;
    sessionName?: string;
    modelId?: string;
  }) => {
    await spawnAgent(config);
    setActiveTab('chat');
  }, [spawnAgent]);

  const handleChangeModel = useCallback((modelId: string) => {
    if (gw.activeGatewayId) {
      setSelectedModels(prev => new Map(prev).set(gw.activeGatewayId!, modelId));
    }
  }, [gw.activeGatewayId]);

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        // Show federated chat if a federated session is active
        if (federatedChat.activeFederatedSession) {
          return (
            <FederatedChatView
              messages={federatedChat.messages}
              streamingMessages={federatedChat.streamingMessages}
              streaming={federatedChat.streaming}
              federatedSession={federatedChat.activeFederatedSession}
              gateways={gw.gateways}
              error={federatedChat.error}
              connected={federatedChat.connected}
              onSend={federatedChat.sendMessage}
              onAbort={federatedChat.abortRun}
              onDismissError={() => federatedChat.setError(null)}
            />
          );
        }

        // Show standard chat view
        return (
          <ChatView
            messages={gw.messages}
            streamText={gw.streamText}
            streaming={gw.streaming}
            loadingHistory={gw.loadingHistory}
            activeGateway={gw.activeGateway}
            activeAgentId={gw.activeAgentId}
            error={gw.error}
            onSend={gw.sendMessage}
            onAbort={gw.abortRun}
            onDismissError={() => gw.setError(null)}
            onUpdateAgentModel={gw.updateAgentModel}
            onToggleAdvancedReasoning={gw.toggleAdvancedReasoning}
            sessionModel={gw.sessions.find(s => s.key === gw.activeSessionKey)?.model}
          />
        );
      case 'dashboard':
        return (
          <DashboardView
            gateways={gw.gateways}
            activeGateway={gw.activeGateway}
            getActiveClient={gw.getActiveClient}
            getClient={gw.getClient}
          />
        );
      case 'agents':
        return (
          <AgentsView
            gateways={gw.gateways}
            sessions={gw.sessions}
            aggregatedAgents={aggregatedAgents}
            onSpawn={handleSpawnAgent}
            onSwitchSession={handleSwitchSession}
            onSwitchGateway={gw.switchGateway}
            getClient={gw.getClient}
          />
        );
      case 'sessions':
        return (
          <SessionsView
            sessions={gw.sessions}
            activeSessionKey={gw.activeSessionKey}
            gateways={gw.gateways}
            getActiveClient={gw.getActiveClient}
            getClient={gw.getClient}
            onSwitchSession={handleSwitchSession}
            onCreateSession={gw.createSession}
            onRefresh={gw.loadSessions}
          />
        );
      case 'nodes':
        return <NodesView gateways={gw.gateways} getClient={gw.getClient} />;
      case 'cron':
        return <CronView gateways={gw.gateways} getClient={gw.getClient} />;
      case 'config':
        return <ConfigView getActiveClient={gw.getActiveClient} />;
      case 'about':
        return <AboutView />;
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {sidebarOpen && (
        <Sidebar
          gateways={gw.gateways}
          activeGatewayId={gw.activeGatewayId}
          activeTab={activeTab}
          activeSessionKey={gw.activeSessionKey}
          sessions={gw.sessions}
          federatedSessions={federatedChat.federatedSessions}
          activeFederatedSessionId={federatedChat.activeFederatedSession?.id || null}
          chatMode={chatMode}
          onChatModeChange={setChatMode}
          onSwitchGateway={gw.switchGateway}
          onSwitchTab={setActiveTab}
          onSwitchSession={(key) => {
            // When switching to a standard session, clear federated session
            federatedChat.switchSession(''); // Clear federated session
            handleSwitchSession(key);
          }}
          onSwitchFederatedSession={(id) => {
            // When switching to federated session, switch to chat tab
            federatedChat.switchSession(id);
            setActiveTab('chat');
          }}
          onCreateSession={handleNewChat}
          onOpenSettings={(gatewayId) => {
            setSettingsGatewayId(gatewayId);
            setShowSettings(true);
          }}
          onDeleteSession={(key) => {
            // TODO: Implement delete session via gateway API
            console.log('Delete session:', key);
          }}
          onDeleteFederatedSession={async (id) => {
            try {
              await federatedChat.deleteSession(id);
            } catch (err) {
              console.error('Failed to delete federated session:', err);
            }
          }}
          activeAgentId={gw.activeAgentId}
          onReconnectGateway={gw.reconnectGateway}
          onSwitchAgent={async (gatewayId, agentId) => {
            const switchingGateway = gw.activeGatewayId !== gatewayId;
            if (switchingGateway) {
              await gw.switchGateway(gatewayId);
            }
            gw.setActiveAgentId(agentId);
            // Default session key for an agent
            const defaultKey = `agent:${agentId}:main`;
            const altKey = `agent:${agentId}:${agentId}`;
            // If we just switched gateways, sessions are stale in React state.
            // Use the default key pattern directly instead of searching stale sessions.
            if (switchingGateway) {
              gw.switchSession(defaultKey, gatewayId);
            } else {
              const existingSession = gw.sessions.find(
                s => s.key === altKey || s.key === defaultKey
              );
              if (existingSession) {
                gw.switchSession(existingSession.key, gatewayId);
              } else {
                const key = `webchat-${agentId}-${Date.now()}`;
                gw.switchSession(key, gatewayId);
              }
            }
            setActiveTab('chat');
          }}
          streaming={federatedChat.activeFederatedSession ? federatedChat.streaming : gw.streaming}
          activeProcesses={gw.activeProcesses}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          activeGateway={gw.activeGateway}
          activeAgentId={gw.activeAgentId}
          activeSessionKey={gw.activeSessionKey}
          sidebarOpen={sidebarOpen}
          selectedModel={gw.activeGatewayId ? selectedModels.get(gw.activeGatewayId) || null : null}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          onChangeAgent={gw.setActiveAgentId}
          onChangeModel={handleChangeModel}
        />
        {renderContent()}
      </main>

      {showSettings && (
        <SettingsModal
          gateways={gw.gateways}
          preSelectedGatewayId={settingsGatewayId}
          onAdd={async (config) => {
            await gw.addGateway(config);
            // Close settings on successful add
            setShowSettings(false);
            setSettingsGatewayId(undefined);
          }}
          onRemove={gw.removeGateway}
          onReconnect={gw.connectGateway}
          onClose={() => {
            setShowSettings(false);
            setSettingsGatewayId(undefined);
          }}
        />
      )}

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        agents={aggregatedAgents}
        sessions={gw.sessions}
        onSpawnAgent={handleSpawnAgent}
        onNewChat={handleNewChat}
        onSwitchSession={handleSwitchSession}
        theme={theme}
      />

      <SpawnFAB
        onNewChat={handleNewChat}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Federated Session Setup Modal */}
      {showFederatedSetup && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowFederatedSetup(false)}
        >
          <div
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: 'var(--shadow-lg)' }}
          >
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
              Create Federated Session
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              Select gateways to include in this federated chat session. All selected agents will receive your messages.
            </p>

            <div className="space-y-2 mb-6">
              {Array.from(gw.gateways.values()).map(gateway => (
                <label
                  key={gateway.config.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedGateways.has(gateway.config.id)
                      ? 'border-[var(--color-accent)] bg-[var(--color-surface-hover)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-focus)]'
                  }`}
                  style={{ background: selectedGateways.has(gateway.config.id) ? 'var(--gradient-active)' : 'var(--gradient-card)' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedGateways.has(gateway.config.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedGateways);
                      if (e.target.checked) {
                        newSelected.add(gateway.config.id);
                      } else {
                        newSelected.delete(gateway.config.id);
                      }
                      setSelectedGateways(newSelected);
                    }}
                    className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-[var(--color-text-primary)]">
                      {gateway.config.name}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {gateway.connected
                        ? `${gateway.agents.length} ${gateway.agents.length === 1 ? 'agent' : 'agents'}`
                        : 'Disconnected'}
                    </div>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      gateway.connected ? 'bg-[var(--status-online)]' : 'bg-[var(--status-offline)]'
                    }`}
                  />
                </label>
              ))}
            </div>

            {selectedGateways.size === 0 && (
              <p className="text-xs text-[var(--color-text-muted)] mb-4 text-center">
                Select at least one gateway to continue
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowFederatedSetup(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-focus)] transition-all"
                style={{ background: 'var(--gradient-card)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFederatedSession}
                disabled={selectedGateways.size === 0}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-surface)] disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-all"
                style={{ boxShadow: selectedGateways.size > 0 ? 'var(--shadow-sm)' : 'none' }}
              >
                Create ({selectedGateways.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
