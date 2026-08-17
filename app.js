/* =========================================================================
   OmanTrade — Trading Simulation Platform
   A self-contained, risk-free Hyperliquid-style simulator for students.
   No backend, no real money. All data is simulated client-side.
   ========================================================================= */
(function () {
  "use strict";

  // ----------------------------- Config -----------------------------------
  var STARTING_BALANCE = 10000; // USD virtual
  var TICK_MS = 1000;           // price engine tick
  var HISTORY_CAP = 6000;       // raw price ticks retained per asset

  // Simulated markets. Crypto perps use USD; MSX stocks use OMR.
  // NOTE: MSX has no free in-browser API, so these are simulated listings
  // (real company names, illustrative base prices) consistent with the sim.
  var ASSETS = [
    { symbol: "BTC-PERP",  name: "Bitcoin",   price: 64800,  vol: 0.0016, dec: 1, cat: "crypto", cur: "USD" },
    { symbol: "ETH-PERP",  name: "Ethereum",  price: 3380,   vol: 0.0020, dec: 2, cat: "crypto", cur: "USD" },
    { symbol: "SOL-PERP",  name: "Solana",    price: 148.2,  vol: 0.0030, dec: 2, cat: "crypto", cur: "USD" },
    { symbol: "BNB-PERP",  name: "BNB",       price: 585,    vol: 0.0022, dec: 2, cat: "crypto", cur: "USD" },
    { symbol: "XRP-PERP",  name: "XRP",       price: 0.582,  vol: 0.0030, dec: 4, cat: "crypto", cur: "USD" },
    { symbol: "ADA-PERP",  name: "Cardano",   price: 0.461,  vol: 0.0032, dec: 4, cat: "crypto", cur: "USD" },
    { symbol: "DOGE-PERP", name: "Dogecoin",  price: 0.1234, vol: 0.0040, dec: 5, cat: "crypto", cur: "USD" },
    { symbol: "AVAX-PERP", name: "Avalanche", price: 36.1,   vol: 0.0030, dec: 2, cat: "crypto", cur: "USD" },
    { symbol: "LINK-PERP", name: "Chainlink", price: 14.25,  vol: 0.0032, dec: 3, cat: "crypto", cur: "USD" },
    { symbol: "MATIC-PERP",name: "Polygon",   price: 0.724,  vol: 0.0034, dec: 4, cat: "crypto", cur: "USD" },
    // ---- US Stocks (via yfinance proxy; falls back to sim if proxy unset) ----
    { symbol: "AAPL",  name: "Apple",        price: 225.0,  vol: 0.0015, dec: 2, cat: "us", cur: "USD" },
    { symbol: "MSFT",  name: "Microsoft",    price: 415.0,  vol: 0.0015, dec: 2, cat: "us", cur: "USD" },
    { symbol: "NVDA",  name: "NVIDIA",       price: 120.0,  vol: 0.0030, dec: 2, cat: "us", cur: "USD" },
    { symbol: "TSLA",  name: "Tesla",        price: 250.0,  vol: 0.0035, dec: 2, cat: "us", cur: "USD" },
    { symbol: "AMZN",  name: "Amazon",       price: 185.0,  vol: 0.0020, dec: 2, cat: "us", cur: "USD" },
    { symbol: "GOOGL", name: "Alphabet",     price: 175.0,  vol: 0.0020, dec: 2, cat: "us", cur: "USD" },
    { symbol: "META",  name: "Meta",         price: 560.0,  vol: 0.0025, dec: 2, cat: "us", cur: "USD" },
    { symbol: "AMD",   name: "AMD",          price: 160.0,  vol: 0.0030, dec: 2, cat: "us", cur: "USD" },
    { symbol: "NFLX",  name: "Netflix",      price: 700.0,  vol: 0.0025, dec: 2, cat: "us", cur: "USD" },
    { symbol: "INTC",  name: "Intel",        price: 22.0,   vol: 0.0030, dec: 2, cat: "us", cur: "USD" },
    // ---- Muscat Securities Exchange (MSX) — simulated ----
    { symbol: "BKMB",  name: "Bank Muscat",          price: 0.620, vol: 0.0040, dec: 3, cat: "stock", cur: "OMR" },
    { symbol: "OMTEL", name: "Omantel",              price: 0.850, vol: 0.0040, dec: 3, cat: "stock", cur: "OMR" },
    { symbol: "ORAT",  name: "Ooredoo Oman",         price: 0.108, vol: 0.0060, dec: 4, cat: "stock", cur: "OMR" },
    { symbol: "OQ",    name: "OQ",                   price: 1.180, vol: 0.0040, dec: 3, cat: "stock", cur: "OMR" },
    { symbol: "SIB",   name: "Sohar International",  price: 0.205, vol: 0.0050, dec: 3, cat: "stock", cur: "OMR" },
    { symbol: "ALIZ",  name: "Alizz Islamic Bank",   price: 0.122, vol: 0.0060, dec: 4, cat: "stock", cur: "OMR" },
    { symbol: "NBO",   name: "National Bank of Oman", price: 0.182, vol: 0.0050, dec: 3, cat: "stock", cur: "OMR" },
    { symbol: "AHLI",  name: "Ahli Bank",            price: 0.142, vol: 0.0060, dec: 4, cat: "stock", cur: "OMR" },
    { symbol: "OAB",   name: "Oman Arab Bank",       price: 0.305, vol: 0.0050, dec: 3, cat: "stock", cur: "OMR" },
    { symbol: "VOLT",  name: "Voltamp Energy",       price: 11.20, vol: 0.0050, dec: 2, cat: "stock", cur: "OMR" }
  ];

  // ----------------------------- Helpers -----------------------------------
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function fmtUSD(v, d) {
    if (d == null) d = 2;
    return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fmtPrice(v, dec) {
    return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function fmtNum(v, dec) {
    return Number(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function fmtPct(v) { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }
  function fmtTime(ts) {
    var d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour12: false });
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rand(min, max) { return min + Math.random() * (max - min); }

  function toast(msg, kind) {
    var t = $("toast");
    t.textContent = msg;
    t.className = "toast show" + (kind ? " " + kind : "");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = "toast"; }, 2600);
  }

  // ----------------------------- Market Engine -----------------------------
  // Each asset keeps: current price, open24h reference, drift, and raw ticks.
  var market = {};
  ASSETS.forEach(function (a) {
    market[a.symbol] = {
      meta: a,
      price: a.price,
      open24h: a.price,
      dayHigh: a.price,
      dayLow: a.price,
      funding: rand(0.0001, 0.0006) * (Math.random() < 0.5 ? -1 : 1), // simulated funding rate
      drift: rand(-0.00002, 0.00002), // gentle trend
      ticks: []
    };
    // seed history so charts aren't empty
    var p = a.price;
    for (var i = 0; i < 600; i++) {
      p = p * (1 + rand(-a.vol, a.vol) + market[a.symbol].drift);
      market[a.symbol].ticks.push(p);
    }
    market[a.symbol].price = market[a.symbol].ticks[market[a.symbol].ticks.length - 1];
    market[a.symbol].open24h = market[a.symbol].ticks[0];
  });

  // ----------------------------- Live Data Layer ----------------------------
  // Crypto: Hyperliquid public WS + REST (no backend, no key, CORS-OK).
  // US stocks: yfinance via a small proxy you deploy (CONFIG.STOCK_PROXY_URL).
  // MSX: simulated (no public feed). Everything falls back to simulation.
  function readProxyFromQuery() {
    try { return new URLSearchParams(location.search).get("proxy") || ""; } catch (e) { return ""; }
  }
  var CONFIG = {
    LIVE_CRYPTO: true,
    STOCK_PROXY_URL: readProxyFromQuery() || "", // e.g. "https://your-proxy.onrender.com"
    HL_WS: "wss://api.hyperliquid.xyz/ws",
    HL_REST: "https://api.hyperliquid.xyz/info"
  };
  function coinOf(sym) { return sym.replace(/-PERP$/, ""); }
  function canFetch() { return typeof fetch !== "undefined"; }

  function hlParseCandles(rows) {
    // Hyperliquid candleSnapshot rows: [time, o, h, l, c, v, ...]
    var bars = [];
    (rows || []).forEach(function (r) {
      var t = +r[0], o = +r[1], h = +r[2], l = +r[3], c = +r[4];
      if ([t, o, h, l, c].some(function (x) { return isNaN(x); })) return;
      bars.push({ t: t, o: o, h: h, l: l, c: c });
    });
    return bars;
  }
  function hlCandles(coin, tf) {
    if (!canFetch()) return Promise.reject(new Error("no fetch"));
    var tfMs = { "1m": 60000, "5m": 300000, "15m": 900000, "1h": 3600000 }[tf] || 60000;
    var bars = 180, endTime = Date.now(), startTime = endTime - tfMs * bars;
    return fetch(CONFIG.HL_REST, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "candleSnapshot", req: { coin: coin, interval: tf, startTime: startTime, endTime: endTime } })
    }).then(function (r) { if (!r.ok) throw new Error("hl " + r.status); return r.json(); })
      .then(function (rows) { var b = hlParseCandles(rows); if (!b.length) throw new Error("empty"); return b; });
  }
  function proxyCandles(sym, tf) {
    if (!CONFIG.STOCK_PROXY_URL || !canFetch()) return Promise.reject(new Error("no proxy"));
    var map = { "1m": ["1m", "1d"], "5m": ["5m", "1d"], "15m": ["15m", "1d"], "1h": ["60m", "5d"] };
    var m = map[tf] || ["1d", "1mo"];
    var url = CONFIG.STOCK_PROXY_URL + "/stock?symbol=" + encodeURIComponent(sym) + "&interval=" + m[0] + "&period=" + m[1];
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("proxy " + r.status); return r.json(); })
      .then(function (d) {
        var candles = (d.candles || []).map(function (c) {
          return { t: c.t ? +c.t : (c.time ? +c.time : 0), o: +c.o, h: +c.h, l: +c.l, c: +c.c };
        });
        if (!candles.length) throw new Error("empty");
        return { price: d.price != null ? +d.price : candles[candles.length - 1].c, candles: candles };
      });
  }
  function storeLiveCandles(sym, tf, bars, price) {
    var m = market[sym]; if (!m) return;
    m.liveCandles = m.liveCandles || {};
    m.liveCandles[tf] = bars;
    if (price != null) m.price = price;
    m.live = true;
    if (sym === currentSymbol) { renderTicker(); drawChart(); }
  }
  function loadHistory(sym, tf) {
    var m = market[sym];
    if (!m) return;
    if (m.meta.cat === "crypto" && CONFIG.LIVE_CRYPTO) {
      hlCandles(coinOf(sym), tf).then(function (bars) {
        storeLiveCandles(sym, tf, bars, bars[bars.length - 1].c);
        setLiveBadge(true, "LIVE · Hyperliquid");
      }).catch(function () { /* keep simulation */ });
    } else if (m.meta.cat === "us" && CONFIG.STOCK_PROXY_URL) {
      proxyCandles(sym, tf).then(function (d) {
        storeLiveCandles(sym, tf, d.candles, d.price);
        setLiveBadge(true, "LIVE · yfinance");
      }).catch(function () { /* keep simulation */ });
    }
  }

  // ---- Hyperliquid WebSocket (live mids + order book) ----
  var _ws = null, _wsRetry = null, _stockPoll = null;
  function startLive() {
    if (!CONFIG.LIVE_CRYPTO || typeof WebSocket === "undefined") return;
    connectHL();
    startStockPoll();
  }
  function connectHL() {
    if (_ws && (_ws.readyState === 1 || _ws.readyState === 0)) return;
    var ws;
    try { ws = new WebSocket(CONFIG.HL_WS); } catch (e) { return; }
    _ws = ws;
    ws.onopen = function () {
      try {
        ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "allMids" } }));
        ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "l2Book", coin: coinOf(currentSymbol) } }));
      } catch (e) {}
    };
    ws.onmessage = function (ev) {
      var msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.channel === "allMids") applyMids(msg.data);
      else if (msg.channel === "l2Book") applyBook(msg.data);
      else if (msg.channel === "activeAssetCtx") applyCtx(msg.data);
    };
    ws.onerror = function () {};
    ws.onclose = function () { if (CONFIG.LIVE_CRYPTO) { clearTimeout(_wsRetry); _wsRetry = setTimeout(connectHL, 5000); } };
  }
  function applyMids(data) {
    if (!data) return;
    ASSETS.forEach(function (a) {
      if (a.cat !== "crypto") return;
      var c = coinOf(a.symbol);
      if (data[c] != null) { var p = parseFloat(data[c]); if (!isNaN(p)) setLivePrice(a.symbol, p); }
    });
  }
  function setLivePrice(sym, p) {
    var m = market[sym]; if (!m) return;
    var first = (m.open24h == null || m.open24h === 0 || m.open24h === m.meta.price);
    if (first) { m.open24h = p; m.dayHigh = p; m.dayLow = p; }
    m.lastUp = p >= (m.price || p);
    m.price = p;
    if (p > m.dayHigh) m.dayHigh = p;
    if (p < m.dayLow) m.dayLow = p;
    m.src = "hl"; m.live = true;
    if (sym === currentSymbol) { renderTicker(); renderOrderBook(); }
  }
  function applyBook(data) {
    if (!data || coinOf(currentSymbol) !== data.coin) return;
    var m = market[currentSymbol];
    var asks = ((data.levels && data.levels[0]) || []).slice(0, 8).map(function (x) { return { px: +x.px, sz: +x.sz }; });
    var bids = ((data.levels && data.levels[1]) || []).slice(0, 8).map(function (x) { return { px: +x.px, sz: +x.sz }; });
    m.liveBook = { asks: asks, bids: bids };
    renderOrderBook();
  }
  function applyCtx(data) {
    if (!data || !data.coin) return;
    var m = market[data.coin + "-PERP"];
    if (m && data.ctx && data.ctx.funding != null) m.funding = parseFloat(data.ctx.funding);
  }
  function resubscribeBook() {
    if (_ws && _ws.readyState === 1) {
      try { _ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "l2Book", coin: coinOf(currentSymbol) } })); } catch (e) {}
    }
  }
  function startStockPoll() {
    if (_stockPoll || !canFetch()) return;
    _stockPoll = setInterval(function () {
      var m = market[currentSymbol];
      if (!m || m.meta.cat !== "us" || !CONFIG.STOCK_PROXY_URL) return;
      fetch(CONFIG.STOCK_PROXY_URL + "/quote?symbol=" + encodeURIComponent(currentSymbol))
        .then(function (r) { return r.json(); }).then(function (d) {
          if (d.price == null) return;
          var p = +d.price, mm = market[currentSymbol];
          mm.lastUp = p >= (mm.price || p); mm.price = p;
          if (mm.open24h == null || mm.open24h === 0 || mm.open24h === mm.meta.price) mm.open24h = p;
          mm.dayHigh = Math.max(mm.dayHigh || p, p); mm.dayLow = Math.min(mm.dayLow || p, p);
          mm.src = "proxy"; mm.live = true; renderTicker(); renderOrderBook();
        }).catch(function () {});
    }, 4000);
  }
  function setLiveBadge(on, label) {
    var b = document.getElementById("live-badge");
    if (!b) return;
    b.hidden = !on;
    if (label) b.textContent = label;
  }

  function stepMarket() {
    ASSETS.forEach(function (a) {
      var m = market[a.symbol];
      if (m.live) return; // live symbols are driven by WS / proxy, not simulated
      // occasionally shift drift to create trends
      if (Math.random() < 0.01) m.drift = rand(-0.00008, 0.00008);
      var shock = rand(-a.vol, a.vol);
      var next = m.price * (1 + shock + m.drift);
      next = Math.max(next, a.price * 0.2);
      m.price = next;
      if (m.price > m.dayHigh) m.dayHigh = m.price;
      if (m.price < m.dayLow) m.dayLow = m.price;
      m.ticks.push(next);
      if (m.ticks.length > HISTORY_CAP) m.ticks.shift();
    });
  }

  function candlesFor(symbol, timeframe) {
    var m = market[symbol];
    if (m && m.liveCandles && m.liveCandles[timeframe] && m.liveCandles[timeframe].length) {
      return m.liveCandles[timeframe];
    }
    var bucket = { "1m": 4, "5m": 20, "15m": 60, "1h": 240 }[timeframe] || 4;
    var ticks = market[symbol].ticks;
    var bars = [];
    var start = Math.max(0, ticks.length - bucket * 140);
    for (var i = start; i < ticks.length; i += bucket) {
      var slice = ticks.slice(i, i + bucket);
      if (!slice.length) continue;
      var o = slice[0], c = slice[slice.length - 1];
      var h = Math.max.apply(null, slice), l = Math.min.apply(null, slice);
      bars.push({ o: o, h: h, l: l, c: c });
    }
    return bars.slice(-140);
  }

  // ----------------------------- Account State -----------------------------
  var state = null;       // current user's session
  var currentSymbol = "BTC-PERP";
  var currentTimeframe = "1m";
  var side = "buy";
  var orderType = "market";
  var leverage = 5;
  var selectedLeverage = 5;

  function storageKey(user) { return "omantrade_" + btoa(unescape(encodeURIComponent(user.email || "anon"))); }

  function loadState(user) {
    var raw = localStorage.getItem(storageKey(user));
    if (raw) {
      try { return JSON.parse(raw); } catch (e) {}
    }
    return {
      user: user,
      wallet: STARTING_BALANCE,
      positions: [],   // {symbol, side, notional, entry, lev}
      orders: [],      // {id, symbol, side, type, price, notional, lev}
      history: []      // {time, symbol, side, type, price, notional}
    };
  }
  function saveState() {
    if (state) localStorage.setItem(storageKey(state.user), JSON.stringify(state));
  }

  // ----------------------------- Account Math ------------------------------
  function positionFor(symbol) {
    for (var i = 0; i < state.positions.length; i++)
      if (state.positions[i].symbol === symbol) return state.positions[i];
    return null;
  }
  function unrealizedPnL(pos) {
    var m = market[pos.symbol].price;
    var dir = pos.side === "buy" ? 1 : -1;
    var base = pos.notional / pos.entry;
    return (m - pos.entry) * base * dir;
  }
  function marginUsed(pos) { return pos.notional / pos.lev; }
  function totalMargin() {
    return state.positions.reduce(function (s, p) { return s + marginUsed(p); }, 0);
  }
  function totalUnrealized() {
    return state.positions.reduce(function (s, p) { return s + unrealizedPnL(p); }, 0);
  }
  function equity() { return state.wallet + totalUnrealized(); }
  function available() { return state.wallet - totalMargin(); }
  function liqPrice(pos) {
    var inv = 1 / pos.lev;
    return pos.side === "buy" ? pos.entry * (1 - inv) : pos.entry * (1 + inv);
  }

  // ----------------------------- Order Execution ----------------------------
  function placeOrder() {
    var m = market[currentSymbol];
    var dec = m.meta.dec;
    var notional = parseFloat($("trade-size").value);
    if (!notional || notional <= 0) { toast("Enter an order size", "error"); return; }
    if (available() <= 0) { toast("Insufficient available balance", "error"); return; }

    var price = orderType === "limit"
      ? parseFloat($("trade-price").value)
      : m.price;

    if (orderType === "limit") {
      if (!price || price <= 0) { toast("Enter a valid limit price", "error"); return; }
      // resting order
      state.orders.push({
        id: "o" + Date.now() + Math.floor(Math.random() * 1000),
        symbol: currentSymbol, side: side, type: "limit",
        price: price, notional: notional, lev: selectedLeverage
      });
      saveState(); renderAll();
      toast("Limit order placed", "success");
      return;
    }

    // market order -> fill immediately at mark
    fillOrder({ symbol: currentSymbol, side: side, price: m.price, notional: notional, lev: selectedLeverage });
  }

  function fillOrder(o) {
    var pos = positionFor(o.symbol);
    var dec = market[o.symbol].meta.dec;
    if (!pos) {
      state.positions.push({
        symbol: o.symbol, side: o.side, notional: o.notional, entry: o.price, lev: o.lev
      });
    } else if (pos.side === o.side) {
      // increase: weighted average entry
      var total = pos.notional + o.notional;
      pos.entry = (pos.entry * pos.notional + o.price * o.notional) / total;
      pos.notional = total;
      pos.lev = Math.max(pos.lev, o.lev);
    } else {
      // opposite side: reduce / close / flip
      if (o.notional < pos.notional) {
        pos.notional -= o.notional;
      } else if (o.notional === pos.notional) {
        state.positions = state.positions.filter(function (p) { return p !== pos; });
      } else {
        var remaining = o.notional - pos.notional;
        state.positions = state.positions.filter(function (p) { return p !== pos; });
        state.positions.push({
          symbol: o.symbol, side: o.side, notional: remaining, entry: o.price, lev: o.lev
        });
      }
    }
    state.history.unshift({
      time: Date.now(), symbol: o.symbol, side: o.side,
      type: o.type || "market", price: o.price, notional: o.notional
    });
    if (state.history.length > 200) state.history.pop();

    saveState(); renderAll();
    toast((o.side === "buy" ? "Bought " : "Sold ") + fmtUSD(o.notional) + " " + o.symbol, "success");
  }

  function checkLiquidations() {
    var changed = false;
    state.positions = state.positions.filter(function (pos) {
      var m = market[pos.symbol].price;
      var liq = liqPrice(pos);
      var liquidated = (pos.side === "buy" && m <= liq) || (pos.side === "sell" && m >= liq);
      if (liquidated) {
        var loss = marginUsed(pos);
        state.wallet -= loss;
        state.history.unshift({ time: Date.now(), symbol: pos.symbol, side: "liquidate", type: "liq", price: m, notional: pos.notional });
        toast("⚠ " + pos.symbol + " liquidated", "error");
        changed = true;
      }
      return !liquidated;
    });
    if (changed) { saveState(); }
    return changed;
  }

  //---------------- limit fill check -------------------------
  function checkLimitFills() {
    var changed = false;
    state.orders = state.orders.filter(function (o) {
      var m = market[o.symbol].price;
      var fill = (o.side === "buy" && m <= o.price) || (o.side === "sell" && m >= o.price);
      if (fill) { fillOrder({ symbol: o.symbol, side: o.side, price: o.price, notional: o.notional, lev: o.lev, type: "limit" }); changed = true; return false; }
      return true;
    });
    if (changed) saveState();
    return changed;
  }

  function closePosition(symbol) {
    var pos = positionFor(symbol);
    if (!pos) return;
    var m = market[symbol].price;
    var pnl = unrealizedPnL(pos);
    state.wallet += pnl;
    state.history.unshift({ time: Date.now(), symbol: symbol, side: pos.side === "buy" ? "sell" : "buy", type: "close", price: m, notional: pos.notional });
    state.positions = state.positions.filter(function (p) { return p !== pos; });
    saveState(); renderAll();
    toast("Closed " + symbol + " (" + (pnl >= 0 ? "+" : "") + fmtUSD(pnl) + ")", pnl >= 0 ? "success" : "error");
  }

  function cancelOrder(id) {
    state.orders = state.orders.filter(function (o) { return o.id !== id; });
    saveState(); renderAll();
    toast("Order cancelled");
  }

  // ----------------------------- Rendering ---------------------------------
  function renderMarkets(filter) {
    var list = $("market-list");
    list.innerHTML = "";
    var f = (filter || "").toUpperCase();
    var groups = [
      { key: "crypto", title: "Crypto Perps · Hyperliquid" },
      { key: "us", title: "US Stocks · yfinance" },
      { key: "stock", title: "MSX Stocks · Oman (SIM)" }
    ];
    groups.forEach(function (grp) {
      var items = ASSETS.filter(function (a) {
        if (a.cat !== grp.key) return false;
        if (f && a.symbol.indexOf(f) < 0 && a.name.toUpperCase().indexOf(f) < 0) return false;
        return true;
      });
      if (!items.length) return;
      list.appendChild(el("div", "market-group-head", grp.title));
      items.forEach(function (a) {
        var m = market[a.symbol];
        var chg = ((m.price - m.open24h) / m.open24h) * 100;
        var row = el("div", "market-row" + (a.symbol === currentSymbol ? " active" : ""));
        row.setAttribute("role", "option");
        row.dataset.symbol = a.symbol;
        var left = el("div");
        left.appendChild(el("div", "m-name", a.symbol));
        left.appendChild(el("div", "m-sub", a.name + (a.cat === "stock" ? " · SIM" : "")));
        var right = el("div");
        right.appendChild(el("div", "m-price", fmtPrice(m.price, a.dec)));
        right.appendChild(el("div", "m-chg " + (chg >= 0 ? "green" : "red"), fmtPct(chg)));
        row.appendChild(left); row.appendChild(right);
        row.addEventListener("click", function () { selectSymbol(a.symbol); });
        list.appendChild(row);
      });
    });
  }

  function renderTicker() {
    var a = market[currentSymbol].meta;
    var m = market[currentSymbol];
    var chg = ((m.price - m.open24h) / m.open24h) * 100;
    $("ticker-name").textContent = a.symbol;
    $("ticker-price").textContent = fmtPrice(m.price, a.dec);
    var chgEl = $("ticker-change");
    chgEl.textContent = fmtPct(chg);
    chgEl.className = "ticker-change " + (chg >= 0 ? "green" : "red");
    $("ticker-stats").innerHTML =
      "<span>24h Chg <b>" + fmtPct(chg) + "</b></span>" +
      "<span>24h High <b>" + fmtPrice(m.dayHigh, a.dec) + "</b></span>" +
      "<span>24h Low <b>" + fmtPrice(m.dayLow, a.dec) + "</b></span>" +
      "<span>Vol <b>" + fmtNum(m.price * 1e6 / 1e3, 1) + "K</b></span>" +
      "<span>Funding <b class='" + (m.funding >= 0 ? "green" : "red") + "'>" + fmtPct(m.funding * 100) + "</b></span>";
  }

  function renderHeader() {
    var eq = equity(), av = available(), u = totalUnrealized();
    $("hdr-equity").textContent = fmtUSD(eq);
    $("hdr-available").textContent = fmtUSD(av);
    var pnlEl = $("hdr-pnl");
    pnlEl.textContent = (u >= 0 ? "+" : "-") + fmtUSD(Math.abs(u));
    pnlEl.className = "acct-val " + (u >= 0 ? "green" : "red");
    $("hdr-user").textContent = state.user.name || "Trader";
  }

  function renderOrderBook() {
    var m = market[currentSymbol];
    var dec = m.meta.dec;
    var mid = m.price;
    var asks = $("ob-asks"), bids = $("ob-bids");
    asks.innerHTML = ""; bids.innerHTML = "";
    var live = (m.liveBook && m.liveBook.asks && m.liveBook.asks.length) ? m.liveBook : null;
    var maxTotal = 0, levels = [];
    if (live) {
      live.asks.forEach(function (l) { levels.push({ side: "ask", px: +l.px, sz: +l.sz }); });
      live.bids.forEach(function (l) { levels.push({ side: "bid", px: +l.px, sz: +l.sz }); });
    } else {
      var spread = mid * 0.0004, step = mid * 0.0008;
      for (var i = 1; i <= 8; i++) {
        levels.push({ side: "ask", px: mid + spread + step * i, sz: rand(0.4, 6) * (1 + (11 - i) * 0.05) });
        levels.push({ side: "bid", px: mid - spread - step * (i - 1), sz: rand(0.4, 6) * (1 + (11 - i) * 0.05) });
      }
    }
    levels.forEach(function (l) { maxTotal = Math.max(maxTotal, l.sz); });
    var asksData = levels.filter(function (l) { return l.side === "ask"; });
    var bidsData = levels.filter(function (l) { return l.side === "bid"; });
    function row(l, total) {
      var r = el("div", "ob-row");
      var depth = el("span", "ob-depth");
      depth.style.width = (total / maxTotal * 100) + "%";
      r.appendChild(depth);
      r.appendChild(el("span", null, fmtPrice(l.px, dec)));
      r.appendChild(el("span", null, fmtNum(l.sz, 3)));
      r.appendChild(el("span", null, fmtNum(total, 2)));
      return r;
    }
    var at = 0, bt = 0;
    asksData.slice().reverse().forEach(function (l) { at += l.sz; asks.appendChild(row(l, at)); });
    bidsData.forEach(function (l) { bt += l.sz; bids.appendChild(row(l, bt)); });
    $("ob-mid").textContent = fmtPrice(mid, dec);
    $("ob-mid").className = "ob-mid " + (m.lastUp ? "green" : "red");
  }

  function renderPositions() {
    var body = $("positions-body");
    body.innerHTML = "";
    if (!state.positions.length) {
      body.appendChild(el("tr", "empty", "").appendChild(el("td")).parentNode);
      body.querySelector("td").setAttribute("colspan", "7");
      body.querySelector("td").textContent = "No open positions";
      return;
    }
    state.positions.forEach(function (pos) {
      var a = market[pos.symbol].meta;
      var m = market[pos.symbol].price;
      var upnl = unrealizedPnL(pos);
      var tr = el("tr");
      tr.appendChild(el("td", null, pos.symbol));
      tr.appendChild(el("td", null, (pos.side === "buy" ? "L " : "S ") + fmtUSD(pos.notional)));
      tr.appendChild(el("td", null, fmtPrice(pos.entry, a.dec)));
      tr.appendChild(el("td", null, fmtPrice(m, a.dec)));
      tr.appendChild(el("td", null, fmtPrice(liqPrice(pos), a.dec)));
      var pnlTd = el("td", upnl >= 0 ? "green" : "red", (upnl >= 0 ? "+" : "") + fmtUSD(upnl));
      tr.appendChild(pnlTd);
      var act = el("td");
      var btn = el("button", "btn-close-pos", "Close");
      btn.addEventListener("click", function () { closePosition(pos.symbol); });
      act.appendChild(btn); tr.appendChild(act);
      body.appendChild(tr);
    });
  }

  function renderOrders() {
    var body = $("orders-body");
    body.innerHTML = "";
    if (!state.orders.length) {
      body.appendChild(el("tr", "empty", "").appendChild(el("td")).parentNode);
      body.querySelector("td").setAttribute("colspan", "6");
      body.querySelector("td").textContent = "No open orders";
      return;
    }
    state.orders.forEach(function (o) {
      var a = market[o.symbol].meta;
      var tr = el("tr");
      tr.appendChild(el("td", null, o.symbol));
      tr.appendChild(el("td", o.side === "buy" ? "green" : "red", o.side === "buy" ? "Buy" : "Sell"));
      tr.appendChild(el("td", null, "Limit"));
      tr.appendChild(el("td", null, fmtPrice(o.price, a.dec)));
      tr.appendChild(el("td", null, fmtUSD(o.notional)));
      var act = el("td");
      var btn = el("button", "btn-cancel", "Cancel");
      btn.addEventListener("click", function () { cancelOrder(o.id); });
      act.appendChild(btn); tr.appendChild(act);
      body.appendChild(tr);
    });
  }

  function renderHistory() {
    var body = $("history-body");
    body.innerHTML = "";
    if (!state.history.length) {
      body.appendChild(el("tr", "empty", "").appendChild(el("td")).parentNode);
      body.querySelector("td").setAttribute("colspan", "6");
      body.querySelector("td").textContent = "No trades yet";
      return;
    }
    state.history.slice(0, 60).forEach(function (h) {
      var a = market[h.symbol].meta;
      var tr = el("tr");
      tr.appendChild(el("td", null, fmtTime(h.time)));
      tr.appendChild(el("td", null, h.symbol));
      var sideTxt = h.side === "buy" ? "Buy" : h.side === "sell" ? "Sell" : h.side === "liquidate" ? "LIQ" : "Close";
      tr.appendChild(el("td", h.side === "sell" || h.side === "liquidate" ? "red" : "green", sideTxt));
      tr.appendChild(el("td", null, h.type === "limit" ? "Limit" : h.type === "liq" ? "Liq" : h.type === "close" ? "Close" : "Market"));
      tr.appendChild(el("td", null, fmtPrice(h.price, a.dec)));
      tr.appendChild(el("td", null, fmtUSD(h.notional)));
      body.appendChild(tr);
    });
  }

  function renderTradePanel() {
    var sym = currentSymbol;
    var m = market[sym];
    var dec = m.meta.dec;
    var catLabel = m.meta.cat === "stock"
      ? "<b>MSX Stock</b>"
      : m.meta.cat === "us"
        ? "<b>US Stock</b>"
        : "<b>Perpetual Futures</b>";
    $("perp-tag").innerHTML = sym + " · " + catLabel;
    var submit = $("trade-submit");
    submit.textContent = (side === "buy" ? "Buy / Long " : "Sell / Short ") + sym;
    submit.style.background = side === "buy"
      ? "linear-gradient(180deg,#34d399,#10b981)"
      : "linear-gradient(180deg,#fb7185,#ef4444)";
    submit.style.color = "#08130d";
    $("trade-info").textContent = "Available: " + fmtUSD(available());
    if (orderType === "limit") {
      $("trade-price").disabled = false;
      $("price-field").style.opacity = "1";
      if (!$("trade-price").value) $("trade-price").value = m.price.toFixed(dec);
    } else {
      $("trade-price").disabled = true;
      $("price-field").style.opacity = "0.5";
      $("trade-price").value = "";
    }
    updateOrderSummary();
  }

  function updateOrderSummary() {
    var m = market[currentSymbol];
    var dec = m.meta.dec;
    var size = parseFloat($("trade-size").value) || 0;
    var price = orderType === "limit" && parseFloat($("trade-price").value)
      ? parseFloat($("trade-price").value) : m.price;
    var base = size / price;
    var margin = size / selectedLeverage;
    var liq = size > 0 ? price * (1 - (side === "buy" ? 1 : -1) / selectedLeverage) : null;
    $("trade-base").textContent = "≈ " + fmtNum(base, dec + 2) + " " + currentSymbol.split("-")[0];
    $("os-value").textContent = fmtUSD(size);
    $("os-margin").textContent = fmtUSD(margin);
    $("os-liq").textContent = liq ? fmtPrice(liq, dec) : "—";
  }

  function renderAll() {
    renderMarkets($("market-search").value);
    renderTicker();
    renderHeader();
    renderOrderBook();
    renderPositions();
    renderOrders();
    renderHistory();
    renderTradePanel();
    drawChart();
  }

  // ----------------------------- Chart (multi-tile) ------------------------
  var charts = [];          // tiles: {id, symbol, tf, showMA, showBB, showRSI, canvas, ctx, el}
  var activeChart = 0;
  var chartSeq = 0;
  var castChannel = (typeof BroadcastChannel !== "undefined") ? new BroadcastChannel("omantrade-cast") : null;

  function setupChart() {
    initCharts();
    window.addEventListener("resize", resizeCharts);
  }
  function initCharts() {
    charts = [];
    addChart(currentSymbol, currentTimeframe, true);
  }
  function addChart(sym, tf, active) {
    if (charts.length >= 4) return null;
    var tile = { id: ++chartSeq, symbol: sym || currentSymbol, tf: tf || currentTimeframe, showMA: true, showBB: false, showRSI: false, canvas: null, ctx: null, el: null };
    charts.push(tile);
    renderChartsGrid();
    buildTileEl(tile);
    resizeCharts();
    if (active) selectTile(tile.id, false);
    return tile;
  }
  function removeChart(id) {
    if (charts.length <= 1) return;
    var idx = charts.findIndex(function (c) { return c.id === id; });
    if (idx < 0) return;
    var el = charts[idx].el; if (el && el.parentNode) el.parentNode.removeChild(el);
    charts.splice(idx, 1);
    if (activeChart === id) {
      activeChart = charts[Math.min(idx, charts.length - 1)].id;
      var at = charts.find(function (c) { return c.id === activeChart; });
      currentSymbol = at.symbol; currentTimeframe = at.tf;
    }
    renderChartsGrid(); resizeCharts();
    charts.forEach(function (c) { if (c.el) c.el.classList.toggle("active", c.id === activeChart); });
    syncLayoutButtons();
    renderTicker(); renderOrderBook(); renderTradePanel(); drawChart();
  }
  function setTileCount(n) {
    n = clamp(n, 1, 4);
    while (charts.length < n) addChart(currentSymbol, currentTimeframe, false);
    while (charts.length > n) {
      var last = charts[charts.length - 1];
      if (last.el && last.el.parentNode) last.el.parentNode.removeChild(last.el);
      charts.pop();
    }
    renderChartsGrid(); resizeCharts(); syncLayoutButtons(); drawChart();
  }
  function syncLayoutButtons() {
    document.querySelectorAll(".ct-layout button").forEach(function (b) { b.classList.toggle("active", +b.dataset.layout === charts.length); });
  }
  function renderChartsGrid() {
    var grid = $("charts-grid"); if (!grid) return;
    grid.className = "charts-grid layout-" + charts.length;
  }
  function buildTileEl(tile) {
    var grid = $("charts-grid");
    var el = document.createElement("div");
    el.className = "chart-tile";
    el.dataset.id = tile.id;
    var opts = ASSETS.map(function (a) {
      return '<option value="' + a.symbol + '"' + (a.symbol === tile.symbol ? " selected" : "") + ">" + a.symbol + " · " + a.name + "</option>";
    }).join("");
    el.innerHTML =
      '<div class="tile-head">' +
        '<select class="tile-symbol" aria-label="Symbol">' + opts + "</select>" +
        '<div class="tile-tf">' +
          '<button data-tf="1m"' + (tile.tf === "1m" ? ' class="active"' : "") + ">1m</button>" +
          '<button data-tf="5m"' + (tile.tf === "5m" ? ' class="active"' : "") + ">5m</button>" +
          '<button data-tf="15m"' + (tile.tf === "15m" ? ' class="active"' : "") + ">15m</button>" +
          '<button data-tf="1h"' + (tile.tf === "1h" ? ' class="active"' : "") + ">1h</button>" +
        "</div>" +
        '<div class="tile-ind">' +
          '<button data-ind="ma"' + (tile.showMA ? ' class="active"' : "") + ">MA</button>" +
          '<button data-ind="bb"' + (tile.showBB ? ' class="active"' : "") + ">BB</button>" +
          '<button data-ind="rsi"' + (tile.showRSI ? ' class="active"' : "") + ">RSI</button>" +
        "</div>" +
        (charts.length > 1 ? '<button class="tile-close" title="Close chart">×</button>' : "") +
      "</div>" +
      '<div class="tile-body"><canvas class="tile-canvas"></canvas></div>';
    grid.appendChild(el);
    tile.el = el;
    tile.canvas = el.querySelector(".tile-canvas");
    tile.ctx = tile.canvas.getContext("2d");
    el.addEventListener("click", function () { selectTile(tile.id, true); });
    el.querySelector(".tile-symbol").addEventListener("change", function (e) {
      tile.symbol = e.target.value;
      if (activeChart === tile.id) {
        currentSymbol = tile.symbol;
        if (market[tile.symbol].meta.cat === "crypto") resubscribeBook();
        renderTicker(); renderOrderBook();
      }
      loadHistory(tile.symbol, tile.tf); drawChart();
    });
    el.querySelectorAll(".tile-tf button").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        tile.tf = b.dataset.tf;
        el.querySelectorAll(".tile-tf button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        if (activeChart === tile.id) currentTimeframe = tile.tf;
        loadHistory(tile.symbol, tile.tf); drawChart();
      });
    });
    el.querySelectorAll(".tile-ind button").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (b.dataset.ind === "ma") tile.showMA = !tile.showMA;
        if (b.dataset.ind === "bb") tile.showBB = !tile.showBB;
        if (b.dataset.ind === "rsi") tile.showRSI = !tile.showRSI;
        b.classList.toggle("active", b.dataset.ind === "ma" ? tile.showMA : b.dataset.ind === "bb" ? tile.showBB : tile.showRSI);
        drawChart();
      });
    });
    var closeBtn = el.querySelector(".tile-close");
    if (closeBtn) closeBtn.addEventListener("click", function (ev) { ev.stopPropagation(); removeChart(tile.id); });
  }
  function selectTile(id, syncTrade) {
    activeChart = id;
    var t = charts.find(function (c) { return c.id === id; });
    if (!t) return;
    currentSymbol = t.symbol; currentTimeframe = t.tf;
    charts.forEach(function (c) { if (c.el) c.el.classList.toggle("active", c.id === id); });
    if (syncTrade) { renderTicker(); renderOrderBook(); renderTradePanel(); }
    drawChart();
  }
  function resizeCharts() {
    charts.forEach(function (t) {
      if (!t.canvas) return;
      var dpr = window.devicePixelRatio || 1;
      var w = t.canvas.clientWidth, h = t.canvas.clientHeight;
      if (w === 0 || h === 0) return;
      t.canvas.width = w * dpr; t.canvas.height = h * dpr;
      t.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    drawChart();
  }
  function broadcastCast() {
    if (!castChannel) return;
    try {
      var payload = { type: "tiles", tiles: charts.map(function (t) {
        var m = market[t.symbol];
        var bars = (m.liveCandles && m.liveCandles[t.tf]) || candlesFor(t.symbol, t.tf);
        return { symbol: t.symbol, name: (m.meta && m.meta.name) || t.symbol, tf: t.tf, showMA: t.showMA, showBB: t.showBB, showRSI: t.showRSI, dec: (m.meta && m.meta.dec) || 2, price: m.price, candles: bars };
      }) };
      castChannel.postMessage(payload);
    } catch (e) {}
  }
  function castToTV() {
    var syms = charts.map(function (t) { return t.symbol; }).join(",");
    var tfs = charts.map(function (t) { return t.tf; }).join(",");
    var url = "tv.html?symbols=" + encodeURIComponent(syms) + "&tfs=" + encodeURIComponent(tfs);
    try {
      if (navigator.presentation && navigator.presentation.requestSession) {
        navigator.presentation.requestSession(url).catch(function () { window.open(url, "omantrade_tv"); });
        toast("Presenting… use your TV/Chromecast to receive the session");
        return;
      }
    } catch (e) {}
    window.open(url, "omantrade_tv", "fullscreen=yes");
    toast("TV view opened — cast this tab via your browser (Chromecast/AirPlay) or HDMI");
  }

  // ---- TA indicator math (computed from candle closes) ----
  function sma(arr, n) {
    var out = [], sum = 0;
    for (var i = 0; i < arr.length; i++) {
      sum += arr[i];
      if (i >= n) sum -= arr[i - n];
      out.push(i >= n - 1 ? sum / n : null);
    }
    return out;
  }
  function ema(arr, n) {
    var out = [], k = 2 / (n + 1), prev = arr[0];
    for (var i = 0; i < arr.length; i++) {
      prev = i === 0 ? arr[0] : arr[i] * k + prev * (1 - k);
      out.push(i >= n - 1 ? prev : null);
    }
    return out;
  }
  function bollinger(arr, n, mult) {
    var mid = sma(arr, n), up = [], lo = [];
    for (var i = 0; i < arr.length; i++) {
      if (mid[i] == null) { up.push(null); lo.push(null); continue; }
      var s = 0, c = 0;
      for (var j = i - n + 1; j <= i; j++) { if (j >= 0) { var d = arr[j] - mid[i]; s += d * d; c++; } }
      var sd = Math.sqrt(s / c);
      up.push(mid[i] + mult * sd); lo.push(mid[i] - mult * sd);
    }
    return { mid: mid, upper: up, lower: lo };
  }
  function rsi(arr, n) {
    var gains = [], losses = [];
    for (var i = 0; i < arr.length; i++) {
      if (i === 0) { gains.push(0); losses.push(0); continue; }
      var ch = arr[i] - arr[i - 1];
      gains.push(ch > 0 ? ch : 0); losses.push(ch < 0 ? -ch : 0);
    }
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      if (i < n) { out.push(null); continue; }
      var g = 0, l = 0;
      for (var j = i - n + 1; j <= i; j++) { g += gains[j]; l += losses[j]; }
      g /= n; l /= n;
      if (l === 0) out.push(100);
      else { var rs = g / l; out.push(100 - 100 / (1 + rs)); }
    }
    return out;
  }

  function drawChart() {
    charts.forEach(function (t) { drawTile(t); });
    broadcastCast();
  }
  function drawTile(tile) {
    var canvas = tile.canvas, ctx = tile.ctx;
    if (!canvas || !ctx) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);
    var bars = candlesFor(tile.symbol, tile.tf);
    if (!bars.length) return;
    var dec = market[tile.symbol].meta.dec;
    var padR = 58, padT = 10, padB = 14;
    var rsiH = tile.showRSI ? Math.round(h * 0.22) : 0;
    var plotW = w - padR;
    var plotH = h - padT - padB - (rsiH ? rsiH + 10 : 0);

    var closes = bars.map(function (b) { return b.c; });
    var ma = tile.showMA ? { sma: sma(closes, 7), ema: ema(closes, 12) } : null;
    var bb = tile.showBB ? bollinger(closes, 20, 2) : null;
    var rsiArr = tile.showRSI ? rsi(closes, 14) : null;

    var hi = -Infinity, lo = Infinity;
    bars.forEach(function (b) { hi = Math.max(hi, b.h); lo = Math.min(lo, b.l); });
    function span(arr) { arr.forEach(function (v) { if (v != null) { hi = Math.max(hi, v); lo = Math.min(lo, v); } }); }
    if (ma) { span(ma.sma); span(ma.ema); }
    if (bb) { span(bb.upper); span(bb.lower); }
    var range = hi - lo || 1; lo -= range * 0.05; hi += range * 0.05; range = hi - lo;

    function y(p) { return padT + (1 - (p - lo) / range) * plotH; }
    function x(i) { return (i + 0.5) / bars.length * plotW; }
    function line(arr, color, width, dash) {
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.setLineDash(dash ? [4, 3] : []); ctx.beginPath();
      var started = false;
      bars.forEach(function (b, i) { var v = arr[i]; if (v == null) return; var xx = x(i), yy = y(v); if (!started) { ctx.moveTo(xx, yy); started = true; } else ctx.lineTo(xx, yy); });
      ctx.stroke(); ctx.setLineDash([]);
    }

    ctx.strokeStyle = "#1b2030"; ctx.fillStyle = "#5c6373"; ctx.font = "10px monospace"; ctx.lineWidth = 1;
    for (var g = 0; g <= 5; g++) {
      var p = lo + range * g / 5; var yy = y(p);
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(plotW, yy); ctx.stroke();
      ctx.fillText(fmtPrice(p, dec), plotW + 4, yy + 3);
    }

    var cw = Math.max(1.5, plotW / bars.length * 0.6);
    bars.forEach(function (b, i) {
      var up = b.c >= b.o, col = up ? "#2ebd85" : "#f6465d";
      ctx.strokeStyle = col; ctx.fillStyle = col;
      var xx = x(i);
      ctx.beginPath(); ctx.moveTo(xx, y(b.h)); ctx.lineTo(xx, y(b.l)); ctx.stroke();
      var yo = y(b.o), yc = y(b.c);
      var top = Math.min(yo, yc), bh = Math.max(1, Math.abs(yc - yo));
      ctx.fillRect(xx - cw / 2, top, cw, bh);
    });

    if (bb) {
      ctx.fillStyle = "rgba(59,130,246,0.07)";
      ctx.beginPath(); var started = false;
      bars.forEach(function (b, i) { if (bb.upper[i] == null) return; var xx = x(i), yy = y(bb.upper[i]); if (!started) { ctx.moveTo(xx, yy); started = true; } else ctx.lineTo(xx, yy); });
      for (var k = bars.length - 1; k >= 0; k--) { if (bb.lower[k] == null) continue; ctx.lineTo(x(k), y(bb.lower[k])); }
      ctx.closePath(); ctx.fill();
      line(bb.upper, "#3b82f6", 1); line(bb.mid, "#3b82f6", 1, true); line(bb.lower, "#3b82f6", 1);
    }
    if (ma) { line(ma.sma, "#f0b90b", 1.4); line(ma.ema, "#e879f9", 1.4); }

    var last = bars[bars.length - 1].c, ly = y(last);
    ctx.strokeStyle = "#f0b90b"; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(plotW, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#f0b90b"; ctx.fillRect(plotW, ly - 8, padR, 16);
    ctx.fillStyle = "#1a1400"; ctx.font = "bold 10px monospace";
    ctx.fillText(fmtPrice(last, dec), plotW + 4, ly + 3);

    if (tile.showRSI && rsiArr) {
      var rTop = padT + plotH + 10, rBot = rTop + rsiH;
      ctx.fillStyle = "#0d0f15"; ctx.fillRect(0, rTop, plotW, rsiH);
      [30, 50, 70].forEach(function (lv) {
        var yy = rBot - (lv / 100) * rsiH;
        ctx.strokeStyle = lv === 50 ? "#1b2030" : "rgba(246,70,93,0.25)";
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(plotW, yy); ctx.stroke();
        ctx.fillStyle = "#5c6373"; ctx.fillText(String(lv), plotW + 4, yy + 3);
      });
      ctx.strokeStyle = "#f0b90b"; ctx.lineWidth = 1.4; ctx.beginPath();
      var started2 = false;
      bars.forEach(function (b, i) { if (rsiArr[i] == null) return; var xx = x(i), yy = rBot - (rsiArr[i] / 100) * rsiH; if (!started2) { ctx.moveTo(xx, yy); started2 = true; } else ctx.lineTo(xx, yy); });
      ctx.stroke();
      ctx.fillStyle = "#8b91a3"; ctx.font = "10px monospace"; ctx.fillText("RSI(14)", 6, rTop + 12);
    }
  }

  // ----------------------------- Interaction -------------------------------
  function selectSymbol(sym) {
    currentSymbol = sym;
    var at = charts.find(function (c) { return c.id === activeChart; });
    if (at) {
      at.symbol = sym;
      if (at.el) { var sel = at.el.querySelector(".tile-symbol"); if (sel) sel.value = sym; }
    }
    loadHistory(sym, currentTimeframe);
    if (market[sym].meta.cat === "crypto") resubscribeBook();
    renderAll();
  }

  function bindEvents() {
    // login
    $("login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("login-name").value.trim();
      var email = $("login-email").value.trim();
      var err = $("login-error");
      if (!name || !email) {
        err.textContent = "Please enter your name and university email.";
        err.hidden = false; return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        err.textContent = "Please enter a valid email address.";
        err.hidden = false; return;
      }
      err.hidden = true;
      var user = { name: name, email: email, studentId: $("login-id").value.trim() };
      state = loadState(user);
      enterApp();
    });

    $("year").textContent = new Date().getFullYear();

    // markets search
    $("market-search").addEventListener("input", function () { renderMarkets(this.value); });

    // tabs
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
      t.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("active"); });
        document.querySelectorAll(".tab-pane").forEach(function (x) { x.classList.remove("active"); });
        t.classList.add("active");
        $("pane-" + t.dataset.tab).classList.add("active");
      });
    });

    // charts toolbar: add chart / layout / cast
    $("add-chart").addEventListener("click", function () {
      if (charts.length >= 4) { toast("Maximum 4 charts"); return; }
      setTileCount(charts.length + 1);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".ct-layout button"), function (b) {
      b.addEventListener("click", function () { setTileCount(+b.dataset.layout); });
    });
    $("cast-tv").addEventListener("click", castToTV);

    // side / type toggles
    $("side-buy").addEventListener("click", function () { side = "buy"; setToggle("side"); renderTradePanel(); });
    $("side-sell").addEventListener("click", function () { side = "sell"; setToggle("side"); renderTradePanel(); });
    $("type-market").addEventListener("click", function () { orderType = "market"; setToggle("type"); renderTradePanel(); });
    $("type-limit").addEventListener("click", function () { orderType = "limit"; setToggle("type"); renderTradePanel(); });

    // leverage
    Array.prototype.forEach.call(document.querySelectorAll("#lev-options button"), function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll("#lev-options button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        selectedLeverage = parseInt(b.dataset.lev, 10);
      });
    });

    // quick size
    Array.prototype.forEach.call(document.querySelectorAll("#quick-size button"), function (b) {
      b.addEventListener("click", function () {
        var pct = parseInt(b.dataset.pct, 10) / 100;
        $("trade-size").value = (available() * pct).toFixed(2);
      });
    });

    $("trade-submit").addEventListener("click", placeOrder);
    $("trade-size").addEventListener("input", updateOrderSummary);
    $("trade-price").addEventListener("input", updateOrderSummary);

    // logout + reset
    $("logout-btn").addEventListener("click", logout);
    $("reset-btn").addEventListener("click", function () {
      if (!confirm("Reset your simulation account to $10,000 and clear all positions/orders?")) return;
      state.wallet = STARTING_BALANCE;
      state.positions = []; state.orders = []; state.history = [];
      saveState(); renderAll();
      toast("Account reset to $10,000", "success");
    });
  }

  function setToggle(group) {
    if (group === "side") {
      $("side-buy").classList.toggle("active", side === "buy");
      $("side-sell").classList.toggle("active", side === "sell");
    } else {
      $("type-market").classList.toggle("active", orderType === "market");
      $("type-limit").classList.toggle("active", orderType === "limit");
    }
  }

  function enterApp() {
    var ls = $("login-screen");
    ls.hidden = true;
    ls.style.display = "none";   // belt-and-suspenders: never overlay the app
    $("app").hidden = false;
    $("app").style.display = "";
    setupChart();
    startLive();
    loadHistory(currentSymbol, currentTimeframe);
    renderAll();
    resizeCharts();
  }

  function logout() {
    saveState();
    state = null;
    $("app").hidden = true;
    $("app").style.display = "none";
    var ls = $("login-screen");
    ls.hidden = false;
    ls.style.display = "";
    $("login-form").reset();
  }

  // ----------------------------- Main Loop ---------------------------------
  function tick() {
    stepMarket();
    if (state) {
      checkLimitFills();
      checkLiquidations();
      renderAll();
    } else {
      // still animate login markets list if visible
      renderMarkets($("market-search").value);
    }
  }

  // ----------------------------- Boot --------------------------------------
  bindEvents();
  setInterval(tick, TICK_MS);
  // initial paint of market list behind login for life
  renderMarkets("");
})();
