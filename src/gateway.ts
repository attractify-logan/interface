// OpenClaw Gateway WebSocket Client

import type { GatewayConfig } from './types';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: ReturnType<typeof setTimeout>;
}

type EventHandler = (event: any) => void;

let reqCounter = 0;
function nextId(): string {
  return `r${++reqCounter}_${Date.now()}`;
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private eventHandlers = new Map<string, EventHandler[]>();
  private _connected = false;
  private config: GatewayConfig;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private shouldReconnect = true;
  private connectResolve: ((v: void) => void) | null = null;
  private connectReject: ((e: Error) => void) | null = null;
  private connectId: string | null = null;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  get connected() { return this._connected; }
  get id() { return this.config.id; }

  connect(): Promise<void> {
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    return this._connect();
  }

  private _connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);
      } catch (e) {
        reject(e);
        return;
      }

      this.connectResolve = resolve;
      this.connectReject = reject;

      const timeout = setTimeout(() => {
        this.connectResolve = null;
        this.connectReject = null;
        reject(new Error('Connection timeout'));
        this.ws?.close();
      }, 15000);

      this.ws.addEventListener('open', () => {
        clearTimeout(timeout);
        console.log(`[GW ${this.config.name}] WebSocket open, waiting for challenge...`);
        // Don't send connect yet — wait for connect.challenge event
      });

      this.ws.addEventListener('message', (e) => {
        this.handleMessage(String(e.data));
      });

      this.ws.addEventListener('close', (e) => {
        clearTimeout(timeout);
        console.log(`[GW ${this.config.name}] WebSocket closed: code=${e.code} reason=${e.reason}`);
        const wasConnected = this._connected;
        this._connected = false;

        // Reject pending connect if still waiting
        if (this.connectReject) {
          this.connectReject(new Error(`Connection closed: ${e.reason || `code ${e.code}`}`));
          this.connectResolve = null;
          this.connectReject = null;
        }

        this.flushPending(new Error(`Connection closed: ${e.reason || e.code}`));
        this.emit('disconnected', { code: e.code, reason: e.reason });

        if (wasConnected && this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });

      this.ws.addEventListener('error', (e) => {
        clearTimeout(timeout);
        console.error(`[GW ${this.config.name}] WebSocket error:`, e);
        if (this.connectReject) {
          this.connectReject(new Error('WebSocket error — check URL and ensure gateway is reachable'));
          this.connectResolve = null;
          this.connectReject = null;
        }
      });
    });
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('reconnect_failed', {});
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this._connect();
      } catch {
        // _connect failure will trigger close → scheduleReconnect again
      }
    }, delay);
  }

  private sendConnect(_challenge?: { nonce: string; ts: number }) {
    const auth: any = {};
    if (this.config.token) auth.token = this.config.token;
    if (this.config.password) auth.password = this.config.password;

    const id = nextId();
    this.connectId = id;

    const msg: any = {
      type: 'req',
      id,
      method: 'connect',
      params: {
        auth: Object.keys(auth).length > 0 ? auth : undefined,
        role: 'operator',
        scopes: ['operator.read', 'operator.write', 'operator.admin', 'operator.approvals', 'operator.pairing'],
        permissions: {
          'operator.admin': true,
          'operator.approvals': true,
          'operator.pairing': true,
        },
        client: {
          id: 'openclaw-control-ui',
          version: '2.0.0',
          platform: 'web',
          mode: 'webchat',
          instanceId: `chat_${Date.now()}`,
        },
        minProtocol: 3,
        maxProtocol: 3,
      },
    };

    // With dangerouslyDisableDeviceAuth, just send connect after receiving challenge
    // No need to include challenge data in params

    console.log(`[GW ${this.config.name}] Sending connect request (id=${id})...`);
    this.ws?.send(JSON.stringify(msg));
  }

  private handleMessage(data: string) {
    let msg: any;
    try { msg = JSON.parse(data); } catch { return; }

    console.log(`[GW ${this.config.name}] Received:`, msg.type, msg.event || msg.id || '', msg.payload?.type || msg.ok || '');

    // Handle connect.challenge — gateway sends this before we can connect
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      console.log(`[GW ${this.config.name}] Got challenge, sending connect with nonce...`);
      this.sendConnect(msg.payload);
      return;
    }

    if (msg.type === 'res') {
      // Check if it's our connect response
      if (this.connectId && msg.id === this.connectId) {
        this.connectId = null;
        if (msg.ok !== false && !msg.error) {
          console.log(`[GW ${this.config.name}] Connected! Protocol ${msg.payload?.protocol || '?'}`, 'snapshot:', msg.payload?.snapshot?.sessionDefaults);
          this._connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected', msg.payload);
          this.connectResolve?.();
        } else {
          const errMsg = msg.error?.message || 'Connect rejected';
          console.error(`[GW ${this.config.name}] Connect failed: ${errMsg}`);
          this.connectReject?.(new Error(errMsg));
        }
        this.connectResolve = null;
        this.connectReject = null;
        return;
      }

      // Regular request response
      const pending = this.pending.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(msg.id);
        if (msg.ok !== false && !msg.error) {
          pending.resolve(msg.payload);
        } else {
          pending.reject(new Error(msg.error?.message || 'Request failed'));
        }
      }
    } else if (msg.type === 'event') {
      this.emit('event', msg);

      // Route specific events
      if (msg.event === 'chat') {
        this.emit('chat.stream', msg);
      }
      if (msg.event === 'exec.approval.requested') {
        this.emit('exec.approval', msg);
      }
    }
  }

  async request(method: string, params: any = {}, timeoutMs = 30000): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }
    const id = nextId();
    const wireMsg = { type: 'req', id, method, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Request timeout'));
        }
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.ws!.send(JSON.stringify(wireMsg));
    });
  }

  on(event: string, handler: EventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  }

  private emit(event: string, data: any) {
    this.eventHandlers.get(event)?.forEach(h => {
      try { h(data); } catch (e) { console.error('Event handler error:', e); }
    });
  }

  private flushPending(error: Error) {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this._connected = false;
    this.connectResolve = null;
    this.connectReject = null;
    this.flushPending(new Error('Disconnected'));
  }
}
