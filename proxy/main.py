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

# Small in-memory TTL cache to avoid hammering Yahoo (rate limits / IP bans).
import time
_CACHE = {}
_CACHE_TTL = 5  # seconds


def _cached(key, ttl, fn):
    now = time.time()
    hit = _CACHE.get(key)
    if hit and now - hit[1] < ttl:
        return hit[0]
    val = fn()
    _CACHE[key] = (val, now)
    return val


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
    key = "stock:" + symbol.upper() + ":" + interval + ":" + period
    try:
        def _fetch():
            tk = yf.Ticker(symbol)
            df = tk.history(period=period, interval=interval, auto_adjust=False)
            if df is None or df.empty:
                return {"symbol": symbol, "price": None, "open": None, "candles": []}
            candles = _candles(tk, interval, period)
            price = float(df["Close"].iloc[-1])
            prev = float(df["Close"].iloc[0]) if len(df) > 1 else price
            return {"symbol": symbol, "price": price, "open": prev, "candles": candles}
        return _cached(key, _CACHE_TTL, _fetch)
    except Exception as e:  # yfinance/network failures -> empty so the app falls back to sim
        return {"symbol": symbol, "error": str(e), "price": None, "open": None, "candles": []}


@app.get("/quote")
def quote(symbol: str = Query(...)):
    # Use 1-minute history for the most granular live US price yfinance can give
    # (yfinance has no US-equity WebSocket; .info is rate-limited/deprecated).
    try:
        def _fetch():
            tk = yf.Ticker(symbol)
            df = tk.history(period="1d", interval="1m", auto_adjust=False)
            if df is None or df.empty:
                return None
            price = float(df["Close"].iloc[-1])
            prev = float(df["Close"].iloc[0]) if len(df) > 1 else price
            return {"symbol": symbol, "price": price, "open": prev}
        cached = _cached("quote:" + symbol.upper(), _CACHE_TTL, _fetch)
        if cached is None:
            return {"symbol": symbol, "price": None, "open": None}
        return cached
    except Exception as e:
        return {"symbol": symbol, "error": str(e), "price": None, "open": None}


@app.get("/health")
def health():
    return {"status": "ok"}
