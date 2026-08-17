# OmanTrade — yfinance proxy

Small Python service that fetches **US stock** data with
[`yfinance`](https://github.com/ranaroussi/yfinance) and exposes it to the
static trading simulator (which cannot call Yahoo directly due to CORS and
because `yfinance` is Python-only).

The simulator talks to this service for the **US Stocks · yfinance** market
group. If the proxy is unreachable, those symbols show **"yfinance:
unreachable"** in the Markets panel and fall back to the built-in simulator,
so the app always works.

## Endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/stock?symbol=AAPL&interval=5m&period=1d` | Historical candles + last price |
| GET | `/quote?symbol=AAPL` | Latest price + prior close (polled live) |
| GET | `/health` | Health check |

## Deploy (free, ~2 min) — Render

**One-click deploy** (fork the repo first, then click):

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Aksbeat/omantrade-sim)

Manual steps:
1. In [render.com](https://render.com) -> **New -> Web Service** (free tier).
2. Connect this repo, set **Root Directory** to `proxy`.
3. Build command: `pip install -r requirements.txt`
   Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Deploy. You get a URL like `https://omantrade-proxy.onrender.com`.
5. In the simulator, click **(top-right) -> paste that URL -> Save.
   (Or open with `?proxy=https://your-url.onrender.com`.)

> Free tiers spin down when idle; the first request after a pause may be slow -
> the simulator falls back to simulation until data arrives.

## Run locally

```bash
cd proxy
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

Then open the simulator with `?proxy=http://localhost:8000`.

> yfinance scrapes Yahoo Finance and is intended for personal/research use;
> respect Yahoo's terms and rate limits. Add caching in front if you expect
> heavy traffic.
