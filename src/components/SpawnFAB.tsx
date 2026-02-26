import { useState } from 'react';

interface SpawnFABProps {
  onNewChat: () => void;
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
}

export function SpawnFAB({
  onNewChat,
  onOpenCommandPalette,
  onOpenSettings,
}: SpawnFABProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleMainClick = () => {
    setMenuOpen(!menuOpen);
  };

  const handleAction = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Radial Menu */}
      {menuOpen && (
        <div className="absolute bottom-full right-0 mb-4 animate-fade-in">
          <div className="flex flex-col gap-3 items-end">
            {/* New Chat */}
            <button
              onClick={() => handleAction(onNewChat)}
              className="fab-menu-item group"
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
              }}
              title="New Chat"
            >
              <span className="text-2xl">💬</span>
              <span
                className="ml-3 text-sm font-medium whitespace-nowrap"
                style={{ color: 'var(--color-text-primary)' }}
              >
                New Chat
              </span>
            </button>

            {/* Spawn Agent */}
            <button
              onClick={() => handleAction(onOpenCommandPalette)}
              className="fab-menu-item group"
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
              }}
              title="Spawn Agent"
            >
              <span className="text-2xl">🚀</span>
              <span
                className="ml-3 text-sm font-medium whitespace-nowrap"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Spawn Agent
              </span>
            </button>

            {/* Settings */}
            <button
              onClick={() => handleAction(onOpenSettings)}
              className="fab-menu-item group"
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
              }}
              title="Settings"
            >
              <span className="text-2xl">⚙️</span>
              <span
                className="ml-3 text-sm font-medium whitespace-nowrap"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Settings
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Main FAB Button */}
      <button
        onClick={handleMainClick}
        className={`fab-main ${menuOpen ? 'fab-main-open' : ''}`}
        style={{
          background: 'var(--color-accent)',
          boxShadow: 'var(--shadow-glow)',
        }}
        title="Quick Actions"
      >
        <span className={`text-3xl transition-transform ${menuOpen ? 'rotate-45' : ''}`} style={{ lineHeight: 0, position: 'relative', top: '4px' }}>
          {menuOpen ? '✕' : '🤡'}
        </span>
      </button>

      {/* Backdrop when menu is open */}
      {menuOpen && (
        <div
          className="fixed inset-0 -z-10"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
