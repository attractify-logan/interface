import { useMemo } from 'react';
import type { Gateway, AgentInfo, ModelInfo } from '../types';

export interface AggregatedAgent {
  id: string;
  name: string;
  description: string;
  emoji: string;
  gatewayId: string;
  gatewayName: string;
  models: ModelInfo[];
  activeSessions: number;
}

export interface SpawnConfig {
  agentId: string;
  gatewayId: string;
  sessionName?: string;
  modelId?: string;
}

export interface SpawnStatus {
  spawning: boolean;
  error: string | null;
  sessionKey: string | null;
}

interface UseAgentSpawnResult {
  aggregatedAgents: AggregatedAgent[];
  spawnAgent: (config: SpawnConfig) => Promise<void>;
  spawnStatus: SpawnStatus;
}

/**
 * Hook for aggregating agents from all gateways and spawning new sessions
 *
 * @param gateways - Map of all connected gateways
 * @param getClient - Function to get client for a gateway
 * @param sessions - Array of all sessions across gateways
 * @param switchSession - Function to switch to a session
 * @param switchGateway - Function to switch to a gateway
 */
export function useAgentSpawn(
  gateways: Map<string, Gateway>,
  getClient: (gwId: string) => any,
  sessions: any[],
  switchSession: (key: string) => void,
  switchGateway: (gwId: string) => void
): UseAgentSpawnResult {
  // Aggregate agents from all connected gateways
  const aggregatedAgents = useMemo(() => {
    const agents: AggregatedAgent[] = [];

    gateways.forEach((gateway, gwId) => {
      if (!gateway.connected || !gateway.agents) return;

      gateway.agents.forEach((agent: AgentInfo) => {
        // Count active sessions for this agent
        const activeSessions = sessions.filter(
          (s) => s.agentId === agent.id
        ).length;

        // Get agent identity emoji (if available)
        const emoji = gateway.identity?.emoji || '🤖';

        agents.push({
          id: agent.id,
          name: agent.name || agent.id,
          description: agent.description || 'No description available',
          emoji,
          gatewayId: gwId,
          gatewayName: gateway.config.name,
          models: gateway.models || [],
          activeSessions,
        });
      });
    });

    return agents;
  }, [gateways, sessions]);

  // Spawn status state
  const spawnStatus: SpawnStatus = {
    spawning: false,
    error: null,
    sessionKey: null,
  };

  // Spawn agent function
  const spawnAgent = async (config: SpawnConfig): Promise<void> => {
    const { agentId, gatewayId, sessionName, modelId } = config;

    try {
      spawnStatus.spawning = true;
      spawnStatus.error = null;

      // Get the gateway client
      const client = getClient(gatewayId);
      if (!client) {
        throw new Error(`Gateway ${gatewayId} not connected`);
      }

      // Generate session key
      const timestamp = Date.now();
      const sessionKey = sessionName
        ? `spawn-${sessionName.replace(/\s+/g, '-').toLowerCase()}-${timestamp}`
        : `spawn-${agentId}-${timestamp}`;

      // Create initial message to spawn the session
      const params: any = {
        sessionKey,
        message: 'Hello! Ready to assist.',
        deliver: false, // Don't actually send, just create the session
        idempotencyKey: crypto.randomUUID(),
      };

      // Override agent if specified
      if (agentId) {
        params.agent = agentId;
      }

      // Override model if specified
      if (modelId) {
        params.model = modelId;
      }

      // Send the request
      await client.request('chat.send', params);

      // Switch to the new session
      switchGateway(gatewayId);
      switchSession(sessionKey);

      spawnStatus.sessionKey = sessionKey;
      spawnStatus.spawning = false;
    } catch (error) {
      spawnStatus.error =
        error instanceof Error ? error.message : 'Failed to spawn agent';
      spawnStatus.spawning = false;
      throw error;
    }
  };

  return {
    aggregatedAgents,
    spawnAgent,
    spawnStatus,
  };
}
