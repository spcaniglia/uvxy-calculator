import pandas as pd
import json
import os

# Define paths
csv_path = '../uvxy_price/UVXY_full_history.csv'
output_dir = 'public/data'
output_path = os.path.join(output_dir, 'uvxy_history.json')

# Ensure output directory exists
os.makedirs(output_dir, exist_ok=True)

# Load data
print(f"Reading from {csv_path}...")
df = pd.read_csv(csv_path, skiprows=3, names=['Date', 'Open', 'High', 'Low', 'Close'])

# Clean data
df['Close'] = pd.to_numeric(df['Close'], errors='coerce')
df['Open'] = pd.to_numeric(df['Open'], errors='coerce')
df['High'] = pd.to_numeric(df['High'], errors='coerce')
df['Low'] = pd.to_numeric(df['Low'], errors='coerce')
df.dropna(subset=['Close', 'Open', 'High', 'Low'], inplace=True)

# Calculate metrics needed for matching
# Note: Percentage changes are relative to that specific day's Open or Previous Close
# We pre-calculate these to make the JS frontend lighter
data_list = []

for i in range(len(df)):
    row = df.iloc[i]
    prev_close = df.iloc[i-1]['Close'] if i > 0 else row['Open'] # Fallback for first day
    
    # Core price data
    day_data = {
        "date": row['Date'],
        "open": float(row['Open']),
        "high": float(row['High']),
        "low": float(row['Low']),
        "close": float(row['Close']),
    }
    
    # Calculated Metrics (for matching logic)
    # 1. Gap from previous close (0 for first day)
    day_data["gap_pct"] = ((row['Open'] - prev_close) / prev_close) * 100
    
    # 2. Intraday Return (Body)
    day_data["intraday_pct"] = ((row['Close'] - row['Open']) / row['Open']) * 100
    
    # 3. Total Range
    day_data["range_pct"] = ((row['High'] - row['Low']) / row['Open']) * 100
    
    # 4. Upper Wick size relative to Open
    body_top = max(row['Open'], row['Close'])
    day_data["upper_wick_pct"] = ((row['High'] - body_top) / row['Open']) * 100
    
    # 5. Lower Wick size relative to Open
    body_bottom = min(row['Open'], row['Close'])
    day_data["lower_wick_pct"] = ((body_bottom - row['Low']) / row['Open']) * 100
    
    # 6. Close to Close Return (The standard "Day Return")
    day_data["close_to_close_pct"] = ((row['Close'] - prev_close) / prev_close) * 100

    data_list.append(day_data)

# Write to JSON
print(f"Writing {len(data_list)} records to {output_path}...")
with open(output_path, 'w') as f:
    json.dump(data_list, f, indent=None) # Compact JSON

print("Done.")
