import { memo, useEffect, useRef } from 'react';
import type { Gateway, FederatedSessionGateway } from '../types';

interface MentionOption {
  gatewayId: string;
  gatewayName: string;
  agentId: string;
  agentName: string;
  displayText: string; // e.g., "@steve:main"
}

interface MentionAutocompleteProps {
  gateways: Map<string, Gateway>;
  federatedGateways: FederatedSessionGateway[];
  searchTerm: string; // The partial text after @
  onSelect: (mention: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export const MentionAutocomplete = memo(function MentionAutocomplete({
  gateways,
  federatedGateways,
  searchTerm,
  onSelect,
  onClose,
  position,
}: MentionAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedIndexRef = useRef(0);

  // Build list of mention options from federated gateways
  const options: MentionOption[] = [];

  federatedGateways.forEach(fgw => {
    const gateway = gateways.get(fgw.gateway_id);
    if (!gateway) return;

    // Add options for each agent in the gateway
    if (gateway.agents && gateway.agents.length > 0) {
      gateway.agents.forEach(agent => {
        const displayText = `@${fgw.gateway_id}:${agent.id}`;
        options.push({
          gatewayId: fgw.gateway_id,
          gatewayName: gateway.config.name,
          agentId: agent.id,
          agentName: agent.name || agent.id,
          displayText,
        });
      });
    }

    // Also add gateway-only option
    options.push({
      gatewayId: fgw.gateway_id,
      gatewayName: gateway.config.name,
      agentId: '',
      agentName: 'All agents',
      displayText: `@${fgw.gateway_id}`,
    });
  });

  // Filter options based on search term
  const filteredOptions = searchTerm
    ? options.filter(opt =>
        opt.displayText.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opt.gatewayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opt.agentName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  // Reset selected index when filtered options change
  useEffect(() => {
    selectedIndexRef.current = 0;
  }, [searchTerm]);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndexRef.current = Math.min(selectedIndexRef.current + 1, filteredOptions.length - 1);
        containerRef.current?.querySelector(`[data-index="${selectedIndexRef.current}"]`)?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndexRef.current = Math.max(selectedIndexRef.current - 1, 0);
        containerRef.current?.querySelector(`[data-index="${selectedIndexRef.current}"]`)?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredOptions[selectedIndexRef.current];
        if (selected) {
          onSelect(selected.displayText);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredOptions, onSelect, onClose]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);

    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (filteredOptions.length === 0) {
    return (
      <div
        ref={containerRef}
        className="fixed z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg max-w-xs"
        style={{ top: position.top, left: position.left }}
      >
        <div className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
          No agents found
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg max-w-xs max-h-64 overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-2">
        <div className="text-xs text-[var(--color-text-muted)] px-2 py-1 font-semibold uppercase tracking-wide">
          Mention Agent
        </div>
        {filteredOptions.map((option, index) => (
          <button
            key={`${option.gatewayId}:${option.agentId}`}
            data-index={index}
            onClick={() => onSelect(option.displayText)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
              index === selectedIndexRef.current
                ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[var(--color-accent)]">
                {option.displayText}
              </span>
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {option.gatewayName} › {option.agentName}
            </div>
          </button>
        ))}
      </div>
      <div className="border-t border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
        <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-mono">↑↓</kbd> navigate •{' '}
        <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-mono">Enter</kbd> select •{' '}
        <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-mono">Esc</kbd> close
      </div>
    </div>
  );
});
