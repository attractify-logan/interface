// Shared types for OpenClaw Chat

export interface GatewayConfig {
  id: string;
  name: string;
  url: string;
  token?: string;
  password?: string;
}

// Content block types (Anthropic message format)
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: any }
  | { type: 'tool_result'; tool_use_id: string; content: string | any; is_error?: boolean };

// Usage information from the API
export interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  // Additional fields from session status
  context_tokens?: number;
  max_tokens?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: ContentBlock[];
  timestamp?: number;
  sessionKey?: string;
  usage?: UsageInfo;
}

export interface AgentInfo {
  id: string;
  name?: string;
  description?: string;
  emoji?: string;
  model?: string; // Agent's current/default model from gateway
  selectedModel?: string; // Per-agent model override (UI-only)
  fallbackModel?: string; // Fallback model if primary fails
  advancedReasoning?: boolean; // Enable thinking/reasoning modes
}

export interface ModelInfo {
  id: string;
  name?: string;
  contextWindow?: number;
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

export interface DeviceConfig {
  id: string;
  name: string;
  ip: string;
  icon: string;
  enabled: boolean;
  ssh_user?: string;
  ssh_port: number;
  services: string[];
  created_at: string;
}

export interface ServiceStatus {
  name: string;
  active: boolean;
  error?: string;
}

export interface DeviceStatus {
  id: string;
  name: string;
  icon: string;
  online: boolean;
  services: ServiceStatus[];
  last_check: string;
  error?: string;
}
