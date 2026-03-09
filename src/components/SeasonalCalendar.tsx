import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarDays, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import {
  buildSeasonalWeeklyCalendar,
  parseUvxyCloseSeries,
  type SeasonalCalendarResult,
  type SeasonalCell,
} from '../utils/seasonal';

interface SelectedCell {
  monthName: string;
  cell: SeasonalCell;
}

const formatDate = (date: Date): string => date.toISOString().slice(0, 10);
const formatPct = (value: number): string => `${(value * 100).toFixed(2)}%`;

const buildCellStyle = (avgReturn: number | null, maxAbs: number): CSSProperties => {
  if (avgReturn === null || maxAbs <= 0) {
    return {
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
      borderColor: 'rgba(51, 65, 85, 0.7)',
      color: '#94a3b8',
    };
  }

  const ratio = Math.max(-1, Math.min(1, avgReturn / maxAbs));
  const intensity = Math.abs(ratio);
  const alpha = 0.16 + intensity * 0.42;

  if (ratio >= 0) {
    return {
      backgroundColor: `rgba(16, 185, 129, ${alpha})`,
      borderColor: `rgba(16, 185, 129, ${0.28 + intensity * 0.48})`,
      color: '#d1fae5',
    };
  }

  return {
    backgroundColor: `rgba(244, 63, 94, ${alpha})`,
    borderColor: `rgba(244, 63, 94, ${0.28 + intensity * 0.48})`,
    color: '#ffe4e6',
  };
};

export function SeasonalCalendar() {
  const [result, setResult] = useState<SeasonalCalendarResult | null>(null);
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const series = await parseUvxyCloseSeries('/data/UVXY_full_history.csv');
        const seasonal = buildSeasonalWeeklyCalendar(series, { lookbackYears: 14 });
        setResult(seasonal);

        const firstPopulated = seasonal.months
          .flatMap((month) => month.cells.map((cell) => ({ monthName: month.name, cell })))
          .find((entry) => entry.cell.sampleSize > 0);
        setSelected(firstPopulated ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to build seasonal calendar');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const chartData = useMemo(() => {
    if (!selected) return [];
    return selected.cell.yearlySeries.map((point) => ({
      year: point.year,
      avgReturnPct: point.avgReturn * 100,
      sampleSize: point.sampleSize,
    }));
  }, [selected]);

  if (loading) {
    return (
      <div className="flex justify-center p-12 text-slate-400">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return <div className="text-rose-500 p-6">Error loading seasonal data: {error}</div>;
  }

  if (!result) {
    return <div className="text-slate-400 p-6">No seasonal data available.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-indigo-400" />
              UVXY Seasonal Weekly Calendar
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Rolling 7-trading-day returns averaged by month/week bucket (Monday-start calendar weeks).
            </p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-400 font-mono space-y-1">
            <div>Window: {formatDate(result.windowStart)} → {formatDate(result.windowEnd)}</div>
            <div>Years Covered: {result.yearsCovered}</div>
            <div>Total 7D Observations: {result.totalObservations}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {result.months.map((month) => (
            <div key={month.month} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-3">
                {month.name}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {month.cells.map((cell) => {
                  const isSelected =
                    selected?.monthName === month.name && selected?.cell.weekOfMonth === cell.weekOfMonth;
                  const tooltipYears =
                    cell.yearlySeries.length > 0
                      ? `${cell.yearlySeries[0].year}-${cell.yearlySeries[cell.yearlySeries.length - 1].year}`
                      : 'n/a';
                  const title =
                    cell.sampleSize > 0 && cell.avgReturn !== null
                      ? `${month.name} W${cell.weekOfMonth}: ${formatPct(cell.avgReturn)} (${cell.sampleSize} obs, ${tooltipYears})`
                      : `${month.name} W${cell.weekOfMonth}: No samples`;

                  return (
                    <button
                      key={`${month.month}-${cell.weekOfMonth}`}
                      type="button"
                      title={title}
                      onClick={() => cell.sampleSize > 0 && setSelected({ monthName: month.name, cell })}
                      className={clsx(
                        'rounded-lg border px-2 py-2 text-left transition-all min-h-20',
                        isSelected
                          ? 'ring-2 ring-indigo-400/80 shadow-lg shadow-indigo-500/20'
                          : 'hover:ring-1 hover:ring-slate-600'
                      )}
                      style={buildCellStyle(cell.avgReturn, result.maxAbsAvgReturn)}
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-widest">W{cell.weekOfMonth}</div>
                      <div className="text-sm font-mono mt-1">
                        {cell.avgReturn === null ? 'N/A' : formatPct(cell.avgReturn)}
                      </div>
                      <div className="text-[11px] mt-1 opacity-90">{cell.sampleSize} obs</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-100">
              Drilldown: {selected.monthName} W{selected.cell.weekOfMonth}
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Year-by-year average 7-trading-day return for this bucket.
            </p>
          </div>

          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 20, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(value: number) => `${value.toFixed(1)}%`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                  itemStyle={{ color: '#e2e8f0' }}
                  formatter={(value: number | string | undefined) => [
                    `${Number(value ?? 0).toFixed(2)}%`,
                    'Avg 7D Return',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="avgReturnPct"
                  stroke="#818cf8"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#818cf8' }}
                  activeDot={{ r: 6, fill: '#a5b4fc' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
