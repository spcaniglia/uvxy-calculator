import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Calendar } from 'lucide-react';
import clsx from 'clsx';

interface DayData {
    id: number;
    open: string;
    high: string;
    low: string;
    close: string;
}

interface HistoryRecord {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    gap_pct: number;
    intraday_pct: number;
    range_pct: number;
    upper_wick_pct: number;
    lower_wick_pct: number;
    close_to_close_pct: number;
}

interface MatchResult {
    date: string;
    similarity: number;
    nextDay: HistoryRecord | null;
    futurePath: HistoryRecord[];
}

interface PathCalculatorProps {
    ticker: 'UVXY' | 'VXX';
}

export const PathCalculator: React.FC<PathCalculatorProps> = ({ ticker }) => {
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [days, setDays] = useState<DayData[]>([]);
    const [historyOffset, setHistoryOffset] = useState<number>(0);
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [tolerance, setTolerance] = useState<number>(0.5); // 0.5 = 50% relative tolerance (loose)
    // const [loading, setLoading] = useState(true);

    // Load History Data
    useEffect(() => {
        setHistory([]);
        setDays([]);
        setMatches([]);
        setHistoryOffset(0);

        const tickerKey = ticker.toLowerCase();
        fetch(`/data/${tickerKey}_history.json`)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                return res.json();
            })
            .then((data: HistoryRecord[]) => {
                setHistory(data);
                // Autopopulate with the most recent day
                if (data.length > 0) {
                    const last = data[data.length - 1];
                    setDays([
                        {
                            id: Date.now(),
                            open: last.open.toString(),
                            high: last.high.toString(),
                            low: last.low.toString(),
                            close: last.close.toString()
                        }
                    ]);
                    setHistoryOffset(1);
                }
            })
            .catch(err => console.error(`Failed to load ${ticker} history`, err));
    }, [ticker]);

    // Calculate Matches whenever inputs change
    useEffect(() => {
        if (history.length === 0) return;

        const validDays = days.filter(d => d.open && d.high && d.low && d.close);
        if (validDays.length === 0) {
            setMatches([]);
            return;
        }

        const inputMetrics = validDays.map((d, i) => {
            const open = parseFloat(d.open);
            const high = parseFloat(d.high);
            const low = parseFloat(d.low);
            const close = parseFloat(d.close);
            
            // Calculate basic shape metrics
            const intraday_pct = ((close - open) / open) * 100;
            const range_pct = ((high - low) / open) * 100;
            
            // Calculate Gap (only if not Day 1)
            let gap_pct = 0;
            if (i > 0) {
                const prevClose = parseFloat(validDays[i-1].close);
                gap_pct = ((open - prevClose) / prevClose) * 100;
            }

            return { intraday_pct, range_pct, gap_pct };
        });

        const foundMatches: MatchResult[] = [];

        // Scan history
        // We need enough future data (at least 1 day after the sequence)
        // AND we must ensure we don't match the actual recent days we are using as input
        // to avoid "matching against ourselves" and showing 100% win rates.
        const excludeBuffer = historyOffset + 5; 
        
        for (let i = 0; i < history.length - validDays.length - excludeBuffer; i++) {
            let isMatch = true;
            let totalDiff = 0;

            for (let j = 0; j < validDays.length; j++) {
                const dayInput = inputMetrics[j];
                const dayHist = history[i + j];

                // 1. Match Intraday Move (Body)
                const diffIntraday = Math.abs(dayInput.intraday_pct - dayHist.intraday_pct);
                
                // 2. Match Range (Volatility)
                const diffRange = Math.abs(dayInput.range_pct - dayHist.range_pct);

                // 3. Match Gap (only if j > 0)
                let diffGap = 0;
                if (j > 0) {
                    diffGap = Math.abs(dayInput.gap_pct - dayHist.gap_pct);
                }

                // Thresholds
                const t = 5 * (1 + tolerance); 

                if (diffIntraday > t || diffRange > t || diffGap > t) {
                    isMatch = false;
                    break;
                }
                
                totalDiff += diffIntraday + diffRange + diffGap;
            }

            if (isMatch) {
                // Determine the "Next Day" and future path
                const lastDayIndex = i + validDays.length - 1;
                const nextDayIndex = lastDayIndex + 1;
                
                const nextDay = nextDayIndex < history.length ? history[nextDayIndex] : null;
                const futurePath = history.slice(nextDayIndex, nextDayIndex + 31); // Next 31 days

                foundMatches.push({
                    date: history[i + validDays.length - 1].date, // The date of the LAST day in sequence
                    similarity: totalDiff,
                    nextDay,
                    futurePath
                });
            }
        }

        // Sort by best match (lowest difference)
        foundMatches.sort((a, b) => a.similarity - b.similarity);
        setMatches(foundMatches);

    }, [days, history, tolerance, historyOffset]);

    const addDay = () => {
        if (history.length > historyOffset) {
            const prevRecord = history[history.length - 1 - historyOffset];
            const newDay = {
                id: Date.now(),
                open: prevRecord.open.toString(),
                high: prevRecord.high.toString(),
                low: prevRecord.low.toString(),
                close: prevRecord.close.toString()
            };
            // Prepend to shift existing days down
            setDays([newDay, ...days]);
            setHistoryOffset(historyOffset + 1);
        } else {
            // Fallback if no more history
            setDays([{ id: Date.now(), open: '', high: '', low: '', close: '' }, ...days]);
        }
    };

    const removeDay = (index: number) => {
        const newDays = [...days];
        newDays.splice(index, 1);
        setDays(newDays);
    };

    const updateDay = (index: number, field: keyof DayData, value: string) => {
        const newDays = [...days];
        newDays[index] = { ...newDays[index], [field]: value };
        setDays(newDays);
    };

    // --- Statistics Logic ---
    const getStatsForHorizon = (horizon: number) => {
        const validMatches = matches.filter(m => m.futurePath.length >= horizon);
        if (validMatches.length === 0) return { greenRate: '0.0', avgReturn: '0.00', count: 0 };

        let greenCount = 0;
        let totalReturn = 0;

        validMatches.forEach(m => {
            const lastDayClose = m.futurePath[0].open / (1 + m.futurePath[0].gap_pct/100);
            const targetDayClose = m.futurePath[horizon - 1].close;
            const returnPct = ((targetDayClose - lastDayClose) / lastDayClose) * 100;

            if (returnPct > 0) greenCount++;
            totalReturn += returnPct;
        });

        return {
            greenRate: ((greenCount / validMatches.length) * 100).toFixed(1),
            avgReturn: (totalReturn / validMatches.length).toFixed(2),
            count: validMatches.length
        };
    };

    const stats1d = getStatsForHorizon(1);
    const stats7d = getStatsForHorizon(7);
    const stats14d = getStatsForHorizon(14);
    const stats30d = getStatsForHorizon(30);

    return (
        <div className="w-full max-w-6xl mx-auto p-4 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-100">{ticker} Path Probability Calculator</h2>
                    <p className="text-slate-400 text-sm">Input daily OHLC to find historical {ticker} matches.</p>
                </div>
                
                 {/* Tolerance Slider */}
                 <div className="flex items-center gap-4 bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs font-mono text-slate-400 uppercase">Match Tolerance</span>
                    <input 
                        type="range" 
                        min="0" 
                        max="2" 
                        step="0.1" 
                        value={tolerance}
                        onChange={(e) => setTolerance(parseFloat(e.target.value))}
                        className="w-32 accent-indigo-500 cursor-pointer"
                    />
                    <span className="text-xs font-mono text-indigo-400">{tolerance > 1 ? 'Loose' : tolerance < 0.5 ? 'Strict' : 'Normal'}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* LEFT COLUMN: Inputs */}
                <div className="lg:col-span-4 space-y-4">
                    {days.map((day, idx) => (
                        <div key={day.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3 relative group">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-indigo-400">Day {idx + 1}</span>
                                {idx > 0 && (
                                    <button onClick={() => removeDay(idx)} className="text-slate-600 hover:text-rose-500 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Open</label>
                                    <input 
                                        type="number" 
                                        value={day.open}
                                        onChange={(e) => updateDay(idx, 'open', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Close</label>
                                    <input 
                                        type="number" 
                                        value={day.close}
                                        onChange={(e) => updateDay(idx, 'close', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">High</label>
                                    <input 
                                        type="number" 
                                        value={day.high}
                                        onChange={(e) => updateDay(idx, 'high', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Low</label>
                                    <input 
                                        type="number" 
                                        value={day.low}
                                        onChange={(e) => updateDay(idx, 'low', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            
                            {/* Live Calc Feedback */}
                            {day.open && day.close && (
                                <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full hidden lg:block pl-4">
                                     <span className={clsx(
                                         "text-xs font-mono px-2 py-1 rounded",
                                         parseFloat(day.close) > parseFloat(day.open) ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                     )}>
                                         {(((parseFloat(day.close) - parseFloat(day.open)) / parseFloat(day.open)) * 100).toFixed(2)}%
                                     </span>
                                </div>
                            )}
                        </div>
                    ))}

                    <button 
                        onClick={addDay}
                        className="w-full py-3 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:border-indigo-500 hover:text-indigo-400 hover:bg-slate-900/50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" /> Add Next Day
                    </button>
                </div>

                {/* RIGHT COLUMN: Results */}
                <div className="lg:col-span-8 space-y-6">
                    {matches.length === 0 ? (
                         <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 min-h-[300px] border border-slate-800 rounded-2xl bg-slate-900/20">
                            <Search className="w-12 h-12 opacity-20" />
                            <p>Enter price data to find matches...</p>
                         </div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
                                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Matches Found</div>
                                        <div className="text-3xl font-mono text-white">{matches.length}</div>
                                    </div>
                                    <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
                                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Next Day Green</div>
                                        <div className={clsx("text-3xl font-mono", parseFloat(stats1d.greenRate) > 50 ? "text-emerald-400" : "text-slate-400")}>
                                            {stats1d.greenRate}%
                                        </div>
                                    </div>
                                    <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
                                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Next Day Avg</div>
                                        <div className={clsx("text-3xl font-mono", parseFloat(stats1d.avgReturn) > 0 ? "text-emerald-400" : "text-rose-400")}>
                                            {parseFloat(stats1d.avgReturn) > 0 ? '+' : ''}{stats1d.avgReturn}%
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[
                                        { label: '7 Days Out', stats: stats7d },
                                        { label: '14 Days Out', stats: stats14d },
                                        { label: '30 Days Out', stats: stats30d }
                                    ].map((item, i) => (
                                        <div key={i} className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
                                            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">{item.label}</div>
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <div className="text-xs text-slate-400 mb-0.5">Green %</div>
                                                    <div className={clsx("text-xl font-mono", parseFloat(item.stats.greenRate) > 50 ? "text-emerald-400" : "text-slate-300")}>
                                                        {item.stats.greenRate}%
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-slate-400 mb-0.5">Avg Ret</div>
                                                    <div className={clsx("text-xl font-mono", parseFloat(item.stats.avgReturn) > 0 ? "text-emerald-400" : "text-rose-400")}>
                                                        {parseFloat(item.stats.avgReturn) > 0 ? '+' : ''}{item.stats.avgReturn}%
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Detailed List or Dates */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                                    {matches.length <= 15 ? "Exact Historical Paths" : "Recent Matches (Top 15)"}
                                </h3>
                                
                                <div className="space-y-3">
                                    {matches.slice(0, 15).map((match, idx) => (
                                        <div key={idx} className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-indigo-500/30 transition-colors">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                
                                                {/* Date & Similarity */}
                                                <div className="flex items-center gap-3 min-w-[150px]">
                                                    <Calendar className="w-4 h-4 text-slate-500" />
                                                    <span className="font-mono text-indigo-300">{match.date}</span>
                                                </div>

                                                {/* The "Future" Path visualization */}
                                                <div className="flex-1 flex items-center gap-1 overflow-x-auto pb-2 md:pb-0">
                                                    {match.futurePath.slice(0, 7).map((day, dIdx) => (
                                                        <div key={dIdx} className="flex flex-col items-center min-w-[60px]">
                                                            <div className={clsx(
                                                                "h-12 w-2 rounded-full relative",
                                                                day.close_to_close_pct > 0 ? "bg-emerald-900/30" : "bg-rose-900/30"
                                                            )}>
                                                                {/* Candle Body representation (simplified) */}
                                                                <div 
                                                                    className={clsx(
                                                                        "absolute w-full rounded-full left-0",
                                                                        day.close_to_close_pct > 0 ? "bg-emerald-500 bottom-0" : "bg-rose-500 top-0"
                                                                    )}
                                                                    style={{ height: `${Math.min(Math.abs(day.close_to_close_pct) * 5, 100)}%` }} // Scale height visually
                                                                />
                                                            </div>
                                                            <span className={clsx(
                                                                "text-[10px] font-mono mt-1",
                                                                day.close_to_close_pct > 0 ? "text-emerald-400" : "text-rose-400"
                                                            )}>
                                                                {day.close_to_close_pct > 0 ? '+' : ''}{day.close_to_close_pct.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    ))}
                                                    <div className="text-slate-600 text-[10px] font-mono pl-2">...</div>
                                                </div>

                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {matches.length > 15 && (
                                    <div className="text-center text-slate-500 text-sm italic py-4">
                                        ...and {matches.length - 15} more similar days found.
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
