import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, Gateway } from '../types';
import { extractText, stripThinking } from '../hooks/useGateways';
import { Send, Square, ArrowDown, Copy, Check, ChevronDown, Brain } from 'lucide-react';

interface ChatViewProps {
  messages: ChatMessage[];
  streamText: string;
  streaming: boolean;
  loadingHistory?: boolean;
  activeGateway: Gateway | null;
  activeAgentId: string | null;
  error: string | null;
  onSend: (text: string) => void;
  onAbort: () => void;
  onDismissError: () => void;
  onUpdateAgentModel?: (gatewayId: string, agentId: string, modelId: string, fallbackModelId?: string) => void;
  onToggleAdvancedReasoning?: (gatewayId: string, agentId: string, enabled: boolean) => void;
}

// Code block component with header and copy button
const CodeBlock = memo(function CodeBlock({ children, className, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  const handleCopy = useCallback(() => {
    const codeText = children?.[0] || '';
    navigator.clipboard.writeText(String(codeText).trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="bg-[var(--color-surface-code-block)] rounded-lg overflow-hidden my-2 border border-[var(--color-border)]">
      <div className="bg-[var(--color-surface-code-header)] px-3 py-1.5 flex justify-between items-center text-[10px]">
        <span className="text-[var(--color-text-secondary)] font-medium">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          {copied ? (
            <>
              <Check size={10} />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={10} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
});

// Memoized MessageBubble component
const MessageBubble = memo(function MessageBubble({
  message,
}: {
  message: ChatMessage;
  onEdit?: (text: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTimestamp, setShowTimestamp] = useState(false);
  const text = extractText(message.content);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  const getRelativeTime = useCallback(() => {
    if (!message.timestamp) return '';
    const now = Date.now();
    const diff = now - message.timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }, [message.timestamp]);

  // Memoize the markdown rendering
  const renderedContent = useMemo(() => {
    const cleanedText = stripThinking(text);

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: any) {
            if (inline) {
              return (
                <code className="bg-[var(--color-surface-raised)] px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className} {...props}>{children}</CodeBlock>;
          },
          pre({ children }: any) {
            return <>{children}</>;
          },
        }}
      >
        {cleanedText}
      </ReactMarkdown>
    );
  }, [text]);

  if (message.role === 'user') {
    return (
      <div
        className="py-1.5 group message-enter"
        onMouseEnter={() => { setShowActions(true); setShowTimestamp(true); }}
        onMouseLeave={() => { setShowActions(false); setShowTimestamp(false); }}
      >
        <div className="max-w-5xl mx-auto px-2 relative">
          <div className="flex justify-end">
            <div
              className="bg-[var(--color-surface-user-msg)] text-[var(--color-text-primary)] rounded-lg px-2.5 py-1.5 max-w-[85%] text-sm leading-snug whitespace-pre-wrap border border-[var(--color-border)]"
              style={{ boxShadow: 'var(--shadow-sm)' }}
            >
              {text}
            </div>
          </div>
          {/* Action bar */}
          {showActions && (
            <div className="absolute top-0.5 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="p-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] rounded border border-[var(--color-border)] transition-all"
                title="Copy"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </div>
          )}
          {/* Timestamp */}
          <div className={`text-[10px] text-[var(--color-text-muted)] mt-0.5 text-right transition-opacity duration-200 ${showTimestamp && message.timestamp ? 'opacity-100' : 'opacity-0 pointer-events-none'} h-3`}>
            {message.timestamp ? getRelativeTime() : ''}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="py-1.5 group message-enter"
      onMouseEnter={() => { setShowActions(true); setShowTimestamp(true); }}
      onMouseLeave={() => { setShowActions(false); setShowTimestamp(false); }}
    >
      <div className="max-w-5xl mx-auto px-2 relative">
        {/* Action bar */}
        {showActions && (
          <div className="absolute top-0.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] rounded border border-[var(--color-border)] transition-all"
              title="Copy"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          </div>
        )}
        <div className="text-sm leading-tight text-[var(--color-text-primary)] prose prose-invert max-w-none prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-li:my-0.5 prose-pre:my-2 prose-code:text-xs">
          {renderedContent}
        </div>
        {/* Timestamp */}
        <div className={`text-[10px] text-[var(--color-text-muted)] mt-0.5 transition-opacity duration-200 ${showTimestamp && message.timestamp ? 'opacity-100' : 'opacity-0 pointer-events-none'} h-3`}>
          {message.timestamp ? getRelativeTime() : ''}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  const prevText = extractText(prevProps.message.content);
  const nextText = extractText(nextProps.message.content);
  return prevText === nextText && prevProps.message.timestamp === nextProps.message.timestamp;
});

// Separate memoized input component
interface ChatInputProps {
  connected: boolean;
  streaming: boolean;
  onSend: (text: string) => void;
  onAbort: () => void;
}

const ChatInput = memo(function ChatInput({ connected, streaming, onSend, onAbort }: ChatInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    if (!input.trim() || streaming) return;
    onSend(input.trim());
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      // Refocus immediately after sending
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [input, streaming, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Enter or Cmd+Enter to send
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 200) + 'px';
  }, []);

  const charCount = input.length;
  const showCharCount = charCount > 500;

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-3 pt-2 px-2">
      <div className="max-w-5xl mx-auto">
        <div
          className="flex items-center gap-2 bg-[var(--color-surface-input)] rounded-lg border border-[var(--color-border-input)] focus-within:border-[var(--color-border-focus)] px-3 py-2 relative transition-all duration-200"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={connected ? 'Send a message...' : 'Connect a gateway to start...'}
            disabled={!connected}
            rows={1}
            className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none disabled:opacity-50 leading-snug terminal-input"
            style={{ minHeight: '20px', maxHeight: '200px' }}
          />
          {showCharCount && (
            <div className="absolute bottom-2 right-12 text-[10px] text-[var(--color-text-muted)] font-medium">
              {charCount.toLocaleString()}
            </div>
          )}
          {streaming ? (
            <button
              onClick={onAbort}
              className="w-7 h-7 rounded-lg bg-[var(--status-offline)] hover:bg-[var(--status-offline)]/80 text-white flex items-center justify-center flex-shrink-0 transition-all"
              title="Stop generating"
              style={{ boxShadow: 'var(--shadow-sm)' }}
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !connected}
              className="w-7 h-7 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-surface)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-all"
              title="Send message (Enter)"
              style={{ boxShadow: input.trim() && connected ? 'var(--shadow-sm)' : 'none' }}
            >
              <Send size={16} />
            </button>
          )}
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)] mt-1 text-center">
          <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-mono text-[9px]">Enter</kbd> to send • <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-mono text-[9px]">Shift+Enter</kbd> for new line
        </div>
      </div>
    </div>
  );
});

