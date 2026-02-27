// Backend API client for OpenClaw Chat

import type { AgentInfo, ModelInfo, FederatedSession, FederatedSessionGateway } from './types';

// Configurable backend URLs
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const WS_BASE = import.meta.env.VITE_WS_BASE || 'ws://localhost:8000';

// Response types from backend
export interface BackendGateway {
  id: string;
  name: string;
  url: string;
  // Note: token/password are never sent to frontend
}

export interface GatewayStatus {
  connected: boolean;
  agents: AgentInfo[];
  models: ModelInfo[];
  defaultModel?: string;
}

export interface DiscoveredGateway {
  ip: string;
  port: number;
  url: string;
  metadata?: any;
}

export interface BackendSession {
  key: string;
  agentId?: string;
  model?: string;
  lastActivity?: number;
  messageCount?: number;
  title?: string;
  channel?: string;
  kind?: string;
}

export interface BackendMessage {
  role: 'user' | 'assistant' | 'system';
  content: Array<{ type: string; text?: string }>;
  timestamp?: number;
}

// WebSocket message types (simplified protocol from backend)
export type WSMessage =
  | { type: 'connected'; agents: AgentInfo[]; models: ModelInfo[]; defaultModel?: string }
  | { type: 'stream'; state: 'delta' | 'final' | 'error'; text?: string; error?: string }
  | { type: 'error'; error: string };

export type FederatedWSMessage =
  | { type: 'connected'; federated: true }
  | { type: 'stream'; state: 'delta' | 'final' | 'error'; text?: string; error?: string; source: { gateway_id: string; agent_name: string } }
  | { type: 'reconnected'; gateway_id: string }
  | { type: 'error'; error: string };

// ============================================================================
// REST API
// ============================================================================

export async function listGateways(): Promise<BackendGateway[]> {
  const res = await fetch(`${API_BASE}/api/gateways`);
  if (!res.ok) throw new Error(`Failed to list gateways: ${res.statusText}`);
  return res.json();
}

export async function addGateway(config: {
  name: string;
  url: string;
  token?: string;
  password?: string;
}): Promise<BackendGateway> {
  const res = await fetch(`${API_BASE}/api/gateways`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Failed to add gateway: ${res.statusText}`);
  }
  return res.json();
}

export async function removeGateway(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/gateways/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to remove gateway: ${res.statusText}`);
}

export async function getGatewayStatus(id: string): Promise<GatewayStatus> {
  const res = await fetch(`${API_BASE}/api/gateways/${id}/status`);
  if (!res.ok) throw new Error(`Failed to get gateway status: ${res.statusText}`);
  return res.json();
}

export async function scanForGateways(): Promise<DiscoveredGateway[]> {
  const res = await fetch(`${API_BASE}/api/gateways/scan`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to scan for gateways: ${res.statusText}`);
  return res.json();
}

export async function listSessions(gwId: string): Promise<BackendSession[]> {
  const res = await fetch(`${API_BASE}/api/gateways/${gwId}/sessions`);
  if (!res.ok) throw new Error(`Failed to list sessions: ${res.statusText}`);
  const data = await res.json();
  // Map backend snake_case to frontend camelCase
  return data.map((s: any) => ({
    key: s.session_key || s.key,
    agentId: s.agent_id || s.agentId,
    model: s.model,
    title: s.title,
    lastActivity: s.last_activity ? new Date(s.last_activity).getTime() : undefined,
  }));
}

export async function createSession(gwId: string): Promise<BackendSession> {
  const res = await fetch(`${API_BASE}/api/gateways/${gwId}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.statusText}`);
  return res.json();
}

export async function getMessages(
  gwId: string,
  sessionKey: string,
  limit = 50
): Promise<BackendMessage[]> {
  const res = await fetch(
    `${API_BASE}/api/gateways/${gwId}/sessions/${encodeURIComponent(sessionKey)}/messages?limit=${limit}`
  );
  if (!res.ok) throw new Error(`Failed to get messages: ${res.statusText}`);
  return res.json();
}

export async function deleteSession(gwId: string, sessionKey: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/gateways/${gwId}/sessions/${sessionKey}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete session: ${res.statusText}`);
}

