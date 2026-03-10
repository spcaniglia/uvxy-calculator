import json
import os

import pandas as pd


OUTPUT_DIR = "public/data"
TICKERS = ("UVXY", "VXX")


def _find_column_index(raw_df: pd.DataFrame, label: str, fallback: int) -> int:
    upper = label.upper()
    for r in range(min(5, len(raw_df))):
        for c in range(len(raw_df.columns)):
            value = str(raw_df.iat[r, c]).strip().upper()
            if value == upper:
                return c
    return fallback


def load_ohlc(csv_path: str) -> pd.DataFrame:
    # Fast path for standard OHLC files with explicit header row.
    try:
        parsed = pd.read_csv(csv_path)
        normalized = {str(col).strip().lower(): col for col in parsed.columns}
        required = ("date", "open", "high", "low", "close")
        if all(key in normalized for key in required):
            out = parsed[
                [
                    normalized["date"],
                    normalized["open"],
                    normalized["high"],
                    normalized["low"],
                    normalized["close"],
                ]
            ].copy()
            out.columns = ["Date", "Open", "High", "Low", "Close"]
            return out
    except Exception:
        pass

    # Fallback for older multi-header yfinance CSVs.
    raw = pd.read_csv(csv_path, header=None, dtype=str)
    open_idx = _find_column_index(raw, "Open", 1)
    high_idx = _find_column_index(raw, "High", 2)
    low_idx = _find_column_index(raw, "Low", 3)
    close_idx = _find_column_index(raw, "Close", 4)

    out = pd.DataFrame(
        {
            "Date": raw.iloc[:, 0],
            "Open": raw.iloc[:, open_idx],
            "High": raw.iloc[:, high_idx],
            "Low": raw.iloc[:, low_idx],
            "Close": raw.iloc[:, close_idx],
        }
    )
    return out


def build_history_json(ticker: str) -> None:
    csv_path = os.path.join(OUTPUT_DIR, f"{ticker}_full_history.csv")
    output_path = os.path.join(OUTPUT_DIR, f"{ticker.lower()}_history.json")

    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Missing source CSV: {csv_path}")

    print(f"Reading {ticker} data from {csv_path}...")
    df = load_ohlc(csv_path)

    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    for col in ("Open", "High", "Low", "Close"):
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df.dropna(subset=["Date", "Open", "High", "Low", "Close"], inplace=True)
    df = df[(df["Open"] > 0) & (df["High"] > 0) & (df["Low"] > 0) & (df["Close"] > 0)]
    df.sort_values("Date", inplace=True)
    df.reset_index(drop=True, inplace=True)

    data_list = []
    for i in range(len(df)):
        row = df.iloc[i]
        prev_close = df.iloc[i - 1]["Close"] if i > 0 else row["Open"]

        day_data = {
            "date": row["Date"].strftime("%Y-%m-%d"),
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
        }

        day_data["gap_pct"] = ((row["Open"] - prev_close) / prev_close) * 100
        day_data["intraday_pct"] = ((row["Close"] - row["Open"]) / row["Open"]) * 100
        day_data["range_pct"] = ((row["High"] - row["Low"]) / row["Open"]) * 100

        body_top = max(row["Open"], row["Close"])
        day_data["upper_wick_pct"] = ((row["High"] - body_top) / row["Open"]) * 100

        body_bottom = min(row["Open"], row["Close"])
        day_data["lower_wick_pct"] = ((body_bottom - row["Low"]) / row["Open"]) * 100

        day_data["close_to_close_pct"] = ((row["Close"] - prev_close) / prev_close) * 100
        data_list.append(day_data)

    with open(output_path, "w") as f:
        json.dump(data_list, f, indent=None)

    print(f"Wrote {len(data_list)} rows to {output_path}")


def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for ticker in TICKERS:
        build_history_json(ticker)
    print("Done.")


if __name__ == "__main__":
    main()
