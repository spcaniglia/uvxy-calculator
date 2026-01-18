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
      "relative overflow-hidden rounded-xl border transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5",
      isHighProb ? "bg-slate-900 border-indigo-500/30" : "bg-slate-900 border-slate-800"
    )}>
      {/* Background decoration */}
      {isHighProb && (
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
      )}

      <div className="flex flex-col md:flex-row items-center p-4 gap-6">
        
        {/* Header Section (Left) */}
        <div className="flex-shrink-0 w-full md:w-32 flex flex-row md:flex-col justify-between md:justify-center items-center md:items-start gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-slate-100">{result.horizon} Days</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">N={result.sampleSize}</span>
          {isHighProb && <span className="hidden md:inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500 text-white uppercase tracking-wider">Top Pick</span>}
        </div>

        {/* Stats Section (Right - Grid) */}
        <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          
          {/* Win Stat */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-400" /> Under Target
              </span>
              <span className={clsx("text-lg font-bold font-mono", result.winRate > 0.5 ? "text-emerald-400" : "text-slate-200")}>
                {winPercentage}%
              </span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                style={{ width: `${winPercentage}%` }} 
              />
            </div>
          </div>

          {/* Loss Stat */}
          <div className="space-y-1.5">
             <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-rose-400" /> Above Stop
              </span>
              <div className="flex items-center gap-2">
                {isHighRisk && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                <span className={clsx("text-lg font-bold font-mono", isHighRisk ? "text-rose-400" : "text-slate-400")}>
                  {lossPercentage}%
                </span>
              </div>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                style={{ width: `${lossPercentage}%` }} 
              />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