// ============================================================================
// Federated Sessions API
// ============================================================================

export async function createFederatedSession(
  title: string | undefined,
  gateways: FederatedSessionGateway[]
): Promise<FederatedSession> {
  const res = await fetch(`${API_BASE}/api/federated-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, gateways }),
  });
  if (!res.ok) throw new Error(`Failed to create federated session: ${res.statusText}`);
  return res.json();
}

export async function listFederatedSessions(): Promise<FederatedSession[]> {
  const res = await fetch(`${API_BASE}/api/federated-sessions`);
  if (!res.ok) throw new Error(`Failed to list federated sessions: ${res.statusText}`);
  return res.json();
}

export async function getFederatedSession(id: string): Promise<FederatedSession> {
  const res = await fetch(`${API_BASE}/api/federated-sessions/${id}`);
  if (!res.ok) throw new Error(`Failed to get federated session: ${res.statusText}`);
  return res.json();
}

export async function deleteFederatedSession(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/federated-sessions/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete federated session: ${res.statusText}`);
}

// ============================================================================
// WebSocket Client
// ============================================================================

type EventHandler<T = any> = (data: T) => void;

export class ChatSocket {
  private ws: WebSocket | null = null;
  private gwId: string | null = null;
  private handlers = new Map<string, EventHandler[]>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private shouldReconnect = true;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly PING_INTERVAL = 30000; // 30 seconds
  private readonly PONG_TIMEOUT = 10000; // 10 seconds

  connect(gwId: string): void {
    this.disconnect();
    this.gwId = gwId;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this._connect();
  }

  private _connect(): void {
    if (!this.gwId) return;

    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    try {
      console.log(`[ChatSocket] Connecting to ${WS_BASE}/ws/chat/${this.gwId}...`);
      this.ws = new WebSocket(`${WS_BASE}/ws/chat/${this.gwId}`);
    } catch (e) {
      console.error('[ChatSocket] Failed to create WebSocket:', e);
      this.scheduleReconnect();
      return;
    }

    this.ws.addEventListener('open', () => {
      console.log(`[ChatSocket] Connected to gateway ${this.gwId}`);
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit('open', {});
    });

    this.ws.addEventListener('message', (e) => {
      try {
        const msg: WSMessage | { type: 'pong' } = JSON.parse(e.data);
        console.log('[ChatSocket] Received:', msg.type);

        if (msg.type === 'pong') {
          // Clear pong timeout - connection is alive
          if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
          }
        } else if (msg.type === 'connected') {
          this.emit('connected', msg);
        } else if (msg.type === 'stream') {
          this.emit('stream', msg);
        } else if (msg.type === 'error') {
          this.emit('error', msg);
        }
      } catch (err) {
        console.error('[ChatSocket] Failed to parse message:', err);
      }
    });

    this.ws.addEventListener('close', (e) => {
      console.log(`[ChatSocket] Disconnected: code=${e.code} reason=${e.reason} shouldReconnect=${this.shouldReconnect}`);
      this.stopHeartbeat();
      this.emit('close', { code: e.code, reason: e.reason });

      // Only reconnect if we should and it wasn't a normal closure
      if (this.shouldReconnect && e.code !== 1000) {
        this.scheduleReconnect();
      }
    });

