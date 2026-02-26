import { useState, useRef, useEffect } from 'react';
import type { Gateway } from '../types';

interface TopBarProps {
  activeGateway: Gateway | null;
  activeAgentId: string | null;
  activeSessionKey: string;
  sidebarOpen: boolean;
  selectedModel: string | null;
  onToggleSidebar: () => void;
  onChangeAgent: (id: string) => void;
  onChangeModel: (modelId: string) => void;
}

export default function TopBar({
  activeGateway,
  // activeAgentId,
  activeSessionKey,
  sidebarOpen,
  selectedModel,
  onToggleSidebar,
  // onChangeAgent,
  onChangeModel,
}: TopBarProps) {
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayModel = selectedModel || activeGateway?.defaultModel || '';
  const shortModelName = displayModel.split('/').pop() || '';
  const hasModels = activeGateway?.models && activeGateway.models.length > 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
    };

    if (showModelDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showModelDropdown]);

  return (
    <header className="h-12 flex items-center px-4 border-b border-border bg-surface flex-shrink-0">
      <button
        onClick={onToggleSidebar}
        className="mr-3 text-text-muted hover:text-text-secondary transition-colors"
        title={sidebarOpen ? 'Close sidebar' : 'Open sidebar (⌘B)'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>

      {activeGateway && (
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${activeGateway.connected ? 'bg-green-500' : 'bg-red-500'}`} />
            {activeGateway.identity?.emoji && (
              <span className="text-sm">{activeGateway.identity.emoji}</span>
            )}
            <span className="text-sm font-medium text-text-primary truncate">
              {activeGateway.config.name}
            </span>
          </div>

          {/* Model dropdown */}
          {displayModel && hasModels && (
            <>
              <span className="text-text-muted hidden sm:inline">•</span>
              <div className="relative hidden sm:block" ref={dropdownRef}>
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="text-xs text-text-muted hover:text-text-secondary truncate px-2 py-1 rounded hover:bg-surface-hover transition-colors flex items-center gap-1"
                  title={displayModel}
                >
                  <span>{shortModelName}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {showModelDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[200px] z-50">
                    {activeGateway.models.map(model => {
                      const modelId = model.id;
                      const modelName = modelId.split('/').pop() || modelId;
                      const isSelected = modelId === displayModel;

                      return (
                        <button
                          key={modelId}
                          onClick={() => {
                            onChangeModel(modelId);
                            setShowModelDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors flex items-center justify-between ${
                            isSelected ? 'text-text-primary font-medium' : 'text-text-secondary'
                          }`}
                        >
                          <span className="truncate">{model.name || modelName}</span>
                          {isSelected && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
          {/* Fallback for when no models available */}
          {displayModel && !hasModels && (
            <>
              <span className="text-text-muted hidden sm:inline">•</span>
              <span className="text-xs text-text-muted truncate hidden sm:inline" title={displayModel}>
                {shortModelName}
              </span>
            </>
          )}

          {/* Session key */}
          <>
            <span className="text-text-muted hidden md:inline">•</span>
            <span className="text-sm text-text-secondary truncate hidden md:inline">
              {activeSessionKey}
            </span>
          </>
        </div>
      )}

      {!activeGateway && (
        <span className="text-sm text-text-muted">No gateway connected</span>
      )}
    </header>
  );
}
