# UVXY Short Strategy Calculator - Development Log

## Overview
This document explains the development process for the `uvxy_calculator` standalone tool, following the BMad method.

## Phase 1: Planning (BMad)
We are treating this as a new "project" within the repo.

### Artifacts Created
- `uvxy_calculator/docs/prd.md`: Requirements and User Stories.
- `uvxy_calculator/docs/architecture.md`: Technical stack and Data flow.

## Phase 2: Implementation
1.  **Scaffold**: Created a React + TypeScript + Vite application in `uvxy_calculator/`.
2.  **Data**: Copied `uvxy_price/UVXY_full_history.csv` to `uvxy_calculator/public/data/`.
3.  **Logic**: Implemented a historical return calculator that parses the CSV and computes:
    - Probability of price < Target at Horizon.
    - Probability of price > Stop at Horizon.
4.  **UI**: Built a dashboard with:
    - Inputs: Current Price, Target, Stop.
    - Output: Probability cards.
    - Visuals: Non-functional checkboxes for future roadmap.

## Phase 3: Verification
- Verified the CSV parsing matches the Python `analyze_future_distribution.py` logic (skipping bad rows, using Close price).
- Checked the probability math.

## Instructions to Run
1.  Navigate to `uvxy_calculator`.
2.  Run `npm install`.
3.  Run `npm run dev` to start the local server.
