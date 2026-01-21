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

export const PathCalculator: React.FC = () => {
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [days, setDays] = useState<DayData[]>([{ id: 1, open: '', high: '', low: '', close: '' }]);
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [tolerance, setTolerance] = useState<number>(0.5); // 0.5 = 50% relative tolerance (loose)
    // const [loading, setLoading] = useState(true);

    // Load History Data
    useEffect(() => {
        fetch('/data/uvxy_history.json')
            .then(res => res.json())
            .then(data => {
                setHistory(data);
                // setLoading(false);
            })
            .catch(err => console.error("Failed to load history", err));
    }, []);

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
        for (let i = 0; i < history.length - validDays.length; i++) {
            let isMatch = true;
            let totalDiff = 0;

            for (let j = 0; j < validDays.length; j++) {
                const dayInput = inputMetrics[j];
                const dayHist = history[i + j];

                // 1. Match Intraday Move (Body)
                // Use absolute difference for small numbers, relative for large?
                // Simple difference in percentage points
                const diffIntraday = Math.abs(dayInput.intraday_pct - dayHist.intraday_pct);
                
                // 2. Match Range (Volatility)
                const diffRange = Math.abs(dayInput.range_pct - dayHist.range_pct);

                // 3. Match Gap (only if j > 0)
                let diffGap = 0;
                if (j > 0) {
                    diffGap = Math.abs(dayInput.gap_pct - dayHist.gap_pct);
                }

                // Thresholds (Hardcoded "Loose" logic for now, refined by tolerance)
                // Tolerance acts as a multiplier. 1.0 = Default Loose, 0.5 = Tight
                const t = 5 * (1 + tolerance); 

                if (diffIntraday > t || diffRange > t || diffGap > t) {
                    isMatch = false;
                    break;
                }
                
                totalDiff += diffIntraday + diffRange + diffGap;
            }

            if (isMatch) {
                // Determine the "Next Day" and future path (3 days)
                const lastDayIndex = i + validDays.length - 1;
                const nextDayIndex = lastDayIndex + 1;
                
                const nextDay = nextDayIndex < history.length ? history[nextDayIndex] : null;
                const futurePath = history.slice(nextDayIndex, nextDayIndex + 5); // Next 5 days

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

    }, [days, history, tolerance]);

    const addDay = () => {
        setDays([...days, { id: Date.now(), open: '', high: '', low: '', close: '' }]);
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
    const nextDayStats = matches.reduce((acc, m) => {
        if (!m.nextDay) return acc;
        if (m.nextDay.close_to_close_pct > 0) acc.green++;
        else acc.red++;
        acc.returns.push(m.nextDay.close_to_close_pct);
        return acc;
    }, { green: 0, red: 0, returns: [] as number[] });

    const avgReturn = nextDayStats.returns.length 
        ? (nextDayStats.returns.reduce((a, b) => a + b, 0) / nextDayStats.returns.length).toFixed(2)
        : '0.00';
    
    const winRate = matches.length > 0 
        ? ((nextDayStats.green / matches.length) * 100).toFixed(1)
        : '0.0';

    return (
        <div className="w-full max-w-6xl mx-auto p-4 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-100">Path Probability Calculator</h2>
                    <p className="text-slate-400 text-sm">Input daily OHLC to find historical matches.</p>
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
                            {/* Summary Card */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
                                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Matches Found</div>
                                    <div className="text-3xl font-mono text-white">{matches.length}</div>
                                </div>
                                <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
                                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Next Day Green</div>
                                    <div className={clsx("text-3xl font-mono", parseFloat(winRate) > 50 ? "text-emerald-400" : "text-slate-400")}>
                                        {winRate}%
                                    </div>
                                </div>
                                <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
                                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Avg Return</div>
                                    <div className={clsx("text-3xl font-mono", parseFloat(avgReturn) > 0 ? "text-emerald-400" : "text-rose-400")}>
                                        {parseFloat(avgReturn) > 0 ? '+' : ''}{avgReturn}%
                                    </div>
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
                                                    {match.futurePath.map((day, dIdx) => (
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
