export default function AboutView() {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-3">
            <span className="text-5xl">🤡</span>
            About Interface
          </h1>
          <p className="text-[var(--color-text-muted)] text-lg">
            Why this exists and what it's for
          </p>
        </div>

        <div className="space-y-6 text-[var(--color-text-secondary)] leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
              Why I Built This
            </h2>
            <div className="space-y-4">
              <p>
                Hey, I'm Logan. I built Interface because I needed a single app to chat with all my machines —
                my MacBook, my home server, any device running an AI agent. I wanted a unified interface to
                talk to multiple gateways, spawn conversations with different models, and orchestrate everything
                from one place.
              </p>
              <p>
                Most chat UIs only talk to one backend. That's fine for most people, but I needed something
                that could talk to all of them. I have agents running on different machines doing different
                things — some handling automation, some doing research, some managing my home lab. Switching
                between different apps or terminal windows to talk to each one was driving me nuts.
              </p>
              <p>
                So I built this. It's a multi-gateway chat interface that maintains persistent connections to
                all my OpenClaw instances at once. I can see which agents are online, what they're doing, and
                start conversations with any of them instantly. I can even do federated chats where I broadcast
                a message to multiple agents across different gateways and see all their responses in one view.
              </p>
              <p>
                It's basically mission control for my distributed AI setup. Instead of juggling contexts across
                different terminals and apps, I have one place where I can see everything, talk to everyone,
                and keep all my conversations organized.
              </p>
            </div>
          </section>

          <section className="border-t border-[var(--color-border)] pt-6">
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
              What It Does
            </h2>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="text-xl flex-shrink-0">🌐</span>
                <div>
                  <strong className="text-[var(--color-text-primary)]">Multi-Gateway Connections</strong>
                  <p className="text-sm">Connect to multiple OpenClaw instances simultaneously. Each gateway shows online status, available agents, and active models.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl flex-shrink-0">💬</span>
                <div>
                  <strong className="text-[var(--color-text-primary)]">Federated Conversations</strong>
                  <p className="text-sm">Broadcast messages to agents across different gateways. Get responses from multiple AI models in a single conversation thread.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl flex-shrink-0">🤖</span>
                <div>
                  <strong className="text-[var(--color-text-primary)]">Agent Management</strong>
                  <p className="text-sm">Spawn new agents, switch between conversations, and see agent activity with visual indicators. Subagents nest visually for easy tracking.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl flex-shrink-0">💾</span>
                <div>
                  <strong className="text-[var(--color-text-primary)]">Persistent History</strong>
                  <p className="text-sm">All conversations are stored in SQLite. Jump back into any session instantly with full message history.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl flex-shrink-0">⚡</span>
                <div>
                  <strong className="text-[var(--color-text-primary)]">Real-Time Everything</strong>
                  <p className="text-sm">WebSocket connections keep everything live. See typing indicators, streaming responses, and connection status in real-time.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="border-t border-[var(--color-border)] pt-6">
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
              Tech Stack
            </h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-xl border border-[var(--color-border)]" style={{ background: 'var(--gradient-card)' }}>
                <div className="font-semibold text-[var(--color-text-primary)] mb-2">Frontend</div>
                <ul className="space-y-1 text-[var(--color-text-muted)]">
                  <li>React 18 + TypeScript</li>
                  <li>Vite for blazing builds</li>
                  <li>TailwindCSS 4 for styling</li>
                  <li>WebSocket for real-time</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl border border-[var(--color-border)]" style={{ background: 'var(--gradient-card)' }}>
                <div className="font-semibold text-[var(--color-text-primary)] mb-2">Backend</div>
                <ul className="space-y-1 text-[var(--color-text-muted)]">
                  <li>FastAPI (Python 3.13)</li>
                  <li>SQLite for persistence</li>
                  <li>Persistent gateway connections</li>
                  <li>Token management & security</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="border-t border-[var(--color-border)] pt-6">
            <div className="p-6 rounded-xl border-2 border-[var(--color-accent)]/20" style={{ background: 'linear-gradient(135deg, var(--color-surface-hover), var(--color-surface))' }}>
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <span className="text-3xl">🤡</span>
                About the Clown
              </h2>
              <div className="space-y-3 text-[var(--color-text-secondary)]">
                <p>
                  The clown emoji is a heartfelt tribute to the YouTube series{' '}
                  <strong className="text-[var(--color-text-primary)]">"u m a m i"</strong> and the
                  character <strong className="text-[var(--color-text-primary)]">Mischief</strong>.
                  I'm genuinely a huge fan of the series and its creative spirit — the way it explores
                  AI agents, automation, and digital mischief resonated with me while building this project.
                </p>
                <p>
                  This is purely a fan tribute expressing appreciation for the series' creativity and
                  the vibe it brings to thinking about AI agents. Interface has{' '}
                  <strong className="text-[var(--color-text-primary)]">no official affiliation, endorsement,
                  or sponsorship</strong> from the Umami series or its creators. This is just one fan's
                  way of saying thanks for the inspiration.
                </p>
                <p className="text-sm text-[var(--color-text-muted)] italic">
                  If you know, you know. 🤡
                </p>
              </div>
            </div>
          </section>

          <section className="border-t border-[var(--color-border)] pt-6">
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
              Open Source
            </h2>
            <p>
              Interface is open source and available on GitHub. Feel free to fork it, modify it,
              or use it as a reference for your own projects. The code is MIT licensed, so do whatever
              you want with it.
            </p>
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              Built with curiosity, coffee, and a lot of WebSockets.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
