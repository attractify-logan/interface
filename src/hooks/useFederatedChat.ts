import { useState, useEffect, useCallback, useRef } from 'react';
import { FederatedChatSocket, createFederatedSession, listFederatedSessions, deleteFederatedSession } from '../api';
import type { FederatedSession, FederatedSessionGateway, FederatedChatMessage, Gateway } from '../types';

interface UseFederatedChatReturn {
  // Session management
  federatedSessions: FederatedSession[];
  activeFederatedSession: FederatedSession | null;
  createSession: (title: string | undefined, gateways: FederatedSessionGateway[]) => Promise<void>;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  loadSessions: () => Promise<void>;

  // Messaging
  messages: FederatedChatMessage[];
  streamingMessages: Map<string, string>; // gateway_id -> partial text
  streaming: boolean;
  sendMessage: (text: string, broadcast?: boolean) => void;
  abortRun: (targets?: FederatedSessionGateway[]) => void;

  // State
  connected: boolean;
  error: string | null;
  setError: (error: string | null) => void;
}

export function useFederatedChat(_gateways: Map<string, Gateway>): UseFederatedChatReturn {
  const [federatedSessions, setFederatedSessions] = useState<FederatedSession[]>([]);
  const [activeFederatedSession, setActiveFederatedSession] = useState<FederatedSession | null>(null);
  const [messages, setMessages] = useState<FederatedChatMessage[]>([]);
  const [streamingMessages, setStreamingMessages] = useState<Map<string, string>>(new Map());
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<FederatedChatSocket | null>(null);
  const streamingSourcesRef = useRef<Set<string>>(new Set());

  // Initialize WebSocket
  useEffect(() => {
    const socket = new FederatedChatSocket();
    socketRef.current = socket;

    socket.on('connected', () => {
      console.log('[useFederatedChat] WebSocket connected');
      setConnected(true);
      setError(null);
    });

    socket.on('stream', (msg: any) => {
      const { source, state, text, error: streamError } = msg;
      const sourceKey = `${source.gateway_id}:${source.agent_name}`;

      if (state === 'delta' && text) {
        // Accumulate streaming text per source
        setStreamingMessages(prev => {
          const updated = new Map(prev);
          const currentText = updated.get(sourceKey) || '';
          updated.set(sourceKey, currentText + text);
          return updated;
        });
        streamingSourcesRef.current.add(sourceKey);
        setStreaming(true);
      } else if (state === 'final') {
        // Finalize the message from this source
        const finalText = text || '';

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: [{ type: 'text', text: finalText }],
          timestamp: Date.now(),
          source: {
            gateway_id: source.gateway_id,
            agent_name: source.agent_name,
          },
        }]);

        // Remove from streaming
        setStreamingMessages(prev => {
          const updated = new Map(prev);
          updated.delete(sourceKey);
          return updated;
        });
        streamingSourcesRef.current.delete(sourceKey);

        // If no more sources streaming, stop
        if (streamingSourcesRef.current.size === 0) {
          setStreaming(false);
        }
      } else if (state === 'error') {
        console.error('[useFederatedChat] Stream error from', sourceKey, streamError);
        setError(streamError || 'Stream error');

        // Remove from streaming
        setStreamingMessages(prev => {
          const updated = new Map(prev);
          updated.delete(sourceKey);
          return updated;
        });
        streamingSourcesRef.current.delete(sourceKey);

        if (streamingSourcesRef.current.size === 0) {
          setStreaming(false);
        }
      }
    });

    socket.on('reconnected', (msg: any) => {
      console.log('[useFederatedChat] Gateway reconnected:', msg.gateway_id);
    });

    socket.on('error', (msg: any) => {
      console.error('[useFederatedChat] WebSocket error:', msg.error);
      setError(msg.error);
    });

    socket.on('close', () => {
      console.log('[useFederatedChat] WebSocket closed');
      setConnected(false);
    });

    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, []);

  // Load federated sessions
  const loadSessions = useCallback(async () => {
    try {
      const sessions = await listFederatedSessions();
      setFederatedSessions(sessions);
    } catch (err) {
      console.error('[useFederatedChat] Failed to load sessions:', err);
      setError('Failed to load federated sessions');
    }
  }, []);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Create new federated session
  const createSession = useCallback(async (title: string | undefined, gateways: FederatedSessionGateway[]) => {
    try {
      const session = await createFederatedSession(title, gateways);
      setFederatedSessions(prev => [session, ...prev]);
      setActiveFederatedSession(session);
      setMessages([]);
      setStreamingMessages(new Map());
      setStreaming(false);
      streamingSourcesRef.current.clear();
      setError(null);
    } catch (err) {
      console.error('[useFederatedChat] Failed to create session:', err);
      setError('Failed to create federated session');
      throw err;
    }
  }, []);

  // Switch to a federated session
  const switchSession = useCallback((sessionId: string) => {
    const session = federatedSessions.find(s => s.id === sessionId);
    if (session) {
      setActiveFederatedSession(session);
      setMessages([]);
      setStreamingMessages(new Map());
      setStreaming(false);
      streamingSourcesRef.current.clear();
      setError(null);
      // TODO: Load message history for this session
    }
  }, [federatedSessions]);

  // Delete federated session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await deleteFederatedSession(sessionId);
      setFederatedSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeFederatedSession?.id === sessionId) {
        setActiveFederatedSession(null);
        setMessages([]);
        setStreamingMessages(new Map());
        setStreaming(false);
        streamingSourcesRef.current.clear();
      }
    } catch (err) {
      console.error('[useFederatedChat] Failed to delete session:', err);
      setError('Failed to delete session');
      throw err;
    }
  }, [activeFederatedSession]);

  // Send message
  const sendMessage = useCallback((text: string, broadcast: boolean = false) => {
    if (!socketRef.current || !activeFederatedSession) return;

    try {
      // Add user message to history
      setMessages(prev => [...prev, {
        role: 'user',
        content: [{ type: 'text', text }],
        timestamp: Date.now(),
      }]);

      // Send via WebSocket
      socketRef.current.send(text, activeFederatedSession.gateways, broadcast);

      // Clear any previous errors
      setError(null);
    } catch (err) {
      console.error('[useFederatedChat] Failed to send message:', err);
      setError('Failed to send message');
    }
  }, [activeFederatedSession]);

  // Abort current run
  const abortRun = useCallback((targets?: FederatedSessionGateway[]) => {
    if (!socketRef.current || !activeFederatedSession) return;

    try {
      const abortTargets = targets || activeFederatedSession.gateways;
      socketRef.current.abort(abortTargets);
      setStreaming(false);
      setStreamingMessages(new Map());
      streamingSourcesRef.current.clear();
    } catch (err) {
      console.error('[useFederatedChat] Failed to abort:', err);
    }
  }, [activeFederatedSession]);

  return {
    federatedSessions,
    activeFederatedSession,
    createSession,
    switchSession,
    deleteSession,
    loadSessions,
    messages,
    streamingMessages,
    streaming,
    sendMessage,
    abortRun,
    connected,
    error,
    setError,
  };
}
