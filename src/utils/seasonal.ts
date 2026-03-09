import Papa from 'papaparse';

export interface UvxyClosePoint {
  date: Date;
  close: number;
}

export interface SeasonalYearPoint {
  year: number;
  avgReturn: number;
  sampleSize: number;
}

export interface SeasonalCell {
  month: number;
  weekOfMonth: number;
  avgReturn: number | null;
  sampleSize: number;
  yearlySeries: SeasonalYearPoint[];
}

export interface SeasonalMonth {
  month: number;
  name: string;
  cells: SeasonalCell[];
}

export interface SeasonalCalendarResult {
  months: SeasonalMonth[];
  maxAbsAvgReturn: number;
  windowStart: Date;
  windowEnd: Date;
  lookbackYears: number;
  yearsCovered: number;
  totalObservations: number;
}

interface BucketValue {
  sum: number;
  count: number;
  byYear: Map<number, { sum: number; count: number }>;
}

interface BuildOptions {
  lookbackYears?: number;
}

const DEFAULT_LOOKBACK_YEARS = 14;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const parseIsoDate = (raw: string): Date | null => {
  const trimmed = raw.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  return new Date(Date.UTC(year, month - 1, day));
};

const mondayStartWeekOfMonth = (date: Date): number => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const dayOfMonth = date.getUTCDate();

  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const firstDayOffsetMonday = (firstOfMonth.getUTCDay() + 6) % 7; // Monday=0, Sunday=6

  return Math.floor((dayOfMonth + firstDayOffsetMonday - 1) / 7) + 1;
};

export const parseUvxyCloseSeries = async (filePath: string): Promise<UvxyClosePoint[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(filePath, {
      download: true,
      header: false,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<string[]>) => {
        try {
          const rows = results.data;
          if (rows.length === 0) {
            resolve([]);
            return;
          }

          let closeIndex = -1;
          for (let r = 0; r < Math.min(5, rows.length); r++) {
            const row = rows[r];
            for (let c = 0; c < row.length; c++) {
              if (row[c]?.trim().toLowerCase() === 'close') {
                closeIndex = c;
                break;
              }
            }
            if (closeIndex !== -1) break;
          }
          if (closeIndex === -1) closeIndex = 4;

          const points: UvxyClosePoint[] = [];
          for (const row of rows) {
            if (row.length <= closeIndex) continue;

            const date = parseIsoDate(row[0] ?? '');
            if (!date) continue;

            const close = Number.parseFloat(row[closeIndex]);
            if (!Number.isFinite(close) || close <= 0) continue;

            points.push({ date, close });
          }

          points.sort((a, b) => a.date.getTime() - b.date.getTime());
          resolve(points);
        } catch (error) {
          reject(error);
        }
      },
      error: (error: Error) => reject(error),
    });
  });
};

export const buildSeasonalWeeklyCalendar = (
  points: UvxyClosePoint[],
  options?: BuildOptions
): SeasonalCalendarResult => {
  const lookbackYears = options?.lookbackYears ?? DEFAULT_LOOKBACK_YEARS;
  if (points.length === 0) {
    const now = new Date();
    return {
      months: MONTH_NAMES.map((name, i) => ({
        month: i + 1,
        name,
        cells: Array.from({ length: 6 }, (_, idx) => ({
          month: i + 1,
          weekOfMonth: idx + 1,
          avgReturn: null,
          sampleSize: 0,
          yearlySeries: [],
        })),
      })),
      maxAbsAvgReturn: 0,
      windowStart: now,
      windowEnd: now,
      lookbackYears,
      yearsCovered: 0,
      totalObservations: 0,
    };
  }

  const sortedPoints = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const windowEnd = sortedPoints[sortedPoints.length - 1].date;
  const rawWindowStart = new Date(windowEnd.getTime());
  rawWindowStart.setUTCFullYear(windowEnd.getUTCFullYear() - lookbackYears);

  const windowPoints = sortedPoints.filter((point) => point.date >= rawWindowStart && point.date <= windowEnd);
  const actualWindowStart = windowPoints[0]?.date ?? rawWindowStart;

  const buckets = new Map<string, BucketValue>();

  for (let i = 7; i < windowPoints.length; i++) {
    const anchor = windowPoints[i];
    const prior = windowPoints[i - 7];

    if (prior.close <= 0) continue;
    const return7 = anchor.close / prior.close - 1;

    const month = anchor.date.getUTCMonth() + 1;
    const weekOfMonth = mondayStartWeekOfMonth(anchor.date);
    const year = anchor.date.getUTCFullYear();

    const key = `${month}-${weekOfMonth}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        sum: 0,
        count: 0,
        byYear: new Map<number, { sum: number; count: number }>(),
      };
      buckets.set(key, bucket);
    }

    bucket.sum += return7;
    bucket.count += 1;

    const yearly = bucket.byYear.get(year) ?? { sum: 0, count: 0 };
    yearly.sum += return7;
    yearly.count += 1;
    bucket.byYear.set(year, yearly);
  }

  const months: SeasonalMonth[] = MONTH_NAMES.map((name, monthIdx) => {
    const month = monthIdx + 1;
    const cells: SeasonalCell[] = [];

    for (let week = 1; week <= 6; week++) {
      const key = `${month}-${week}`;
      const bucket = buckets.get(key);

      if (!bucket || bucket.count === 0) {
        cells.push({
          month,
          weekOfMonth: week,
          avgReturn: null,
          sampleSize: 0,
          yearlySeries: [],
        });
        continue;
      }

      const yearlySeries = Array.from(bucket.byYear.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([year, value]) => ({
          year,
          avgReturn: value.sum / value.count,
          sampleSize: value.count,
        }));

      cells.push({
        month,
        weekOfMonth: week,
        avgReturn: bucket.sum / bucket.count,
        sampleSize: bucket.count,
        yearlySeries,
      });
    }

    return { month, name, cells };
  });

  const maxAbsAvgReturn = months
    .flatMap((month) => month.cells)
    .reduce((max, cell) => {
      if (cell.avgReturn === null) return max;
      return Math.max(max, Math.abs(cell.avgReturn));
    }, 0);

  const coveredYears = new Set(
    windowPoints.map((point) => point.date.getUTCFullYear())
  );

  const totalObservations = months
    .flatMap((month) => month.cells)
    .reduce((sum, cell) => sum + cell.sampleSize, 0);

  return {
    months,
    maxAbsAvgReturn,
    windowStart: actualWindowStart,
    windowEnd,
    lookbackYears,
    yearsCovered: coveredYears.size,
    totalObservations,
  };
};
