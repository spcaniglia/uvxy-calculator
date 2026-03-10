import { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import {
  ComposedChart,
  Line,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Calendar, Loader2 } from 'lucide-react';

interface TermStructureData {
  date: Date;
  dateStr: string; // for display
  vx1: number;
  vx2: number;
  contango: number; // (VX2 - VX1) / VX1
  assetChange?: number; // Daily change %
  fullHeight: number; // Constant for background bar
}

interface ContangoChartProps {
  ticker: 'UVXY' | 'VXX';
}

export function ContangoChart({ ticker }: ContangoChartProps) {
  const [data, setData] = useState<TermStructureData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default range: Last 1 year
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch both files in parallel
        const [vixResponse, priceResponse] = await Promise.all([
            fetch('/data/vix_term_structure.csv'),
            fetch(`/data/${ticker}_full_history.csv`)
        ]);

        if (!vixResponse.ok) throw new Error('Failed to fetch VIX data');
        if (!priceResponse.ok) throw new Error(`Failed to fetch ${ticker} data`);
        
        const vixText = await vixResponse.text();
        const priceText = await priceResponse.text();

        // Parse instrument price data first to build a lookup map
        const priceMap = new Map<string, number>(); // dateStr -> closePrice
        
        Papa.parse(priceText, {
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data as string[][];
                let closeIndex = 4;
                for (let r = 0; r < Math.min(5, rows.length); r++) {
                    for (let c = 0; c < rows[r].length; c++) {
                        if ((rows[r][c] ?? '').trim().toLowerCase() === 'close') {
                            closeIndex = c;
                            break;
                        }
                    }
                }

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (row.length <= closeIndex) continue;
                    const dateStr = (row[0] ?? '').trim();
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
                    const closePrice = parseFloat(row[closeIndex]);
                    
                    if (dateStr && !isNaN(closePrice)) {
                        priceMap.set(dateStr, closePrice);
                    }
                }
            }
        });

            // Parse VIX Data
            Papa.parse(vixText, {
              header: true,
              dynamicTyping: true,
              skipEmptyLines: true,
              complete: (results) => {
                const rawData = results.data
                  .map((row: any) => {
                    if (!row.Date || !row.VX1 || !row.VX2) return null;
                    const d = new Date(row.Date);
                    const dateStr = row.Date;
                    
                    const assetPrice = priceMap.get(dateStr);
    
                    return {
                      date: d,
                      dateStr: dateStr,
                      vx1: row.VX1,
                      vx2: row.VX2,
                      contango: (row.VX2 - row.VX1) / row.VX1,
                      assetPrice: assetPrice,
                      fullHeight: 1
                    } as TermStructureData & { assetPrice?: number };
                  });
    
                // Filter nulls
                const parsed = rawData.filter((item): item is TermStructureData & { assetPrice?: number } => item !== null)
                                      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
                // Calculate daily change for selected instrument
                for (let i = 1; i < parsed.length; i++) {
                    const current = parsed[i];
                    const prev = parsed[i-1];
                    
                    if (current.assetPrice !== undefined && prev.assetPrice !== undefined) {
                        current.assetChange = (current.assetPrice - prev.assetPrice) / prev.assetPrice;
                    }
                }
    
                setData(parsed);
                
                if (parsed.length > 0) {
                  // Set default range to last 1 year
                  const last = parsed[parsed.length - 1].date;
                  const oneYearAgo = new Date(last);
                  oneYearAgo.setFullYear(last.getFullYear() - 1);
                  
                  setStartDate(oneYearAgo.toISOString().split('T')[0]);
                  setEndDate(last.toISOString().split('T')[0]);
                }
                setLoading(false);
              },
              error: (err: Error) => {
                setError(err.message);
                setLoading(false);
              }
            });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    fetchData();
  }, [ticker]);

  const filteredData = useMemo(() => {
    if (!startDate || !endDate) return data;
    const start = new Date(startDate);
    const end = new Date(endDate);
    // Include end date fully
    end.setHours(23, 59, 59, 999);

    return data.filter(d => d.date >= start && d.date <= end);
  }, [data, startDate, endDate]);

  // Calculate ticks for Y Axis (every 1%)
  const yTicks = useMemo(() => {
    if (filteredData.length === 0) return [];
    const min = Math.min(...filteredData.map(d => d.contango));
    const max = Math.max(...filteredData.map(d => d.contango));
    
    const ticks = [];
    // Start from nearest whole percent below min
    let current = Math.floor(min * 100) / 100;
    const end = Math.ceil(max * 100) / 100;
    
    while (current <= end + 0.005) {
      ticks.push(current);
      current += 0.01;
    }
    return ticks;
  }, [filteredData]);

  if (loading) return <div className="flex justify-center p-12 text-slate-400"><Loader2 className="animate-spin w-8 h-8" /></div>;
  if (error) return <div className="text-rose-500 p-6">Error loading data: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
             VIX Term Structure (VX1 vs VX2)
          </h2>
          
          <div className="flex items-center gap-3 bg-slate-950 p-2 rounded-lg border border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-sm text-slate-200 focus:outline-none w-32"
              />
            </div>
            <span className="text-slate-600">-</span>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-sm text-slate-200 focus:outline-none w-32"
              />
            </div>
          </div>
        </div>

        <div className="h-[500px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} barGap={0} barCategoryGap={0}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
              <XAxis 
                dataKey="dateStr" 
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                minTickGap={50}
              />
              <YAxis 
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                domain={['auto', 'auto']}
                ticks={yTicks}
              />
              {/* Secondary YAxis for Background Bars (Hidden) */}
              <YAxis 
                yAxisId="bg"
                hide
                domain={[0, 1]}
              />

              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                itemStyle={{ color: '#e2e8f0' }}
                formatter={(value: any, name: any) => {
                    if (name === "Background") return [null, null]; // Hide background from tooltip
                    return [`${(Number(value) * 100).toFixed(2)}%`, 'Contango'];
                }}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
              
              {/* Background Bars */}
              <Bar dataKey="fullHeight" yAxisId="bg" isAnimationActive={false} name="Background" legendType="none">
                {filteredData.map((entry, index) => {
                    // Determine color based on selected instrument's daily change
                    let color = 'transparent';
                    let opacity = 0.1;
                    if (entry.assetChange !== undefined) {
                        if (entry.assetChange > 0) {
                            color = '#10b981'; // Emerald 500
                            opacity = 0.2; // More opaque for green
                        }
                        else if (entry.assetChange < 0) {
                            color = '#f43f5e'; // Rose 500
                            opacity = 0.1;
                        }
                    }
                    return <Cell key={`cell-${index}`} fill={color} fillOpacity={opacity} stroke="none" />;
                })}
              </Bar>

              <Line 
                type="monotone" 
                dataKey="contango" 
                stroke="#6366f1" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, fill: '#818cf8' }}
                name="Contango %"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-400 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <h4 className="font-semibold text-slate-200 mb-1">Chart Legend</h4>
                <ul className="space-y-1 text-xs">
                    <li className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-indigo-500 rounded-full"></span>
                        <span><strong>Blue Line (Contango):</strong> Expected volatility premium (VX2 vs VX1). Positive = Normal/Contango.</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="w-3 h-3 border border-dashed border-red-500"></span>
                        <span><strong>Red Dashed Line (0%):</strong> Threshold for Backwardation (Market Stress).</span>
                    </li>
                </ul>
            </div>
            <div>
                 <h4 className="font-semibold text-slate-200 mb-1">Background Shading</h4>
                 <ul className="space-y-1 text-xs">
                    <li className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-emerald-500/20 border border-emerald-500/50"></span>
                        <span><strong>Green Sliver:</strong> {ticker} closed <span className="text-emerald-400">HIGHER</span> than previous day.</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-rose-500/20 border border-rose-500/50"></span>
                        <span><strong>Red Sliver:</strong> {ticker} closed <span className="text-rose-400">LOWER</span> than previous day.</span>
                    </li>
                 </ul>
            </div>
        </div>
      </div>
    </div>
  );
}
