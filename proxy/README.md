# OmanTrade — yfinance proxy

Small Python service that fetches **US stock** data with
[`yfinance`](https://github.com/ranaroussi/yfinance) and exposes it to the
static trading simulator (which cannot call Yahoo directly due to CORS and
because `yfinance` is Python-only).

The simulator talks to this service for the **US Stocks · yfinance** market
group. If the proxy is unreachable, those symbols silently fall back to the
built-in simulator, so the app always works.

## Endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/stock?symbol=AAPL&interval=5m&period=1d` | Historical candles + last price |
| GET | `/quote?symbol=AAPL` | Latest price + prior close (polled live) |
| GET | `/health` | Health check |

## Run locally

```bash
cd proxy
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

Then open the simulator with `?proxy=http://localhost:8000`, e.g.
`http://localhost:5500/index.html?proxy=http://localhost:8000`.

## Deploy (free) — Render

1. Push this `proxy/` folder to a GitHub repo (or a subfolder).
2. New **Web Service** on [render.com](https://render.com) (free tier):
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. After deploy you get a URL like `https://omantrade-proxy.onrender.com`.
4. Open the simulator with that proxy, e.g.
   `https://aksbeat.github.io/omantrade-sim/?proxy=https://omantrade-proxy.onrender.com`

> Note: free tiers spin down when idle; the first request after a pause may be
> slow. That is fine — the simulator falls back to simulation until data arrives.

> yfinance scrapes Yahoo Finance and is intended for personal/research use;
> respect Yahoo's terms and rate limits. Add caching in front if you expect
> heavy traffic.
