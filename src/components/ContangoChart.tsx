import { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import {
  LineChart,
  Line,
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
}

export function ContangoChart() {
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
        const response = await fetch('/data/vix_term_structure.csv');
        if (!response.ok) throw new Error('Failed to fetch data');
        const csvText = await response.text();

        Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            const parsed = results.data
              .map((row: any) => {
                if (!row.Date || !row.VX1 || !row.VX2) return null;
                const d = new Date(row.Date);
                // Adjust for timezone if needed, but simple date parsing usually works for YYYY-MM-DD
                // We want to avoid "one day off" errors due to UTC conversion.
                // Creating date from "YYYY-MM-DD" usually treats it as UTC.
                // We'll stick to string for display or use UTC methods.
                
                return {
                  date: d,
                  dateStr: row.Date,
                  vx1: row.VX1,
                  vx2: row.VX2,
                  contango: (row.VX2 - row.VX1) / row.VX1
                };
              })
              .filter((item): item is TermStructureData => item !== null)
              .sort((a, b) => a.date.getTime() - b.date.getTime());

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
  }, []);

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

        <div className="h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
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
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                itemStyle={{ color: '#e2e8f0' }}
                formatter={(value: any) => [`${(Number(value) * 100).toFixed(2)}%`, 'Contango']}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Backwardation', fill: '#ef4444', fontSize: 12 }} />
              <Line 
                type="monotone" 
                dataKey="contango" 
                stroke="#6366f1" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, fill: '#818cf8' }}
                name="Contango %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-sm text-slate-400">
            <p>
                <strong>Contango:</strong> When the futures price (VX2) is higher than the spot/front-month price (VX1), implying the market expects volatility to rise or revert to mean. Positive values (above red line) indicate Contango.
            </p>
            <p className="mt-2">
                <strong>Backwardation:</strong> When VX1 is higher than VX2, usually during high stress or market crashes. Negative values (below red line) indicate Backwardation.
            </p>
        </div>
      </div>
    </div>
  );
}
