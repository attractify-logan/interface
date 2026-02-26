import { memo } from 'react';
import { Users } from 'lucide-react';
import type { Gateway, FederatedSessionGateway } from '../types';

interface RecipientsBarProps {
  mentions: string[]; // Array of @mention strings parsed from input
  federatedGateways: FederatedSessionGateway[];
  gateways: Map<string, Gateway>;
}

export const RecipientsBar = memo(function RecipientsBar({
  mentions,
  federatedGateways,
  gateways,
}: RecipientsBarProps) {
  // Parse mentions to extract gateway and agent info
  const parsedMentions = mentions.map(mention => {
    // Format: @gateway_id or @gateway_id:agent_id
    const cleaned = mention.replace('@', '');
    const parts = cleaned.split(':');
    const gatewayId = parts[0];
    const agentId = parts[1] || null;

    const gateway = gateways.get(gatewayId);
    const gatewayName = gateway?.config.name || gatewayId;
    const agentName = agentId
      ? gateway?.agents.find(a => a.id === agentId)?.name || agentId
      : 'All agents';

    return {
      gatewayId,
      agentId,
      gatewayName,
      agentName,
      displayText: agentId ? `${gatewayName} › ${agentName}` : gatewayName,
    };
  });

  // If no mentions, show "All agents"
  const displayText = parsedMentions.length > 0
    ? parsedMentions.map(m => m.displayText).join(', ')
    : `All agents (${federatedGateways.length} ${federatedGateways.length === 1 ? 'gateway' : 'gateways'})`;

  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
      <div className="max-w-3xl mx-auto flex items-center gap-2 text-sm">
        <Users size={14} className="text-[var(--color-text-muted)] flex-shrink-0" />
        <span className="text-[var(--color-text-muted)]">To:</span>
        <span className="text-[var(--color-text-primary)] font-medium truncate">
          {displayText}
        </span>
        {parsedMentions.length > 0 && (
          <span className="text-xs text-[var(--color-text-muted)] ml-auto flex-shrink-0">
            {parsedMentions.length} {parsedMentions.length === 1 ? 'recipient' : 'recipients'}
          </span>
        )}
      </div>
    </div>
  );
});
