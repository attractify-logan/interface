import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { FederatedChatMessage, Gateway, FederatedSession } from '../types';
import { extractText, stripThinking } from '../hooks/useGateways';
import { generateGatewayColor } from '../utils/colors';
import { Send, Square, ArrowDown, Copy, Check } from 'lucide-react';
import { MentionAutocomplete } from './MentionAutocomplete';
import { RecipientsBar } from './RecipientsBar';

interface FederatedChatViewProps {
  messages: FederatedChatMessage[];
  streamingMessages: Map<string, string>; // gateway_id:agent_name -> partial text
  streaming: boolean;
  federatedSession: FederatedSession | null;
  gateways: Map<string, Gateway>;
  error: string | null;
  connected: boolean;
  onSend: (text: string, broadcast?: boolean) => void;
  onAbort: () => void;
  onDismissError: () => void;
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
    <div className="bg-[var(--color-surface-code-block)] rounded-xl overflow-hidden my-4 border border-[var(--color-border)]">
      <div className="bg-[var(--color-surface-code-header)] px-4 py-2 flex justify-between items-center text-xs">
        <span className="text-[var(--color-text-secondary)] font-medium">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          {copied ? (
            <>
              <Check size={12} />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
});

// Memoized MessageBubble component with federated styling
const FederatedMessageBubble = memo(function FederatedMessageBubble({
  message,
  gateways,
}: {
  message: FederatedChatMessage;
  gateways: Map<string, Gateway>;
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
        className="py-6 group message-enter"
        onMouseEnter={() => { setShowActions(true); setShowTimestamp(true); }}
        onMouseLeave={() => { setShowActions(false); setShowTimestamp(false); }}
      >
        <div className="max-w-3xl mx-auto px-4 relative">
          <div className="flex justify-end">
            <div
              className="bg-[var(--color-surface-user-msg)] text-[var(--color-text-primary)] rounded-2xl px-5 py-3.5 max-w-[85%] text-[15px] leading-relaxed whitespace-pre-wrap border border-[var(--color-border)]"
              style={{ boxShadow: 'var(--shadow-sm)' }}
            >
              {text}
            </div>
          </div>
          {/* Action bar */}
          {showActions && (
            <div className="absolute top-1 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="p-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] rounded-lg border border-[var(--color-border)] transition-all hover-lift"
                title="Copy"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          )}
          {/* Timestamp */}
          <div className={`text-xs text-[var(--color-text-muted)] mt-1 text-right transition-opacity duration-200 ${showTimestamp && message.timestamp ? 'opacity-100' : 'opacity-0 pointer-events-none'} h-4`}>
            {message.timestamp ? getRelativeTime() : ''}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message with source attribution and color-coded border
  const gatewayColor = message.source ? generateGatewayColor(message.source.gateway_id) : 'var(--color-accent)';
  const gateway = message.source ? gateways.get(message.source.gateway_id) : null;
  const gatewayName = gateway?.config.name || message.source?.gateway_id || 'Unknown';
  const agentName = message.source?.agent_name || 'Agent';

  return (
    <div
      className="py-6 group message-enter"
      onMouseEnter={() => { setShowActions(true); setShowTimestamp(true); }}
      onMouseLeave={() => { setShowActions(false); setShowTimestamp(false); }}
    >
      <div className="max-w-3xl mx-auto px-4 relative">
        {/* Source header with gateway color */}
        {message.source && (
          <div className="flex items-center gap-2 mb-2 text-xs">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: gatewayColor }}
            />
            <span className="text-[var(--color-text-secondary)] font-medium">
              {gatewayName}
            </span>
            <span className="text-[var(--color-text-muted)]">›</span>
            <span className="text-[var(--color-text-muted)]">
              {agentName}
            </span>
          </div>
        )}

        {/* Message content with colored left border */}
        <div
          className="pl-4 border-l-[3px] rounded-l"
          style={{ borderColor: gatewayColor }}
        >
          {/* Action bar */}
          {showActions && (
            <div className="absolute top-1 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="p-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] rounded-lg border border-[var(--color-border)] transition-all hover-lift"
                title="Copy"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          )}
          <div className="text-[15px] leading-7 text-[var(--color-text-primary)] prose prose-invert max-w-none prose-p:my-3 prose-headings:mt-6 prose-headings:mb-3 prose-li:my-1 prose-pre:my-4 prose-code:text-[13px]">
            {renderedContent}
          </div>
        </div>

