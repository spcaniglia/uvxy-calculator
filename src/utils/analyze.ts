import Papa from 'papaparse';

export interface PricePoint {
  date: Date;
  price: number;
}

export interface AnalysisResult {
  horizon: number;
  winRate: number; // Probability price < target
  lossRate: number; // Probability price > stop
  sampleSize: number;
  contextCategory?: string;
}

export type ContextCategory = 
  | "Major Spike (>25%)"
  | "Minor Spike (10-25%)"
  | "Steady Rise (5-10%)"
  | "Consolidation (+/-5%)"
  | "Steady Decline (-5 to -15%)"
  | "Sharp Decline (<-15%)"
  | "Unclassified";

export const getContextCategory = (pctChange: number): ContextCategory => {
  if (pctChange > 0.25) return "Major Spike (>25%)";
  if (pctChange > 0.10) return "Minor Spike (10-25%)";
  if (pctChange > 0.05) return "Steady Rise (5-10%)";
  if (pctChange >= -0.05) return "Consolidation (+/-5%)";
  if (pctChange >= -0.15) return "Steady Decline (-5 to -15%)";
  return "Sharp Decline (<-15%)";
};

export const parseCSV = async (filePath: string): Promise<PricePoint[]> => {
  // ... (keeping existing parseCSV implementation, just ensuring imports match)

  return new Promise((resolve, reject) => {
    Papa.parse(filePath, {
      download: true,
      header: false, // The CSV has complex headers, we'll parse manually
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<string[]>) => {
        try {
          const data = results.data;
          
          // Row 0: Tickers (UVXY, UVXY...)
          // Row 1: Headers (Price, Open, High, Low, Close...)
          // Row 2: Date, ... values
          
          // Let's identify the 'Close' column index. 
          // Based on previous file analysis: Row 0 has 'Close' or Row 1 has 'Close'. 
          // The python script saw: Header row 0: Price type, Row 1: Ticker. 
          // Let's look at the raw rows we get.
          
          // Simplification: We'll assume the structure matches the Python script's finding:
          // It found 'Close' in column 4 (index 4) if we ignore the first index column.
          // Let's be robust. Find the column index for "Close" in the header rows.
          
          let closeIndex = -1;
          let dateIndex = 0; // Usually the first column
          
          // Search in first few rows for "Close"
          for (let r = 0; r < 5; r++) {
             const row = data[r];
             if (!row) continue;
             for (let c = 0; c < row.length; c++) {
                 if (row[c]?.toString().toLowerCase() === 'close') {
                     closeIndex = c;
                     break;
                 }
             }
             if (closeIndex !== -1) break;
          }

          if (closeIndex === -1) {
             // Fallback: usually column 4 (Price, Open, High, Low, Close) -> Index 4
             closeIndex = 4; 
          }

          const parsedData: PricePoint[] = [];

          // Start reading from data rows. If headers are top 3 rows, start at index 3?
          // We'll try to parse every row as a date. If it fails, skip.
          
          for (const row of data) {
            const dateStr = row[dateIndex];
            const priceStr = row[closeIndex];
            
            // Try to parse date
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) continue; // Invalid date (likely header)
            
            // Try to parse price
            const price = parseFloat(priceStr);
            if (isNaN(price)) continue;

            parsedData.push({ date, price });
          }

          // Sort by date ascending just in case
          parsedData.sort((a, b) => a.date.getTime() - b.date.getTime());
          
          resolve(parsedData);
        } catch (err) {
          reject(err);
        }
      },
      error: (err: Error) => reject(err),
    });
  });
};

export const calculateProbabilities = (
  data: PricePoint[],
  currentPrice: number,
  targetPrice: number,
  stopPrice: number,
  horizonDays: number,
  filterConfig?: {
    lookbackDays: number;
    allowedContexts: ContextCategory[];
  }
): AnalysisResult => {
  if (data.length === 0) return { horizon: horizonDays, winRate: 0, lossRate: 0, sampleSize: 0 };

  let wins = 0;
  let losses = 0;
  let totalSamples = 0;

  const targetPctChange = (targetPrice - currentPrice) / currentPrice;
  const stopPctChange = (stopPrice - currentPrice) / currentPrice;

  const msPerDay = 1000 * 60 * 60 * 24;
  const horizonMs = horizonDays * msPerDay;

  for (let i = 0; i < data.length; i++) {
    const entryDate = data[i].date;
    const entryPrice = data[i].price;

    // --- CONTEXT FILTERING ---
    if (filterConfig) {
      const lookbackMs = filterConfig.lookbackDays * msPerDay;
      const lookbackDateMs = entryDate.getTime() - lookbackMs;
      
      // Find price lookbackDays ago
      let lookbackIndex = -1;
      for (let k = i - 1; k >= 0; k--) {
        if (data[k].date.getTime() <= lookbackDateMs) {
          lookbackIndex = k;
          break;
        }
      }

      if (lookbackIndex === -1) continue; // Not enough history for this day
      
      const lookbackPrice = data[lookbackIndex].price;
      const pastReturn = (entryPrice - lookbackPrice) / lookbackPrice;
      const historicalCategory = getContextCategory(pastReturn);

      if (!filterConfig.allowedContexts.includes(historicalCategory)) {
        continue;
      }
    }
    // -------------------------

    const targetDateMs = entryDate.getTime() + horizonMs;
    let futureIndex = -1;
    for (let j = i + 1; j < data.length; j++) {
       if (data[j].date.getTime() >= targetDateMs) {
           futureIndex = j;
           break;
       }
    }

    if (futureIndex === -1) continue;

    const futurePoint = data[futureIndex];
    if ((futurePoint.date.getTime() - targetDateMs) > (7 * msPerDay)) continue;

    const exitPrice = futurePoint.price;
    const pctReturn = (exitPrice - entryPrice) / entryPrice;

    totalSamples++;
    if (pctReturn < targetPctChange) wins++;
    if (pctReturn > stopPctChange) losses++;
  }

  return {
    horizon: horizonDays,
    winRate: totalSamples > 0 ? wins / totalSamples : 0,
    lossRate: totalSamples > 0 ? losses / totalSamples : 0,
    sampleSize: totalSamples,
    contextCategory: filterConfig && filterConfig.allowedContexts.length === 1 ? filterConfig.allowedContexts[0] : undefined
  };
};