// Empty state with branded clown theme
const EmptyState = memo(function EmptyState({
  connected,
  onSend
}: {
  connected: boolean;
  onSend: (text: string) => void;
}) {
  const suggestions = [
    "What can you do?",
    "Tell me a joke",
    "Help me code something",
    "Explain quantum computing"
  ];

  return (
    <div className="text-center text-[var(--color-text-muted)] mt-32 px-4">
      <div className="text-7xl mb-6 animate-pulse">🤡</div>
      <div className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
        Welcome to Interface 🤡
      </div>
      <div className="text-base mb-10 text-[var(--color-text-secondary)]">
        {connected ? 'The multi-gateway chat experience. Choose a suggestion or type your own message.' : 'Connect a gateway to begin your conversation'}
      </div>

      {connected && (
        <div className="flex flex-wrap gap-3 justify-center max-w-2xl mx-auto">
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => onSend(suggestion)}
              className="px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-focus)] transition-all duration-200 hover-lift"
              style={{ background: 'var(--gradient-card)' }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default function ChatView({
  messages,
  streamText,
  streaming,
  loadingHistory = false,
  activeGateway,
  activeAgentId,
  error,
  onSend,
  onAbort,
  onDismissError,
  onUpdateAgentModel,
  onToggleAdvancedReasoning,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [fallbackDropdownOpen, setFallbackDropdownOpen] = useState(false);

  // Auto-scroll
  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      isInitialLoad.current = false;
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamText]);

  // Track scroll position for scroll-to-bottom button
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollButton(distanceFromBottom > 200);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const connected = activeGateway?.connected ?? false;

  // Get active agent
  const activeAgent = useMemo(() => {
    if (!activeGateway || !activeAgentId) return null;
    return activeGateway.agents.find(a => a.id === activeAgentId) || null;
  }, [activeGateway, activeAgentId]);

  // Calculate context percentage (approximate based on message count)
  const contextPercentage = useMemo(() => {
    // Rough estimation: ~200k tokens max context, ~500 tokens per message average
    const estimatedTokens = messages.length * 500;
    const maxTokens = 200000;
    const percentage = Math.min((estimatedTokens / maxTokens) * 100, 100);
    return percentage;
  }, [messages.length]);

  // Context bar color based on percentage
  const contextBarColor = useMemo(() => {
    if (contextPercentage < 50) return 'rgb(34, 197, 94)'; // green
    if (contextPercentage < 75) return 'rgb(234, 179, 8)'; // yellow
    return 'rgb(239, 68, 68)'; // red
  }, [contextPercentage]);

  // Get model display names
  const agentModel = activeAgent?.selectedModel || activeGateway?.defaultModel || '';
  const agentFallbackModel = activeAgent?.fallbackModel || '';
  const isUsingDefaultModel = !activeAgent?.selectedModel && !!activeGateway?.defaultModel;
  const modelShortName = agentModel.split('/').pop()?.replace('claude-', '').replace('anthropic.', '') || 'None';
  const fallbackShortName = agentFallbackModel ? agentFallbackModel.split('/').pop()?.replace('claude-', '').replace('anthropic.', '') : 'None';

  // Memoize streaming content
  const streamingContent = useMemo(() => {
    if (!streamText) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[var(--color-text-muted)] rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-[var(--color-text-muted)] rounded-full animate-bounce [animation-delay:150ms]" />
          <div className="w-2 h-2 bg-[var(--color-text-muted)] rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      );
    }

    return (
      <>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ inline, className, children, ...props }: any) {
              if (inline) {
                return (
                  <code className="bg-[var(--color-surface-raised)] px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                    {children}
                  </code>
                );
              }
              return <CodeBlock className={className} {...props}>{children}</CodeBlock>;
            },
            pre({ children }: any) {
              return <>{children}</>;
            },
          }}
        >
          {stripThinking(streamText)}
        </ReactMarkdown>
        <span
          className="inline-block w-2 h-5 rounded-sm animate-pulse ml-0.5"
          style={{ background: 'var(--color-accent)' }}
        />
      </>
    );
  }, [streamText]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Error banner */}
      {error && (
        <div
          className="border-b px-4 py-3 flex items-center justify-between"
          style={{
            background: 'var(--status-offline)',
            borderColor: 'var(--status-offline)',
            color: 'white'
          }}
        >
          <span className="text-sm font-medium">{error}</span>
          <button
            onClick={onDismissError}
            className="hover:opacity-80 text-sm ml-4 font-medium transition-opacity"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top nav bar with model controls and context indicator */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="h-12 px-4 flex items-center gap-3">
          {/* Gateway/Agent info */}
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <span className="font-medium text-[var(--color-text-primary)]">
              {activeGateway?.config.name || 'No gateway'}
            </span>
            {activeAgent && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span>{activeAgent.emoji || '🤖'}</span>
                  <span>{activeAgent.name || activeAgent.id}</span>
                </span>
              </>
            )}
          </div>

          {/* Model controls - only show if connected and agent selected */}
          {connected && activeAgent && activeGateway && onUpdateAgentModel && (
            <div className="flex items-center gap-2 ml-auto">
              {/* Primary Model dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setModelDropdownOpen(!modelDropdownOpen);
                    setFallbackDropdownOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] transition-colors"
                  title={isUsingDefaultModel ? `Using gateway default: ${agentModel}` : `Current model: ${agentModel}`}
                >
                  <span className="text-[var(--color-text-muted)] font-medium">Model:</span>
                  <span className={`font-mono max-w-[80px] truncate ${isUsingDefaultModel ? 'text-[var(--color-text-secondary)] italic' : 'text-[var(--color-text-primary)]'}`}>
                    {modelShortName}
                  </span>
                  <ChevronDown size={10} className="text-[var(--color-text-muted)]" />
                </button>

                {modelDropdownOpen && activeGateway.models.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 min-w-[200px] z-50 max-h-60 overflow-y-auto">
                    {activeGateway.models.map(model => {
                      const modelId = model.id;
                      const displayName = model.name || modelId.split('/').pop()?.replace('claude-', '').replace('anthropic.', '') || modelId;
                      const isSelected = modelId === agentModel;
                      const isAutoDetected = isSelected && !activeAgent.selectedModel && !!activeGateway?.defaultModel;
                      return (
                        <button
                          key={modelId}
                          onClick={() => {
                            onUpdateAgentModel(activeGateway.config.id, activeAgent.id, modelId, agentFallbackModel);
                            setModelDropdownOpen(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 text-[10px] hover:bg-[var(--color-surface-hover)] transition-colors ${
                            isSelected ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-text-secondary)]'
                          }`}
                          title={displayName}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{displayName}</span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {isAutoDetected && <span className="text-[var(--color-text-muted)] text-[9px]">(auto)</span>}
                              {isSelected && <span className="text-[var(--color-accent)]">✓</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Fallback Model dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setFallbackDropdownOpen(!fallbackDropdownOpen);
                    setModelDropdownOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] transition-colors"
                  title={agentFallbackModel ? `Fallback: ${agentFallbackModel}` : 'No fallback model set'}
                >
                  <span className="text-[var(--color-text-muted)] font-medium">Fallback:</span>
                  <span className="font-mono text-[var(--color-text-secondary)] max-w-[80px] truncate">
                    {fallbackShortName}
                  </span>
                  <ChevronDown size={10} className="text-[var(--color-text-muted)]" />
                </button>

                {fallbackDropdownOpen && activeGateway.models.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 min-w-full z-50 max-h-60 overflow-y-auto">
                    <button
                      onClick={() => {
                        onUpdateAgentModel(activeGateway.config.id, activeAgent.id, agentModel, '');
                        setFallbackDropdownOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 text-[10px] hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-muted)] italic"
                    >
                      None
                    </button>
                    {activeGateway.models.map(model => {
                      const modelId = model.id;
                      const displayName = modelId.split('/').pop()?.replace('claude-', '').replace('anthropic.', '') || modelId;
                      const isSelected = modelId === agentFallbackModel;
                      return (
                        <button
                          key={modelId}
                          onClick={() => {
                            onUpdateAgentModel(activeGateway.config.id, activeAgent.id, agentModel, modelId);
                            setFallbackDropdownOpen(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 text-[10px] hover:bg-[var(--color-surface-hover)] transition-colors ${
                            isSelected ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-text-secondary)]'
                          }`}
                          title={model.name || modelId}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{model.name || displayName}</span>
                            {isSelected && <span className="text-[var(--color-accent)]">✓</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Advanced Reasoning toggle */}
              {onToggleAdvancedReasoning && (
                <button
                  onClick={() => {
                    onToggleAdvancedReasoning(activeGateway.config.id, activeAgent.id, !activeAgent.advancedReasoning);
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors border ${
                    activeAgent.advancedReasoning
                      ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                      : 'bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                  title={activeAgent.advancedReasoning ? 'Advanced reasoning enabled' : 'Advanced reasoning disabled'}
                >
                  <Brain size={10} />
                  <span className="font-medium">Reasoning</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Context usage progress bar */}
        {contextPercentage > 0 && (
          <div className="h-0.5 w-full bg-[var(--color-surface-hover)] overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${contextPercentage}%`,
                background: `linear-gradient(to right, ${contextBarColor}, ${contextBarColor})`,
              }}
              title={`Context usage: ~${Math.round(contextPercentage)}%`}
            />
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="pb-4">
          {/* Show loading indicator if loading history */}
          {loadingHistory && messages.length === 0 && (
            <div className="text-center text-[var(--color-text-muted)] mt-32">
              <div className="text-sm animate-pulse">Loading history...</div>
            </div>
          )}

          {/* Only show welcome screen if truly empty AND not loading AND not streaming AND has stream text */}
          {messages.length === 0 && !streaming && !loadingHistory && !streamText && (
            <EmptyState
              connected={connected}
              onSend={onSend}
            />
          )}

          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              message={msg}
              onEdit={msg.role === 'user' ? (text) => {
                // TODO: Implement edit functionality
                console.log('Edit message:', text);
              } : undefined}
            />
          ))}

          {/* Streaming */}
          {streaming && (
            <div className="py-1.5">
              <div className="max-w-5xl mx-auto px-2">
                <div className="text-sm leading-tight text-[var(--color-text-primary)] prose prose-invert max-w-none prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-li:my-0.5 prose-pre:my-2 prose-code:text-xs">
                  {streamingContent}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-32 right-8 rounded-full bg-[var(--color-accent)] text-[var(--color-surface)] p-3 transition-all hover-lift"
            style={{ boxShadow: 'var(--shadow-lg)' }}
            title="Scroll to bottom"
          >
            <ArrowDown size={20} />
          </button>
        )}
      </div>

      {/* Input - isolated component */}
      <ChatInput
        connected={connected}
        streaming={streaming}
        onSend={onSend}
        onAbort={onAbort}
      />
    </div>
  );
}
