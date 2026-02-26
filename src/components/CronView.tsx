import { useState, useEffect, useCallback } from 'react';
import type { CronJob, Gateway } from '../types';
import { GatewayClient } from '../gateway';
import { Clock, RefreshCw, Play, Server, Loader2 } from 'lucide-react';

interface CronJobWithGateway extends CronJob {
  gatewayId: string;
  gatewayName: string;
}

interface CronViewProps {
  gateways: Map<string, Gateway>;
  getClient: (gwId: string) => GatewayClient | null;
}

export default function CronView({ gateways, getClient }: CronViewProps) {
  const [allJobs, setAllJobs] = useState<CronJobWithGateway[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningJob, setRunningJob] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const combined: CronJobWithGateway[] = [];

    // Fetch cron jobs from ALL gateways
    const promises = Array.from(gateways.values()).map(async (gw) => {
      if (!gw.connected) return;

      const client = getClient(gw.config.id);
      if (!client?.connected) return;

      try {
        const res = await client.request('cron.list', {});
        const jobs = res?.jobs || [];
        jobs.forEach((j: CronJob) => {
          combined.push({
            ...j,
            gatewayId: gw.config.id,
            gatewayName: gw.config.name,
          });
        });
      } catch { }
    });

    await Promise.all(promises);
    setAllJobs(combined);
    setLoading(false);
  }, [gateways, getClient]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleJob = useCallback(async (job: CronJobWithGateway, enabled: boolean) => {
    const client = getClient(job.gatewayId);
    if (!client?.connected) return;

    try {
      await client.request('cron.update', { id: job.id, enabled });
      setAllJobs(prev => prev.map(j =>
        j.gatewayId === job.gatewayId && j.id === job.id
          ? { ...j, enabled }
          : j
      ));
    } catch { }
  }, [getClient]);

  const runJob = useCallback(async (job: CronJobWithGateway) => {
    const client = getClient(job.gatewayId);
    if (!client?.connected) return;

    setRunningJob(`${job.gatewayId}-${job.id}`);
    try {
      await client.request('cron.run', { id: job.id });
    } catch { }
    setRunningJob(null);
    // Refresh to get updated lastRun
    setTimeout(refresh, 2000);
  }, [getClient, refresh]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto py-6 px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Cron Jobs</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Scheduled tasks across all gateways</p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {allJobs.length === 0 ? (
          <div className="text-center text-[var(--color-text-muted)] py-16">
            <div className="text-6xl mb-4">⏰</div>
            <div className="text-lg font-medium text-[var(--color-text-primary)]">No cron jobs configured</div>
            <div className="text-sm mt-2">Schedule tasks to run automatically</div>
          </div>
        ) : (
          <div className="space-y-3">
            {allJobs.map(j => (
              <div
                key={`${j.gatewayId}-${j.id}`}
                className="p-5 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-focus)] transition-all duration-200 hover-lift"
                style={{
                  background: 'var(--gradient-card)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5 mb-2">
                      <Clock size={16} className="text-[var(--color-text-secondary)]" />
                      <span className={`text-sm font-semibold ${j.enabled ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] line-through'}`}>
                        {j.name || j.id}
                      </span>
                      <span
                        className="text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1.5"
                        style={{
                          background: 'var(--gradient-card)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <Server size={10} />
                        {j.gatewayName}
                      </span>
                      <code
                        className="text-xs px-2 py-1 rounded-lg font-mono font-medium"
                        style={{
                          background: 'var(--color-surface-hover)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {j.schedule}
                      </code>
                    </div>
                    {j.task && (
                      <div className="text-xs text-[var(--color-text-muted)] ml-6 mb-1 truncate max-w-lg">
                        {j.task}
                      </div>
                    )}
                    <div className="text-xs text-[var(--color-text-muted)] ml-6 flex flex-wrap gap-3">
                      {j.agentId && <span>Agent: <span className="text-[var(--color-text-secondary)]">{j.agentId}</span></span>}
                      {j.lastRun && (
                        <span>
                          Last run: <span className="text-[var(--color-text-secondary)]">{new Date(j.lastRun).toLocaleString()}</span>
                          {j.lastResult && <span className="ml-1">• {j.lastResult}</span>}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <button
                      onClick={() => runJob(j)}
                      disabled={runningJob === `${j.gatewayId}-${j.id}` || !j.enabled}
                      className="p-2 text-[var(--color-text-muted)] hover:text-[var(--status-online)] disabled:opacity-30 transition-all rounded-lg hover:bg-[var(--color-surface-hover)]"
                      title="Run now"
                    >
                      {runningJob === `${j.gatewayId}-${j.id}` ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Play size={16} />
                      )}
                    </button>
                    <button
                      onClick={() => toggleJob(j, !j.enabled)}
                      className={`relative w-12 h-6 rounded-full transition-all duration-200 ${
                        j.enabled
                          ? 'bg-[var(--status-online)]'
                          : 'bg-[var(--color-surface-hover)]'
                      } border border-[var(--color-border)]`}
                      title={j.enabled ? 'Disable job' : 'Enable job'}
                      style={{
                        boxShadow: j.enabled ? '0 0 8px var(--status-online)' : 'none',
                      }}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 ${
                          j.enabled ? 'left-6 bg-white' : 'left-0.5 bg-[var(--color-text-muted)]'
                        }`}
                        style={{
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
