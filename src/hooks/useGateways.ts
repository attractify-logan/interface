// Gateway connection management hook
// Migrated to use FastAPI backend instead of direct gateway connections

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  listGateways,
  addGateway as apiAddGateway,
  removeGateway as apiRemoveGateway,
  getGatewayStatus,
  listSessions as apiListSessions,
  getMessages as apiGetMessages,
  ChatSocket,
} from '../api';
import {
  loadActiveGateway,
  saveActiveGateway,
  loadActiveSession,
  saveActiveSession,
} from '../store';
import { isNotificationEnabled, showNotification } from '../notificationPrefs';
import type { Gateway, ChatMessage, SessionInfo } from '../types';

export function useGateways() {
  const [gateways, setGateways] = useState<Map<string, Gateway>>(new Map());
  const [activeGatewayId, setActiveGatewayId] = useState<string | null>(loadActiveGateway());
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [activeSessionKey, setActiveSessionKeyRaw] = useState<string>(loadActiveSession());
  const setActiveSessionKey = useCallback((key: string) => {
    setActiveSessionKeyRaw(key);
    saveActiveSession(key);
  }, []);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProcesses, setActiveProcesses] = useState<Map<string, boolean>>(new Map());

  const socketsRef = useRef<Map<string, ChatSocket>>(new Map());
  const switchingRef = useRef(false); // Track when we're actively switching to prevent duplicate loads

  // Initialize - load gateways from backend on mount
  useEffect(() => {
    // Clean up legacy localStorage keys from direct-connection era
    localStorage.removeItem('openclaw-chat-gateways');
    console.log('[useGateways] Initializing - loading gateways from backend...');
    loadGatewaysFromBackend();
  }, []);

  // Load gateways from backend
  const loadGatewaysFromBackend = useCallback(async () => {
    try {
      const backendGateways = await listGateways();
      console.log('[useGateways] Loaded gateways from backend:', backendGateways);

      const gwMap = new Map<string, Gateway>();

      // Connect to each gateway
      for (const bg of backendGateways) {
        try {
          const status = await getGatewayStatus(bg.id);
          
          const gateway: Gateway = {
            config: {
              id: bg.id,
              name: bg.name,
              url: bg.url,
              // Note: token/password not exposed by backend
            },
            connected: status.connected,
            agents: status.agents || [],
            defaultAgentId: status.agents?.[0]?.id,
            models: status.models || [],
            defaultModel: status.defaultModel,
          };

          gwMap.set(bg.id, gateway);

          // Connect WebSocket for this gateway
          if (status.connected) {
            connectWebSocket(bg.id);
          }
        } catch (err) {
          console.error(`[useGateways] Failed to get status for ${bg.name}:`, err);
          // Add as disconnected
          gwMap.set(bg.id, {
            config: { id: bg.id, name: bg.name, url: bg.url },
            connected: false,
            agents: [],
            models: [],
          });
        }
      }

      setGateways(gwMap);

      // Auto-select first gateway if none selected or if stored one doesn't exist
      if (backendGateways.length > 0 && (!activeGatewayId || !gwMap.has(activeGatewayId))) {
        const firstId = backendGateways[0].id;
        setActiveGatewayId(firstId);
        saveActiveGateway(firstId);
      }
    } catch (err: any) {
      console.error('[useGateways] Failed to load gateways:', err);
      setError(`Failed to load gateways: ${err.message}`);
    }
  }, [activeGatewayId]);

  // Connect WebSocket for a gateway
  const connectWebSocket = useCallback((gwId: string) => {
    // Disconnect existing socket if any
    const existing = socketsRef.current.get(gwId);
    if (existing) {
      existing.disconnect();
      socketsRef.current.delete(gwId);
    }

    const socket = new ChatSocket();
    socketsRef.current.set(gwId, socket);

    // Capture current state for closures
    const getCurrentState = () => ({
      gateways: gateways,
      activeAgentId: activeAgentId,
      activeGatewayId: activeGatewayId,
    });

    // Handle connected event
    socket.on('connected', (data: any) => {
      console.log(`[WS ${gwId}] Connected:`, data);
      setGateways(prev => {
        const next = new Map(prev);
        const gw = next.get(gwId);
        if (gw) {
          next.set(gwId, {
            ...gw,
            connected: true,
            agents: data.agents || gw.agents,
            models: data.models || gw.models,
            defaultModel: data.defaultModel || gw.defaultModel,
          });
        }
        return next;
      });
    });

    // Handle stream events
    socket.on('stream', (data: any) => {
      const { state, text, error: streamError } = data;
      const { activeGatewayId: currentGwId } = getCurrentState();
      const isActiveGateway = gwId === currentGwId;

      if (state === 'delta') {
        // Mark gateway as processing
        setActiveProcesses(prev => new Map(prev).set(gwId, true));

        // Only update stream text if this is the active gateway
        if (isActiveGateway && text) {
          setStreamText(text);
        }
      } else if (state === 'final') {
        // Clear processing state for this gateway
        setActiveProcesses(prev => {
          const next = new Map(prev);
          next.delete(gwId);
          return next;
        });

        // Final message - only add to chat if this is the active gateway
        if (text && isActiveGateway) {
          const cleaned = stripThinking(text);
          if (cleaned) {
            setMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content: [{ type: 'text', text: cleaned }],
                timestamp: Date.now(),
              },
            ]);

            // Show notification if enabled for this agent
            const { gateways: currentGateways, activeAgentId: currentAgentId } = getCurrentState();
            const gw = currentGateways.get(gwId);

            if (gw && gw.agents && gw.agents.length > 0) {
              // Determine which agent sent this message
              // For now, we use the active agent on this gateway
              // In the future, we could extract agent ID from the message metadata
              const agentId = currentAgentId || gw.agents[0]?.id;

              if (agentId) {
                const agent = gw.agents.find(a => a.id === agentId);
                const agentName = agent?.name || agent?.id || 'Agent';

                // Check if notifications are enabled for this agent
                const notifEnabled = isNotificationEnabled(gwId, agentId);

                console.log('[notif] Message from gateway:', gwId,
                           'agent:', agentName,
                           'notif enabled:', notifEnabled,
                           'visible:', document.visibilityState,
                           'focus:', document.hasFocus());

                if (notifEnabled) {
                  // showNotification will handle checking if tab is focused/visible
                  showNotification(agentName, cleaned, gw.config.name);
                }
              }
            }
          }
        }
        setStreamText('');
        setStreaming(false);
      } else if (state === 'error') {
        // Clear processing state for this gateway
        setActiveProcesses(prev => {
          const next = new Map(prev);
          next.delete(gwId);
          return next;
        });

        setError(streamError || 'Stream error');
        setStreamText('');
        setStreaming(false);
      }
    });

    // Handle close
    socket.on('close', () => {
      console.log(`[WS ${gwId}] Closed`);
      setGateways(prev => {
        const next = new Map(prev);
        const gw = next.get(gwId);
        if (gw) {
          next.set(gwId, { ...gw, connected: false });
        }
        return next;
      });
    });

    // Handle reconnecting
    socket.on('reconnecting', (data: any) => {
      console.log(`[WS ${gwId}] Reconnecting (attempt ${data.attempt})...`);
      setError(`Reconnecting (attempt ${data.attempt})...`);
    });

    // Connect
    socket.connect(gwId);
  }, [gateways, activeAgentId]);

  // Get active socket
  const getActiveSocket = useCallback((): ChatSocket | null => {
    if (!activeGatewayId) return null;
    return socketsRef.current.get(activeGatewayId) || null;
  }, [activeGatewayId]);

  // Backwards compatibility: getClient/getActiveClient now return null
  // (Components using these will need updates, but won't break)
  const getActiveClient = useCallback(() => null, []);
  const getClient = useCallback(() => null, []);

  // Load history from backend (persisted in SQLite)
  const loadHistory = useCallback(
    async (sessionKey?: string, gwId?: string) => {
      const gatewayId = gwId || activeGatewayId;
      if (!gatewayId || !gateways.has(gatewayId)) {
        // No gateway selected - clear messages and exit
        setMessages([]);
        setLoadingHistory(false);
        return;
      }

      const key = sessionKey || activeSessionKey;
      setLoadingHistory(true);
      try {
        const msgs = await apiGetMessages(gatewayId, key);
        setMessages(
          msgs.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          }))
        );
      } catch (err: any) {
        console.error('[loadHistory] Error:', err);
        // Don't clear messages on error — keep whatever we had
      } finally {
        setLoadingHistory(false);
      }
    },
    [activeGatewayId, activeSessionKey, gateways]
  );

  // Load sessions from backend
  const loadSessions = useCallback(async () => {
    if (!activeGatewayId) {
      console.log('[loadSessions] No active gateway');
      return;
    }

    try {
      const sessions = await apiListSessions(activeGatewayId);
      console.log('[loadSessions] Loaded sessions:', sessions);
      setSessions(sessions);
    } catch (err: any) {
      console.error('[loadSessions] Error:', err);
      setSessions([]);
    }
  }, [activeGatewayId]);

  // Load history when gateway or session changes
  // BUT skip if we're actively switching (to prevent duplicate loads and race conditions)
  useEffect(() => {
    if (activeGatewayId && !switchingRef.current) {
      loadHistory();
      loadSessions();
    }
  }, [activeGatewayId, activeSessionKey, loadHistory, loadSessions]);

  // Switch gateway
  const switchGateway = useCallback(
    async (gwId: string) => {
      // CRITICAL: Set switching flag to prevent useEffect from loading history
      switchingRef.current = true;

      // CRITICAL: Set loading state FIRST to prevent welcome screen flash
      setLoadingHistory(true);

      // Then update gateway state
      setActiveGatewayId(gwId);
      saveActiveGateway(gwId);

      const gw = gateways.get(gwId);
      if (gw) {
        setActiveAgentId(gw.defaultAgentId || gw.agents[0]?.id || null);
      }

      setStreamText('');
      setStreaming(false);

      // Clear stale messages immediately
      setMessages([]);

      // Load sessions for the new gateway
      try {
        const sessions = await apiListSessions(gwId);
        setSessions(sessions);
      } catch {
        setSessions([]);
      }

      // Clear switching flag so the useEffect can fire with the updated state.
      // The useEffect watches activeGatewayId + activeSessionKey and will call
      // loadHistory with the correct values after React processes the state updates.
      switchingRef.current = false;
    },
    [gateways]
  );

  // Send message via WebSocket
  const sendMessage = useCallback(
    async (text: string) => {
      const socket = getActiveSocket();
      if (!text.trim() || streaming) return;

      // Check if socket is actually connected before sending
      if (!socket || !socket.connected) {
        console.error('[sendMessage] Socket not connected');
        setError('Not connected to gateway. Please wait for connection or reconnect.');
        return;
      }

      const userMsg: ChatMessage = {
        role: 'user',
        content: [{ type: 'text', text: text.trim() }],
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, userMsg]);
      setStreaming(true);
      setStreamText('');
      setError(null);

      try {
        // Get current agent's reasoning setting
        const currentGateway = activeGatewayId ? gateways.get(activeGatewayId) : null;
        const currentAgent = currentGateway && activeAgentId
          ? currentGateway.agents.find(a => a.id === activeAgentId)
          : null;
        const advancedReasoning = currentAgent?.advancedReasoning;

        socket.send(activeSessionKey, text.trim(), advancedReasoning);
        // Refresh sessions list after sending
        loadSessions();
      } catch (e: any) {
        console.error('[sendMessage] Send failed:', e);
        setError(`Failed to send message: ${e.message}`);
        setStreaming(false);
        // Remove the user message we just added since send failed
        setMessages(prev => prev.slice(0, -1));
      }
    },
    [getActiveSocket, activeSessionKey, streaming, loadSessions, activeGatewayId, activeAgentId, gateways]
  );

  // Abort current run
  const abortRun = useCallback(async () => {
    const socket = getActiveSocket();
    if (!socket?.connected) return;
    try {
      socket.abort(activeSessionKey);
    } catch (err) {
      console.error('[abortRun] Error:', err);
    }
    setStreaming(false);
    setStreamText('');
  }, [getActiveSocket, activeSessionKey]);

  // Add gateway (via backend)
  const addGateway = useCallback(
    async (config: {
      name: string;
      url: string;
      token?: string;
      password?: string;
    }) => {
      try {
        const bg = await apiAddGateway(config);
        console.log('[addGateway] Added gateway:', bg);

        // Reload all gateways to get updated state
        await loadGatewaysFromBackend();

        return bg;
      } catch (err: any) {
        console.error('[addGateway] Error:', err);
        throw err;
      }
    },
    [loadGatewaysFromBackend]
  );

  // Remove gateway (via backend)
  const removeGateway = useCallback(
    async (id: string) => {
      try {
        await apiRemoveGateway(id);
        console.log('[removeGateway] Removed gateway:', id);

        // Disconnect socket
        const socket = socketsRef.current.get(id);
        if (socket) {
          socket.disconnect();
          socketsRef.current.delete(id);
        }

        // Update local state
        setGateways(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });

        // If active gateway was removed, switch to another
        if (activeGatewayId === id) {
          const remaining = Array.from(gateways.keys()).filter(k => k !== id);
          const newId = remaining[0] || null;
          setActiveGatewayId(newId);
          saveActiveGateway(newId);
        }
      } catch (err: any) {
        console.error('[removeGateway] Error:', err);
        throw err;
      }
    },
    [activeGatewayId, gateways]
  );

  // Reconnect gateway
  const reconnectGateway = useCallback(
    async (config: { id: string; name: string; url: string }) => {
      try {
        // Try to get status to trigger backend reconnect
        const status = await getGatewayStatus(config.id);
        if (status.connected) {
          connectWebSocket(config.id);
          
          setGateways(prev => {
            const next = new Map(prev);
            const gw = next.get(config.id);
            if (gw) {
              next.set(config.id, {
                ...gw,
                connected: true,
                agents: status.agents || gw.agents,
                models: status.models || gw.models,
                defaultModel: status.defaultModel || gw.defaultModel,
              });
            }
            return next;
          });
        }
      } catch (err: any) {
        console.error('[reconnectGateway] Error:', err);
        throw err;
      }
    },
    [connectWebSocket]
  );

  // Switch session
  const switchSession = useCallback(
    async (key: string, explicitGatewayId?: string) => {
      // CRITICAL: Set switching flag to prevent useEffect from loading history
      switchingRef.current = true;

      // CRITICAL: Set loading state FIRST to prevent welcome screen flash
      setLoadingHistory(true);

      // Then update other state
      setActiveSessionKey(key);
      setStreamText('');
      setStreaming(false);

      // Use explicit gateway ID if provided (critical when switching gateways + sessions
      // in the same handler — React hasn't re-rendered yet so activeGatewayId is stale)
      const gwId = explicitGatewayId || activeGatewayId;
      if (gwId) {
        await loadHistory(key, gwId);
      } else {
        setMessages([]);
        setLoadingHistory(false);
      }

      // Clear switching flag
      switchingRef.current = false;
    },
    [activeGatewayId, loadHistory]
  );

  // Create new session
  const createSession = useCallback(() => {
    const key = `webchat-${Date.now()}`;
    setActiveSessionKey(key);
    setMessages([]);
    setStreamText('');
    setStreaming(false);
  }, []);

  // Update agent model
  const updateAgentModel = useCallback(
    (gatewayId: string, agentId: string, modelId: string, fallbackModelId?: string) => {
      setGateways(prev => {
        const next = new Map(prev);
        const gw = next.get(gatewayId);
        if (gw) {
          const updatedAgents = gw.agents.map(agent =>
            agent.id === agentId
              ? { ...agent, selectedModel: modelId, fallbackModel: fallbackModelId }
              : agent
          );
          next.set(gatewayId, { ...gw, agents: updatedAgents });
        }
        return next;
      });
    },
    []
  );

  // Toggle advanced reasoning for agent
  const toggleAdvancedReasoning = useCallback(
    (gatewayId: string, agentId: string, enabled: boolean) => {
      setGateways(prev => {
        const next = new Map(prev);
        const gw = next.get(gatewayId);
        if (gw) {
          const updatedAgents = gw.agents.map(agent =>
            agent.id === agentId
              ? { ...agent, advancedReasoning: enabled }
              : agent
          );
          next.set(gatewayId, { ...gw, agents: updatedAgents });
        }
        return next;
      });
    },
    []
  );

  const activeGateway = activeGatewayId ? gateways.get(activeGatewayId) || null : null;

  return {
    gateways,
    activeGateway,
    activeGatewayId,
    activeAgentId,
    activeSessionKey,
    sessions,
    messages,
    streamText,
    streaming,
    error,
    activeProcesses,
    setActiveAgentId,
    switchGateway,
    switchSession,
    createSession,
    sendMessage,
    abortRun,
    addGateway,
    removeGateway,
    reconnectGateway,
    connectGateway: reconnectGateway, // Alias for compatibility
    updateAgentModel,
    toggleAdvancedReasoning,
    loadingHistory,
    loadSessions,
    loadHistory,
    setError,
    getActiveClient, // For backwards compatibility
    getClient, // For backwards compatibility
  };
}

// Helpers
export function extractText(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c.type === 'text' && c.text)
      .map((c: any) => c.text)
      .join('');
  }
  return '';
}

export function stripThinking(text: string): string {
  return text
    .replace(/<\s*\/?(?:think(?:ing)?|thought|antthinking)\b[^>]*>/gi, '')
    .trim();
}