    this.ws.addEventListener('error', (e) => {
      console.error('[ChatSocket] WebSocket error:', e);
      this.emit('error', { error: 'WebSocket error' });
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send ping
        this.ws.send(JSON.stringify({ type: 'ping' }));

        // Set timeout to wait for pong
        this.pongTimeout = setTimeout(() => {
          console.warn('[ChatSocket] Pong timeout - connection appears dead, closing...');
          this.ws?.close();
        }, this.PONG_TIMEOUT);
      }
    }, this.PING_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[ChatSocket] Max reconnect attempts reached');
      this.emit('reconnect_failed', {});
      this.shouldReconnect = false;
      return;
    }

    // Exponential backoff with minimum 1s and max 30s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[ChatSocket] Will reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        console.log(`[ChatSocket] Reconnecting (attempt ${this.reconnectAttempts})...`);
        this._connect();
      }
    }, delay);
  }

  send(sessionKey: string, message: string, advancedReasoning?: boolean): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const payload: any = {
      type: 'chat',
      sessionKey,
      message,
    };

    if (advancedReasoning !== undefined) {
      payload.advancedReasoning = advancedReasoning;
    }

    this.ws.send(JSON.stringify(payload));
  }

  setReasoning(sessionKey: string, enabled: boolean): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.ws.send(JSON.stringify({
      type: 'set_reasoning',
      sessionKey,
      enabled,
    }));
  }

  abort(sessionKey: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'abort',
      sessionKey,
    }));
  }

  on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  }

  private emit(event: string, data: any): void {
    this.handlers.get(event)?.forEach(h => {
      try {
        h(data);
      } catch (e) {
        console.error('[ChatSocket] Event handler error:', e);
      }
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.gwId = null;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// ============================================================================
// Federated WebSocket Client
// ============================================================================

export class FederatedChatSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, EventHandler[]>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private shouldReconnect = true;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly PING_INTERVAL = 30000; // 30 seconds
  private readonly PONG_TIMEOUT = 10000; // 10 seconds

  connect(): void {
    this.disconnect();
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this._connect();
  }

  private _connect(): void {
    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    try {
      console.log(`[FederatedChatSocket] Connecting to ${WS_BASE}/ws/chat/federated...`);
      this.ws = new WebSocket(`${WS_BASE}/ws/chat/federated`);
    } catch (e) {
      console.error('[FederatedChatSocket] Failed to create WebSocket:', e);
      this.scheduleReconnect();
      return;
    }

    this.ws.addEventListener('open', () => {
      console.log('[FederatedChatSocket] Connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit('open', {});
    });

    this.ws.addEventListener('message', (e) => {
      try {
        const msg: FederatedWSMessage | { type: 'pong' } = JSON.parse(e.data);
        console.log('[FederatedChatSocket] Received:', msg.type);

        if (msg.type === 'pong') {
          // Clear pong timeout - connection is alive
          if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
          }
        } else if (msg.type === 'connected') {
          this.emit('connected', msg);
        } else if (msg.type === 'stream') {
          this.emit('stream', msg);
        } else if (msg.type === 'reconnected') {
          this.emit('reconnected', msg);
        } else if (msg.type === 'error') {
          this.emit('error', msg);
        }
      } catch (err) {
        console.error('[FederatedChatSocket] Failed to parse message:', err);
      }
    });

    this.ws.addEventListener('close', (e) => {
      console.log(`[FederatedChatSocket] Disconnected: code=${e.code} reason=${e.reason} shouldReconnect=${this.shouldReconnect}`);
      this.stopHeartbeat();
      this.emit('close', { code: e.code, reason: e.reason });

      // Only reconnect if we should and it wasn't a normal closure
      if (this.shouldReconnect && e.code !== 1000) {
        this.scheduleReconnect();
      }
    });

    this.ws.addEventListener('error', (e) => {
      console.error('[FederatedChatSocket] WebSocket error:', e);
      this.emit('error', { error: 'WebSocket error' });
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send ping
        this.ws.send(JSON.stringify({ type: 'ping' }));

        // Set timeout to wait for pong
        this.pongTimeout = setTimeout(() => {
          console.warn('[FederatedChatSocket] Pong timeout - connection appears dead, closing...');
          this.ws?.close();
        }, this.PONG_TIMEOUT);
      }
    }, this.PING_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[FederatedChatSocket] Max reconnect attempts reached');
      this.emit('reconnect_failed', {});
      this.shouldReconnect = false;
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[FederatedChatSocket] Will reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        console.log(`[FederatedChatSocket] Reconnecting (attempt ${this.reconnectAttempts})...`);
        this._connect();
      }
    }, delay);
  }

  send(message: string, targets: FederatedSessionGateway[], broadcast: boolean = false): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.ws.send(JSON.stringify({
      type: 'chat',
      message,
      targets,
      broadcast,
    }));
  }

  abort(targets: FederatedSessionGateway[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'abort',
      targets,
    }));
  }

  on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  }

  private emit(event: string, data: any): void {
    this.handlers.get(event)?.forEach(h => {
      try {
        h(data);
      } catch (e) {
        console.error('[FederatedChatSocket] Event handler error:', e);
      }
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