        {/* Timestamp */}
        <div className={`text-xs text-[var(--color-text-muted)] mt-1 transition-opacity duration-200 ${showTimestamp && message.timestamp ? 'opacity-100' : 'opacity-0 pointer-events-none'} h-4`}>
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

// Separate memoized input component with @mention support
interface FederatedChatInputProps {
  connected: boolean;
  streaming: boolean;
  federatedSession: FederatedSession | null;
  gateways: Map<string, Gateway>;
  onSend: (text: string, broadcast?: boolean) => void;
  onAbort: () => void;
}

const FederatedChatInput = memo(function FederatedChatInput({
  connected,
  streaming,
  federatedSession,
  gateways,
  onSend,
  onAbort,
}: FederatedChatInputProps) {
  const [input, setInput] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearchTerm, setMentionSearchTerm] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Parse @mentions from input
  const parseMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+(?::\w+)?)/g;
    const matches = text.match(mentionRegex);
    return matches || [];
  };

  const mentions = useMemo(() => parseMentions(input), [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || streaming) return;

    // Determine if broadcast based on mentions
    const hasMentions = mentions.length > 0;
    const broadcast = !hasMentions; // If no mentions, broadcast to all

    onSend(input.trim(), broadcast);
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [input, streaming, mentions, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Don't handle Enter if mention autocomplete is open
    if (showMentions && (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Escape')) {
      return;
    }

    // Enter or Cmd+Enter to send
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, showMentions]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    const target = e.target;
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 200) + 'px';

    // Check for @ trigger
    const cursorPos = target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Only show mentions if @ is the start of a word (preceded by space or start of string)
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (/\s/.test(charBeforeAt) || lastAtIndex === 0) {
        // Check if there's a space after @, if so close
        if (textAfterAt.includes(' ')) {
          setShowMentions(false);
        } else {
          setShowMentions(true);
          setMentionSearchTerm(textAfterAt);

          // Calculate position
          const rect = target.getBoundingClientRect();
          setMentionPosition({
            top: rect.top - 300, // Show above input
            left: rect.left + 20,
          });
        }
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }, []);

  const handleMentionSelect = useCallback((mention: string) => {
    // Replace the partial @mention with the selected one
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = input.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const beforeAt = input.slice(0, lastAtIndex);
      const afterCursor = input.slice(cursorPos);
      const newInput = beforeAt + mention + ' ' + afterCursor;
      setInput(newInput);

      // Set cursor position after the mention
      setTimeout(() => {
        const newCursorPos = lastAtIndex + mention.length + 1;
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current?.focus();
      }, 0);
    }

    setShowMentions(false);
  }, [input]);

  const charCount = input.length;
  const showCharCount = charCount > 500;

  return (
    <>
      {federatedSession && (
        <RecipientsBar
          mentions={mentions}
          federatedGateways={federatedSession.gateways}
          gateways={gateways}
        />
      )}

      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-5 pt-4 px-4">
        <div className="max-w-3xl mx-auto">
          <div
            className="flex items-center gap-3 bg-[var(--color-surface-input)] rounded-2xl border-2 border-[var(--color-border-input)] focus-within:border-[var(--color-border-focus)] px-4 py-3 relative transition-all duration-200"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={connected ? 'Send a message... (type @ to mention)' : 'Connect gateways to start...'}
              disabled={!connected}
              rows={1}
              className="flex-1 bg-transparent text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none disabled:opacity-50 leading-normal terminal-input"
              style={{ minHeight: '24px', maxHeight: '200px' }}
            />
            {showCharCount && (
              <div className="absolute bottom-3 right-16 text-xs text-[var(--color-text-muted)] font-medium">
                {charCount.toLocaleString()}
              </div>
            )}
            {streaming ? (
              <button
                onClick={onAbort}
                className="w-9 h-9 rounded-xl bg-[var(--status-offline)] hover:bg-[var(--status-offline)]/80 text-white flex items-center justify-center flex-shrink-0 transition-all hover-lift"
                title="Stop generating"
                style={{ boxShadow: 'var(--shadow-sm)' }}
              >
                <Square size={18} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || !connected}
                className="w-9 h-9 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-surface)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-all hover-lift"
                title="Send message (Enter)"
                style={{ boxShadow: input.trim() && connected ? 'var(--shadow-sm)' : 'none' }}
              >
                <Send size={18} />
              </button>
            )}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-2 text-center">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-mono">@</kbd> mention •{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-mono">Enter</kbd> send •{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-mono">Shift+Enter</kbd> new line
          </div>
        </div>
      </div>

      {showMentions && federatedSession && (
        <MentionAutocomplete
          gateways={gateways}
          federatedGateways={federatedSession.gateways}
          searchTerm={mentionSearchTerm}
          onSelect={handleMentionSelect}
          onClose={() => setShowMentions(false)}
          position={mentionPosition}
        />
      )}
    </>
  );
});

