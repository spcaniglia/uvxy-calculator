import React from 'react';
import type { AnalysisResult } from '../utils/analyze';
import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface ProbabilityCardProps {
  result: AnalysisResult;
}

export const ProbabilityCard: React.FC<ProbabilityCardProps> = ({ result }) => {
  const winPercentage = (result.winRate * 100).toFixed(1);
  const lossPercentage = (result.lossRate * 100).toFixed(1);
  
  // Logic for risk assessment
  const isHighRisk = result.lossRate > 0.25; 
  const isHighProb = result.winRate > 0.65;

  return (
    <div className={clsx(
      "relative overflow-hidden rounded-2xl p-6 border transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1",
      isHighProb ? "bg-slate-900 border-indigo-500/30" : "bg-slate-900 border-slate-800"
    )}>
      {/* Background decoration */}
      {isHighProb && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      )}

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <h3 className="text-xl font-bold text-slate-100">{result.horizon} Days</h3>
             {isHighProb && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500 text-white uppercase tracking-wider">Top Pick</span>}
          </div>
          <span className="text-xs text-slate-500 font-mono">Sample Size: N={result.sampleSize}</span>
        </div>
        
        {isHighRisk && (
          <div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 px-2 py-1 rounded text-xs font-medium border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />
            <span>High Risk</span>
          </div>
        )}
      </div>
      
      <div className="space-y-5">
        {/* Win Stat */}
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-400" /> Under Target
            </span>
            <span className={clsx("text-2xl font-bold font-mono", result.winRate > 0.5 ? "text-emerald-400" : "text-slate-200")}>
              {winPercentage}%
            </span>
          </div>
          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full" 
              style={{ width: `${winPercentage}%` }} 
            />
          </div>
        </div>

        {/* Loss Stat */}
        <div className="space-y-2">
           <div className="flex justify-between items-end">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-rose-400" /> Above Stop
            </span>
            <span className={clsx("text-xl font-bold font-mono", isHighRisk ? "text-rose-400" : "text-slate-400")}>
              {lossPercentage}%
            </span>
          </div>
          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-rose-500 rounded-full" 
              style={{ width: `${lossPercentage}%` }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};
