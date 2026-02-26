import { useState } from 'react';
import type { AggregatedAgent } from '../hooks/useAgentSpawn';
import type { ModelInfo, SessionInfo } from '../types';

interface AgentSpawnCardProps {
  agent: AggregatedAgent;
  sessions: SessionInfo[];
  onSpawn: (config: {
    agentId: string;
    gatewayId: string;
    sessionName?: string;
    modelId?: string;
  }) => Promise<void>;
  onSwitchSession: (key: string) => void;
}

export function AgentSpawnCard({
  agent,
  sessions,
  onSpawn,
  onSwitchSession,
}: AgentSpawnCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [spawning, setSpawning] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Get sessions for this specific agent
  const agentSessions = sessions.filter((s) => s.agentId === agent.id);

  const handleSpawn = async () => {
    setSpawning(true);
    try {
      await onSpawn({
        agentId: agent.id,
        gatewayId: agent.gatewayId,
        sessionName: sessionName.trim() || undefined,
        modelId: selectedModel || undefined,
      });

      // Reset form
      setSessionName('');
      setSelectedModel('');
      setExpanded(false);
    } catch (error) {
      console.error('Failed to spawn agent:', error);
    } finally {
      setSpawning(false);
    }
  };

  const handleCardClick = () => {
    if (!expanded) {
      // Auto-generate session name on expand
      const timestamp = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setSessionName(`${agent.name} - ${timestamp}`);
    }
    setExpanded(!expanded);
  };

  return (
    <div
      className={`agent-spawn-card rounded-lg transition-all ${
        expanded ? 'card-expanded' : ''
      }`}
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Card Header - Always Visible */}
      <div
        className="p-6 cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex items-start gap-4">
          {/* Agent Emoji */}
          <div className="text-5xl flex-shrink-0">{agent.emoji}</div>

          {/* Agent Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3
                className="text-xl font-semibold truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {agent.name}
              </h3>

              {/* Status Indicator */}
              {agent.activeSessions > 0 && (
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                  style={{
                    background: 'var(--status-online)',
                    color: 'white',
                  }}
                >
                  <span className="status-pulse" />
                  {agent.activeSessions} active
                </div>
              )}
            </div>

            <p
              className="text-sm mb-2 line-clamp-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {agent.description}
            </p>

            {/* Gateway Badge */}
            <div
              className="inline-block px-2 py-1 rounded text-xs font-medium"
              style={{
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              {agent.gatewayName}
            </div>
          </div>

          {/* Expand Indicator */}
          <div
            className="text-xl transition-transform"
            style={{
              color: 'var(--color-text-muted)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div
          className="px-6 pb-6 border-t animate-fade-in"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {/* Spawn Form */}
          <div className="mt-4 space-y-4">
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
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="w-full px-3 py-2 rounded border outline-none focus:border-accent transition-colors"
                style={{
                  background: 'var(--color-surface-input)',
                  color: 'var(--color-text-primary)',
                  borderColor: 'var(--color-border-input)',
                }}
                placeholder="Enter session name..."
              />
            </div>

            {/* Model Selection */}
            {agent.models.length > 0 && (
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Model (Optional)
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 rounded border outline-none focus:border-accent transition-colors"
                  style={{
                    background: 'var(--color-surface-input)',
                    color: 'var(--color-text-primary)',
                    borderColor: 'var(--color-border-input)',
                  }}
                >
                  <option value="">Default</option>
                  {agent.models.map((model: ModelInfo) => (
                    <option key={model.id} value={model.id}>
                      {model.name || model.id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Launch Button */}
            <button
              onClick={handleSpawn}
              disabled={spawning || !sessionName.trim()}
              className="w-full px-4 py-3 rounded font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed spawn-button"
              style={{
                background: 'var(--color-accent)',
                color: 'white',
              }}
            >
              {spawning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Launching...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  🚀 Launch {agent.name}
                </span>
              )}
            </button>
          </div>

          {/* Recent Sessions */}
          {agentSessions.length > 0 && (
            <div className="mt-6">
              <h4
                className="text-sm font-medium mb-3"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Recent Sessions ({agentSessions.length})
              </h4>
              <div className="space-y-2">
                {agentSessions.slice(0, 3).map((session) => (
                  <div
                    key={session.key}
                    onClick={() => onSwitchSession(session.key)}
                    className="p-3 rounded cursor-pointer transition-all hover:scale-102"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div
                      className="font-medium text-sm truncate"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {session.title || session.key}
                    </div>
                    <div
                      className="text-xs mt-1"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {session.messageCount || 0} messages
                      {session.model && ` • ${session.model}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