// Empty state for federated chat
const FederatedEmptyState = memo(function FederatedEmptyState({
  connected,
  onSend,
  federatedSession,
}: {
  connected: boolean;
  onSend: (text: string) => void;
  federatedSession: FederatedSession | null;
}) {
  const suggestions = [
    "@all What can you each do?",
    "Compare your capabilities",
    "Help me brainstorm ideas",
    "Explain this from different perspectives"
  ];

  const gatewayCount = federatedSession?.gateways.length || 0;

  return (
    <div className="text-center text-[var(--color-text-muted)] mt-32 px-4">
      <div className="text-7xl mb-6 animate-pulse">🔗</div>
      <div className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
        Federated Chat
      </div>
      <div className="text-base mb-10 text-[var(--color-text-secondary)]">
        {connected
          ? `Connected to ${gatewayCount} ${gatewayCount === 1 ? 'gateway' : 'gateways'}. Chat with multiple agents simultaneously.`
          : 'Connect gateways to begin your federated conversation'}
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

export default function FederatedChatView({
  messages,
  streamingMessages,
  streaming,
  federatedSession,
  gateways,
  error,
  connected,
  onSend,
  onAbort,
  onDismissError,
}: FederatedChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Auto-scroll
  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      isInitialLoad.current = false;
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingMessages]);

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

  // Render streaming messages as separate bubbles per source
  const streamingBubbles = useMemo(() => {
    return Array.from(streamingMessages.entries()).map(([sourceKey, text]) => {
      const [gatewayId, agentName] = sourceKey.split(':');
      const gatewayColor = generateGatewayColor(gatewayId);
      const gateway = gateways.get(gatewayId);
      const gatewayName = gateway?.config.name || gatewayId;

      return (
        <div key={sourceKey} className="py-6">
          <div className="max-w-3xl mx-auto px-4">
            {/* Source header */}
            <div className="flex items-center gap-2 mb-2 text-xs">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: gatewayColor }}
              />
              <span className="text-[var(--color-text-secondary)] font-medium">
                {gatewayName}
              </span>
              <span className="text-[var(--color-text-muted)]">›</span>
              <span className="text-[var(--color-text-muted)]">
                {agentName}
              </span>
            </div>

            {/* Streaming content */}
            <div
              className="pl-4 border-l-[3px] rounded-l"
              style={{ borderColor: gatewayColor }}
            >
              <div className="text-[15px] leading-7 text-[var(--color-text-primary)] prose prose-invert max-w-none prose-p:my-3 prose-headings:mt-6 prose-headings:mb-3 prose-li:my-1 prose-pre:my-4 prose-code:text-[13px]">
                {text ? (
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
                      {stripThinking(text)}
                    </ReactMarkdown>
                    <span
                      className="inline-block w-2 h-5 rounded-sm animate-pulse ml-0.5"
                      style={{ background: gatewayColor }}
                    />
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: gatewayColor }} />
                    <div className="w-2 h-2 rounded-full animate-bounce [animation-delay:150ms]" style={{ background: gatewayColor }} />
                    <div className="w-2 h-2 rounded-full animate-bounce [animation-delay:300ms]" style={{ background: gatewayColor }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    });
  }, [streamingMessages, gateways]);

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

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="pb-4">
          {messages.length === 0 && !streaming && (
            <FederatedEmptyState
              connected={connected}
              onSend={onSend}
              federatedSession={federatedSession}
            />
          )}

          {messages.map((msg, i) => (
            <FederatedMessageBubble
              key={i}
              message={msg}
              gateways={gateways}
            />
          ))}

          {/* Streaming messages - stacked by source */}
          {streaming && streamingBubbles}

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

      {/* Input - isolated component with @mention support */}
      <FederatedChatInput
        connected={connected}
        streaming={streaming}
        federatedSession={federatedSession}
        gateways={gateways}
        onSend={onSend}
        onAbort={onAbort}
      />
    </div>
  );
}
