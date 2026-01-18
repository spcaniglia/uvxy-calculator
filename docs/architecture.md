# Architecture Document: UVXY Calculator

## 1. System Overview
Single-Page Application (SPA) built with React and TypeScript. Served via Vite.

## 2. Tech Stack
- **Framework**: React 18+
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data Handling**: PapaParse (CSV Parsing)
- **State Management**: React Hooks (local state)

## 3. Data Flow
1.  **Load**: App fetches `data/UVXY_full_history.csv` from the public folder on mount.
2.  **Parse**: `PapaParse` reads the CSV.
    - **Preprocessing**: Skips the first 2 header rows (Tickers/Metadata). Uses the 3rd row (Dates) and data. Identifies the "Close" column.
    - **Storage**: Parsed data (Date, Close Price) stored in React State (Array of Objects).
3.  **Compute**: `useMemo` hook calculates probabilities whenever inputs (Target, Stop, Horizon) change.
    - **Algorithm**:
        - Calculate `% Change Target` = (Target - Current) / Current.
        - Calculate `% Change Stop` = (Stop - Current) / Current.
        - Iterate through all historical dates `t`.
        - Get `Price_t` and `Price_t+H`.
        - Calculate historical return `r`.
        - Count `Wins` (r < % Change Target).
        - Count `Losses` (r > % Change Stop).
        - Result = Count / Total Samples.

## 4. Directory Structure
```
uvxy_calculator/
├── public/
│   └── data/
│       └── UVXY_full_history.csv
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   └── ProbabilityCard.tsx
│   ├── utils/
│   │   └── analyze.ts  <-- Core logic
│   ├── App.tsx
│   └── main.tsx
└── package.json
```
