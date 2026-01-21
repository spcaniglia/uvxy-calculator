import { useState, useEffect, useMemo } from 'react';
import { parseCSV, calculateProbabilities, getContextCategory } from './utils/analyze';
import type { PricePoint, ContextCategory } from './utils/analyze';
import { ProbabilityCard } from './components/ProbabilityCard';
import { PathCalculator } from './components/PathCalculator';
import { BarChart3, Info, TrendingDown, TrendingUp, History, Calendar, Calculator, GitCommit } from 'lucide-react';
import clsx from 'clsx';

function App() {
  const [activeTab, setActiveTab] = useState<'prob' | 'path'>('prob');
  const [ticker, setTicker] = useState<'UVXY' | 'VXX'>('UVXY');
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inputs
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [stopPrice, setStopPrice] = useState<number>(0);

  // Context Filter states
  const [useContext, setUseContext] = useState(false);
  const [lookbackDays, setLookbackDays] = useState(10);
  // const [useVxFutures] = useState(false); // Removed unused state
  
  // Allow user to override context (Multi-select)
  const [selectedContexts, setSelectedContexts] = useState<ContextCategory[]>([]);

  // Horizon Selection
  const availableHorizons = [5, 7, 10, 15, 20, 30, 45, 60, 90];
  const [selectedHorizons, setSelectedHorizons] = useState<number[]>([7, 15, 30, 45, 60]);

  const toggleHorizon = (days: number) => {
    setSelectedHorizons(prev => 
      prev.includes(days) 
        ? prev.filter(h => h !== days)
        : [...prev, days].sort((a, b) => a - b)
    );
  };

  const toggleContext = (ctx: ContextCategory) => {
    setSelectedContexts(prev => 
      prev.includes(ctx)
        ? prev.filter(c => c !== ctx)
        : [...prev, ctx]
    );
  };

  const contextCategories: ContextCategory[] = [
    "Major Spike (>25%)",
    "Minor Spike (10-25%)",
    "Steady Rise (5-10%)",
    "Consolidation (+/-5%)",
    "Steady Decline (-5 to -15%)",
    "Sharp Decline (<-15%)"
  ];

  // Load Data on Mount or Ticker Change
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const points = await parseCSV(`/data/${ticker}_full_history.csv`);
        setData(points);
        if (points.length > 0) {
          const lastPrice = Math.floor(points[points.length - 1].price);
          setCurrentPrice(lastPrice);
          setTargetPrice(lastPrice);
          setStopPrice(lastPrice + 3);
        }
      } catch (err) {
        setError(`Failed to load historical data for ${ticker}.`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [ticker]);

  // Determine Auto-Detected Context
  const detectedContext: ContextCategory | null = useMemo(() => {
    if (data.length < lookbackDays + 1) return null;
    const todayIndex = data.length - 1;
    const pastIndex = Math.max(0, todayIndex - lookbackDays);
    const todayPrice = data[todayIndex].price;
    const pastPrice = data[pastIndex].price;
    const change = (todayPrice - pastPrice) / pastPrice;
    return getContextCategory(change);
  }, [data, lookbackDays]);

  // Sync selected context with detected context when it changes
  useEffect(() => {
    if (detectedContext) {
      setSelectedContexts([detectedContext]);
    }
  }, [detectedContext]);

  // Calculate Results Grouped by Context
  const resultsGroups = useMemo(() => {
    if (data.length === 0 || currentPrice <= 0) return [];
    
    // If context filtering is OFF, show one group "All History"
    if (!useContext) {
      const rows = selectedHorizons.map(days => 
        calculateProbabilities(data, currentPrice, targetPrice, stopPrice, days, undefined)
      );
      return [{ title: "All Historical Data", rows }];
    }

    // If context filtering is ON, iterate through each active context
    // Default to detectedContext if selection is empty, or just empty if nothing detected
    const contextsToProcess = selectedContexts.length > 0 
      ? [...selectedContexts].sort((a, b) => contextCategories.indexOf(a) - contextCategories.indexOf(b))
      : (detectedContext ? [detectedContext] : []);

    if (contextsToProcess.length === 0) return [];

    return contextsToProcess.map(ctx => {
      const rows = selectedHorizons.map(days => 
        calculateProbabilities(data, currentPrice, targetPrice, stopPrice, days, {
          lookbackDays,
          allowedContexts: [ctx] // Filter strictly for this context
        })
      );
      return { title: ctx, rows };
    });

  }, [data, currentPrice, targetPrice, stopPrice, useContext, lookbackDays, selectedContexts, detectedContext, selectedHorizons]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono">Loading Market Data...</div>;
  if (error) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-rose-500 font-mono">{error}</div>;

  const targetPct = currentPrice > 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;
  const stopPct = currentPrice > 0 ? ((stopPrice - currentPrice) / currentPrice) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <BarChart3 className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
                <div className="relative">
                  <select 
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value as 'UVXY' | 'VXX')}
                    className="appearance-none bg-slate-800 border border-indigo-500/30 text-indigo-400 font-bold rounded-lg py-1 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer hover:bg-slate-700 transition-colors"
                  >
                    <option value="UVXY">UVXY</option>
                    <option value="VXX">VXX</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-indigo-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
                Strategy Analyst
              </h1>
              <p className="text-xs text-slate-500 font-mono mt-1">Historical Probability Calculator</p>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
             <button 
                onClick={() => setActiveTab('prob')}
                className={clsx(
                    "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                    activeTab === 'prob' ? "bg-indigo-500 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                )}
             >
                 <Calculator className="w-4 h-4" /> Probability
             </button>
             <button 
                onClick={() => setActiveTab('path')}
                className={clsx(
                    "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                    activeTab === 'path' ? "bg-indigo-500 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                )}
             >
                 <GitCommit className="w-4 h-4" /> Path Analysis
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'path' ? (
             <PathCalculator />
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
                  <div className="p-6 border-b border-slate-800">
                    <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">Parameters</h2>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Current Price</label>
                      <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                        <input 
                          type="number" 
                          value={currentPrice} 
                          onChange={(e) => setCurrentPrice(Number(e.target.value))}
                          className="w-full pl-8 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono text-lg"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-emerald-400/80 uppercase tracking-wider flex items-center gap-1">
                          <TrendingDown className="w-3 h-3" /> Target
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                          <input 
                            type="number" 
                            value={targetPrice} 
                            onChange={(e) => setTargetPrice(Number(e.target.value))}
                            className="w-full pl-8 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-transparent outline-none transition-all font-mono font-medium"
                          />
                        </div>
                        <div className="text-right text-xs font-mono text-emerald-500">{targetPct.toFixed(1)}%</div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-rose-400/80 uppercase tracking-wider flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Stop Loss
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                          <input 
                            type="number" 
                            value={stopPrice} 
                            onChange={(e) => setStopPrice(Number(e.target.value))}
                            className="w-full pl-8 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-rose-400 focus:ring-2 focus:ring-rose-500/50 focus:border-transparent outline-none transition-all font-mono font-medium"
                          />
                        </div>
                        <div className="text-right text-xs font-mono text-rose-500">+{stopPct.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
                  <div className="p-6 border-b border-slate-800">
                    <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-indigo-400" /> Time Horizons
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-3 gap-3">
                      {availableHorizons.map(days => (
                        <button 
                          key={days}
                          onClick={() => toggleHorizon(days)}
                          className={clsx(
                            "py-2 px-3 rounded-lg text-sm font-mono font-medium border transition-all",
                            selectedHorizons.includes(days) 
                            ? "bg-indigo-500 text-white border-indigo-400 shadow-md shadow-indigo-500/20"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-300"
                          )}
                        >
                          {days}d
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
                  <div className="p-6 border-b border-slate-800">
                    <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">Historical Context</h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-800 bg-slate-900 cursor-pointer group transition-colors hover:border-indigo-500/50">
                      <input 
                        type="checkbox" 
                        checked={useContext}
                        onChange={(e) => setUseContext(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-offset-slate-900"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-300 font-medium">Past Price Context</span>
                        <span className="text-xs text-slate-500">Filter by previous market trend</span>
                      </div>
                    </label>
                    <div className={clsx("space-y-4 transition-all duration-300", !useContext && "opacity-40 pointer-events-none blur-[1px]")}>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <History className="w-3 h-3" /> Lookback Period
                          </label>
                          <span className="text-[10px] font-mono text-indigo-400">{lookbackDays} Days</span>
                        </div>
                        <input 
                          type="range" min="1" max="30" value={lookbackDays}
                          onChange={(e) => setLookbackDays(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Market Condition</label>
                        <div className="grid grid-cols-2 gap-2">
                          {contextCategories.map(cat => (
                            <button
                              key={cat}
                              onClick={() => toggleContext(cat)}
                              className={clsx(
                                "py-2 px-2 rounded-lg text-[10px] font-mono font-medium border transition-all text-center leading-tight",
                                selectedContexts.includes(cat)
                                  ? "bg-indigo-500 text-white border-indigo-400 shadow-md shadow-indigo-500/20"
                                  : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-300"
                              )}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                        {detectedContext && (
                          <div className="flex justify-between items-center px-1 mt-2">
                            <span className="text-[10px] text-slate-500">Auto-Detected: <span className="text-slate-400 font-mono">{detectedContext}</span></span>
                            <button onClick={() => setSelectedContexts([detectedContext])} className="text-[10px] text-indigo-400 hover:text-indigo-300 underline">Reset to Auto</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-500/5 rounded-xl p-4 border border-indigo-500/10 flex gap-3">
                  <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-indigo-200/80 leading-relaxed">
                    Analysis based on <span className="font-mono text-indigo-300 font-semibold">{data.length}</span> historical trading days since 2011. 
                    {useContext ? ` Filtering for days matching selected contexts.` : " Probabilities reflect the full historical dataset."}
                  </p>
                </div>
              </div>

              <div className="lg:col-span-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-100">Historical Probability</h2>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20 whitespace-nowrap">Under Target</span>
                    <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-medium border border-rose-500/20 whitespace-nowrap">Above Stop</span>
                  </div>
                </div>
                
                <div className="flex flex-col gap-8">
                  {resultsGroups.map((group, index) => (
                    <div key={index} className="space-y-3">
                      {useContext && (
                        <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest px-1 border-b border-indigo-500/20 pb-2">
                          {group.title}
                        </h3>
                      )}
                      <div className="flex flex-col gap-4">
                        {group.rows.map((result) => (
                          <ProbabilityCard key={result.horizon} result={result} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
        )}
      </main>
    </div>
  );
}

export default App;