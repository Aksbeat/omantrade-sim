# OmanTrade — Trading Simulation Platform

A **Hyperliquid-style trading simulator** built for college students in the
**Sultanate of Oman**. It is a 100% educational, risk-free environment: every
student who logs in receives a virtual **$10,000** balance and can practice
crypto-perpetual trading with simulated market data.

> ⚠️ **Simulation only.** No real money, no broker connection, no live exchange.
> All prices, balances and positions are virtual and generated client-side.

---

## Acknowledgements

- **Powered by** Middle East College & Ministry of Education
- **Funded by** the MoHERI Research Grant

---

## Features

- **Login & welcome screen** with the official Oman partnership note and a
  virtual $10,000 grant on first login.
- **Market list** of 10 simulated perpetual markets (BTC, ETH, SOL, BNB, XRP,
  ADA, DOGE, AVAX, LINK, MATIC) with live-updating prices and 24h change.
- **Candlestick chart** with 1m / 5m / 15m / 1h timeframes (canvas-rendered).
- **Live order book** generated around the mid price.
- **Trade panel**: Buy/Sell, Market/Limit, leverage (1×–10×), quick-size
  buttons, and per-trade margin accounting.
- **Positions & open orders** with live unrealized PnL, liquidation prices, and
  one-click close / cancel.
- **Trade history** log.
- **Account header**: equity, available balance, and total PnL.
- **Reset** button to restart the simulation at $10,000.
- **Persistence**: progress is saved per email in `localStorage`, so students
  can resume their session later.

---

## Run locally

No build step or server required — it is static HTML/CSS/JS.

```bash
# option A: just open the file
open index.html        # macOS
xdg-open index.html    # Linux

# option B: serve it (recommended)
python3 -m http.server 8080
# then visit http://localhost:8080
```

---

## Deploy to GitHub Pages

1. Create a repository on GitHub (e.g. `omantrade-sim`).
2. Push these files (`index.html`, `styles.css`, `app.js`, `README.md`).
3. In the repo: **Settings → Pages → Source → `main` branch / root** → Save.
4. Your simulator will be live at
   `https://<your-username>.github.io/<repo>/`.

Or from the CLI:

```bash
git init
git add .
git commit -m "OmanTrade simulation platform"
git remote add origin git@github.com:<user>/<repo>.git
git push -u origin main
```

---

## Project structure

```
om-trade-sim/
├── index.html   # Login screen + trading app (single page)
├── styles.css   # Dark Hyperliquid-style theme
├── app.js       # Simulation engine, order logic, rendering, persistence
└── README.md
```

---

© OmanTrade Simulation · Middle East College · Ministry of Education · MoHERI
