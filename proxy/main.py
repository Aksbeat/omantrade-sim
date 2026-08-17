from fastapi import FastAPI, Request, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import datetime as dt

app = FastAPI(title="OmanTrade yfinance proxy")

# Allow the static GitHub Pages site to call this from another origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def _candles(ticker, interval, period):
    df = ticker.history(period=period, interval=interval, auto_adjust=False)
    out = []
    for ts, row in df.iterrows():
        out.append({
            "t": int(ts.timestamp() * 1000),
            "o": float(row["Open"]),
            "h": float(row["High"]),
            "l": float(row["Low"]),
            "c": float(row["Close"]),
            "v": float(row["Volume"]) if "Volume" in row and row["Volume"] == row["Volume"] else 0.0,
        })
    return out


@app.get("/stock")
def stock(symbol: str = Query(...), interval: str = "1d", period: str = "1mo"):
    try:
        tk = yf.Ticker(symbol)
        df = tk.history(period=period, interval=interval, auto_adjust=False)
        if df is None or df.empty:
            return {"symbol": symbol, "price": None, "open": None, "candles": []}
        candles = _candles(tk, interval, period)
        price = float(df["Close"].iloc[-1])
        prev = float(df["Close"].iloc[0]) if len(df) > 1 else price
        return {"symbol": symbol, "price": price, "open": prev, "candles": candles}
    except Exception as e:  # yfinance/network failures -> empty so the app falls back to sim
        return {"symbol": symbol, "error": str(e), "price": None, "open": None, "candles": []}


@app.get("/quote")
def quote(symbol: str = Query(...)):
    try:
        tk = yf.Ticker(symbol)
        df = tk.history(period="2d", interval="1d", auto_adjust=False)
        if df is None or df.empty:
            return {"symbol": symbol, "price": None, "open": None}
        price = float(df["Close"].iloc[-1])
        prev = float(df["Close"].iloc[0]) if len(df) > 1 else price
        return {"symbol": symbol, "price": price, "open": prev}
    except Exception as e:
        return {"symbol": symbol, "error": str(e), "price": None, "open": None}


@app.get("/health")
def health():
    return {"status": "ok"}
