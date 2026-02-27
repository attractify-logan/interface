// Shared types for OpenClaw Chat

export interface GatewayConfig {
  id: string;
  name: string;
  url: string;
  token?: string;
  password?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: Array<{ type: string; text?: string }>;
  timestamp?: number;
  sessionKey?: string;
}

export interface AgentInfo {
  id: string;
  name?: string;
  description?: string;
  emoji?: string;
  selectedModel?: string; // Per-agent model override
  fallbackModel?: string; // Fallback model if primary fails
  advancedReasoning?: boolean; // Enable thinking/reasoning modes
}

export interface ModelInfo {
  id: string;
  name?: string;
}

export interface AgentIdentity {
  name?: string;
  emoji?: string;
  avatar?: string;
}

export interface SessionInfo {
  key: string;
  agentId?: string;
  model?: string;
  lastActivity?: number;
  messageCount?: number;
  title?: string;
  channel?: string;
  kind?: string;
}

export interface NodeInfo {
  id: string;
  name?: string;
  platform?: string;
  caps?: string[];
  connected?: boolean;
  lastSeen?: number;
}

export interface ChannelStatus {
  id: string;
  type: string;
  connected: boolean;
  accountName?: string;
  error?: string;
}

export interface CronJob {
  id: string;
  name?: string;
  schedule: string;
  agentId?: string;
  enabled: boolean;
  lastRun?: number;
  lastResult?: string;
  task?: string;
}

export interface GatewayStatus {
  version?: string;
  uptime?: number;
  agents?: AgentInfo[];
  models?: ModelInfo[];
  channels?: ChannelStatus[];
  nodes?: NodeInfo[];
}

export interface Gateway {
  config: GatewayConfig;
  connected: boolean;
  agents: AgentInfo[];
  defaultAgentId?: string;
  defaultModel?: string;
  models: ModelInfo[];
  identity?: AgentIdentity;
  status?: GatewayStatus;
}

export type Tab = 'chat' | 'dashboard' | 'agents' | 'sessions' | 'nodes' | 'cron' | 'config' | 'about';

export type Theme = 'dark' | 'light' | 'terminal' | 'amber';

export interface FederatedSessionGateway {
  gateway_id: string;
  session_key: string;
}

export interface FederatedSession {
  id: string;
  title?: string;
  gateways: FederatedSessionGateway[];
  created_at: string;
  last_activity: string;
}

export interface FederatedChatMessage extends ChatMessage {
  source?: {
    gateway_id: string;
    agent_name: string;
  };
}
