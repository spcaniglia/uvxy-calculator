# Product Requirement Document (PRD): UVXY Short Strategy Calculator

## 1. Executive Summary
A standalone web-based tool to calculate the historical probability of success for a Short UVXY strategy. Users input a target price and a stop loss, and the tool calculates how often those levels were breached in history over various time horizons.

## 2. User Personas
- **Trader**: Wants to assess the risk/reward of a short position based on historical data.

## 3. User Stories
- As a **Trader**, I want to input my entry, target, and stop prices so that I can see the historical probability of the trade working.
- As a **Trader**, I want to select different time horizons (e.g., 7, 30 days) to match my trading plan.
- As a **Trader**, I want to see visual indicators (checkboxes) for future features like "Past X Days" filtering, even if not active yet.

## 4. Functional Requirements
- **Inputs**:
    - Current Price (Default: Latest Close from data or manual input).
    - Target Price (Below Current).
    - Stop Price (Above Current).
- **Outputs**:
    - Probability (Win Rate): % of historical instances where Price(t+H) < Target.
    - Probability (Loss Rate): % of historical instances where Price(t+H) > Stop.
- **Data Source**: `UVXY_full_history.csv` (Client-side parsing).
- **Constraints**:
    - "Stop Loss" logic: Currently calculated as End-of-Period status (Price at t+H > Stop), matching existing Python analysis scripts.

## 5. Non-Functional Requirements
- **Performance**: Fast calculation (client-side).
- **Tech Stack**: React, TypeScript, Vite.
- **UI**: Clean, modern dashboard (Tailwind CSS).
