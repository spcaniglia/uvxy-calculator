import { useState, useEffect, useMemo } from 'react';
import { parseCSV, calculateProbabilities, getContextCategory } from './utils/analyze';
import type { PricePoint, AnalysisResult, ContextCategory } from './utils/analyze';
import { ProbabilityCard } from './components/ProbabilityCard';
import { Settings, BarChart3, Info, TrendingDown, TrendingUp, History } from 'lucide-react';
import clsx from 'clsx';

function App() {
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
  const [useVxFutures] = useState(false);
  
  // New: Allow user to override context
  const [selectedContext, setSelectedContext] = useState<ContextCategory | null>(null);

  // Constants
  const horizons = [7, 15, 30, 45, 60];
  const contextCategories: ContextCategory[] = [
    "Major Spike (>25%)",
    "Minor Spike (10-25%)",
    "Steady Rise (5-10%)",
    "Consolidation (+/-5%)",
    "Steady Decline (-5 to -15%)",
    "Sharp Decline (<-15%)"
  ];

  // Load Data on Mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const points = await parseCSV('/data/UVXY_full_history.csv');
        setData(points);
        if (points.length > 0) {
          setCurrentPrice(36);
          setTargetPrice(36);
          setStopPrice(39);
        }
      } catch (err) {
        setError('Failed to load historical data.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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

  // Sync selected context with detected context when it changes (only if user hasn't manually selected one yet, or we want to auto-update)
  // For simplicity: We'll initialize selectedContext with detectedContext when data loads or lookback changes, 
  // BUT only if the user hasn't explicitly chosen something else? 
  // Easier approach: Just let the Select default to "detectedContext" if selectedContext is null.
  // Actually, better UX: When lookback changes, auto-update the selection to match the new reality.
  useEffect(() => {
    if (detectedContext) {
      setSelectedContext(detectedContext);
    }
  }, [detectedContext]);

  // Calculate Results
  const results: AnalysisResult[] = useMemo(() => {
    if (data.length === 0 || currentPrice <= 0) return [];
    
    // Use selectedContext if available, otherwise detected
    const activeContext = selectedContext || detectedContext;

    const filterConfig = useContext && activeContext ? {
      lookbackDays,
      currentContextCategory: activeContext
    } : undefined;

    return horizons.map(days => 
      calculateProbabilities(data, currentPrice, targetPrice, stopPrice, days, filterConfig)
    );
  }, [data, currentPrice, targetPrice, stopPrice, useContext, lookbackDays, selectedContext, detectedContext]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono">Loading Market Data...</div>;
  if (error) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-rose-500 font-mono">{error}</div>;

  const targetPct = currentPrice > 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;
  const stopPct = currentPrice > 0 ? ((stopPrice - currentPrice) / currentPrice) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <BarChart3 className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">UVXY Strategy <span className="text-indigo-400">Analyst</span></h1>
              <p className="text-xs text-slate-500 font-mono">Historical Probability Calculator</p>
            </div>
          </div>
          <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-full transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Controls */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  Parameters
                </h2>
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
                    <div className="text-right text-xs font-mono text-emerald-500">
                      {targetPct.toFixed(1)}%
                    </div>
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
                     <div className="text-right text-xs font-mono text-rose-500">
                      +{stopPct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/50 p-6 border-t border-slate-800 space-y-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Historical Context</h3>
                
                <div className="space-y-4">
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
                    
                    {/* Lookback Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                          <History className="w-3 h-3" /> Lookback Period
                        </label>
                        <span className="text-[10px] font-mono text-indigo-400">{lookbackDays} Days</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="30" 
                        value={lookbackDays}
                        onChange={(e) => setLookbackDays(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>

                    {/* Context Selector */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Market Condition</label>
                      <select
                        value={selectedContext || ''}
                        onChange={(e) => setSelectedContext(e.target.value as ContextCategory)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none"
                      >
                         <option value="" disabled>Select Context</option>
                         {contextCategories.map(cat => (
                           <option key={cat} value={cat}>{cat}</option>
                         ))}
                      </select>
                      {detectedContext && detectedContext !== selectedContext && (
                        <div className="flex justify-between items-center px-1">
                          <span className="text-[10px] text-slate-500">Auto-Detected: <span className="text-slate-400">{detectedContext}</span></span>
                          <button 
                            onClick={() => setSelectedContext(detectedContext)}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 underline"
                          >
                            Reset
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-800/50 bg-slate-900/50 cursor-not-allowed opacity-30 group">
                    <input 
                      type="checkbox" 
                      checked={useVxFutures}
                      disabled
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-offset-slate-900"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-300 font-medium">Term Structure</span>
                      <span className="text-xs text-slate-500">Include /VX1 & /VX2 premium</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-indigo-500/5 rounded-xl p-4 border border-indigo-500/10 flex gap-3">
              <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-indigo-200/80 leading-relaxed">
                Analysis based on <span className="font-mono text-indigo-300 font-semibold">{data.length}</span> historical trading days since 2011. 
                {useContext ? ` Filtering for days matching "${selectedContext || detectedContext}".` : " Probabilities reflect the full historical dataset."}
              </p>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-100">Historical Probability</h2>
              <div className="flex gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20 whitespace-nowrap">Under Target</span>
                <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-medium border border-rose-500/20 whitespace-nowrap">Above Stop</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
              {results.map((result) => (
                <ProbabilityCard key={result.horizon} result={result} />
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;