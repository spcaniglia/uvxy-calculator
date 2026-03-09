import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

interface UpdateDataStatus {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  error: string | null;
  logLines: string[];
}

const EMPTY_STATUS: UpdateDataStatus = {
  running: false,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  error: null,
  logLines: [],
};

const getButtonStateLabel = (status: UpdateDataStatus, starting: boolean): string => {
  if (starting || status.running) return 'Updating...';
  if (status.exitCode === 0) return 'Updated';
  if (status.exitCode !== null && status.exitCode !== 0) return 'Update Failed';
  return 'Update Data';
};

export function UpdateDataButton() {
  const [status, setStatus] = useState<UpdateDataStatus>(EMPTY_STATUS);
  const [starting, setStarting] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/update-data/status');
      if (!response.ok) {
        throw new Error(`Status request failed (${response.status})`);
      }

      const payload = (await response.json()) as UpdateDataStatus;
      setStatus(payload);
      setApiError(null);
      if (payload.running) {
        setPanelOpen(true);
      }
    } catch (err) {
      setApiError(
        err instanceof Error
          ? `Update API unavailable: ${err.message}. Start it with "npm run dev:api".`
          : 'Update API unavailable. Start it with "npm run dev:api".'
      );
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!status.running) return;
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, 1200);
    return () => window.clearInterval(timer);
  }, [status.running, refreshStatus]);

  const startUpdate = async () => {
    setStarting(true);
    setPanelOpen(true);
    setApiError(null);

    try {
      const response = await fetch('/api/update-data/start', { method: 'POST' });
      const payload = (await response.json()) as Partial<UpdateDataStatus> & { error?: string };

      if (!response.ok) {
        setApiError(payload.error ?? `Failed to start update (${response.status})`);
      }

      setStatus((prev) => ({
        ...prev,
        ...payload,
        logLines: Array.isArray(payload.logLines) ? payload.logLines : prev.logLines,
      }));

      await refreshStatus();
    } catch (err) {
      setApiError(
        err instanceof Error
          ? `Failed to start update: ${err.message}`
          : 'Failed to start update.'
      );
    } finally {
      setStarting(false);
    }
  };

  const buttonLabel = getButtonStateLabel(status, starting);
  const buttonColorClass = status.running || starting
    ? 'bg-indigo-500 text-white border-indigo-400'
    : status.exitCode === 0
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : status.exitCode !== null && status.exitCode !== 0
        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
        : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700';

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void startUpdate()}
          disabled={status.running || starting}
          className={clsx(
            'px-3 py-2 rounded-md text-sm font-medium transition-all border flex items-center gap-2',
            buttonColorClass,
            (status.running || starting) && 'cursor-not-allowed'
          )}
          title="Runs ../update_app_data.sh via local API bridge"
        >
          {status.running || starting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {buttonLabel}
        </button>

        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          className="px-2.5 py-2 rounded-md text-xs font-semibold border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
        >
          Logs
        </button>
      </div>

      {panelOpen && (
        <div className="absolute right-0 mt-2 w-[34rem] max-w-[92vw] bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="text-sm font-semibold text-slate-200">Update Data Logs</div>
            <button
              type="button"
              onClick={() => void refreshStatus()}
              className="text-xs text-indigo-300 hover:text-indigo-200"
            >
              Refresh
            </button>
          </div>

          <div className="px-4 py-3 text-xs text-slate-400 space-y-1 border-b border-slate-800 font-mono">
            <div>Running: {status.running ? 'yes' : 'no'}</div>
            <div>Started: {status.startedAt ?? 'n/a'}</div>
            <div>Finished: {status.finishedAt ?? 'n/a'}</div>
            <div>Exit Code: {status.exitCode ?? 'n/a'}</div>
            {status.error && <div className="text-rose-400">Error: {status.error}</div>}
            {apiError && <div className="text-amber-300">{apiError}</div>}
          </div>

          <pre className="px-4 py-3 max-h-72 overflow-auto text-[11px] leading-5 font-mono text-slate-300 whitespace-pre-wrap">
            {status.logLines.length > 0 ? status.logLines.join('\n') : 'No logs yet.'}
          </pre>
        </div>
      )}
    </div>
  );
}
