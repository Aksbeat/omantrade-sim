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

  // Simulated markets (base prices are illustrative, not live feeds)
  var ASSETS = [
    { symbol: "BTC-PERP",  name: "Bitcoin",   price: 64800,  vol: 0.0016, dec: 1 },
    { symbol: "ETH-PERP",  name: "Ethereum",  price: 3380,   vol: 0.0020, dec: 2 },
    { symbol: "SOL-PERP",  name: "Solana",    price: 148.2,  vol: 0.0030, dec: 2 },
    { symbol: "BNB-PERP",  name: "BNB",       price: 585,    vol: 0.0022, dec: 2 },
    { symbol: "XRP-PERP",  name: "XRP",       price: 0.582,  vol: 0.0030, dec: 4 },
    { symbol: "ADA-PERP",  name: "Cardano",   price: 0.461,  vol: 0.0032, dec: 4 },
    { symbol: "DOGE-PERP", name: "Dogecoin",  price: 0.1234, vol: 0.0040, dec: 5 },
    { symbol: "AVAX-PERP", name: "Avalanche", price: 36.1,   vol: 0.0030, dec: 2 },
    { symbol: "LINK-PERP", name: "Chainlink", price: 14.25,  vol: 0.0032, dec: 3 },
    { symbol: "MATIC-PERP",name: "Polygon",   price: 0.724,  vol: 0.0034, dec: 4 }
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

  function stepMarket() {
    ASSETS.forEach(function (a) {
      var m = market[a.symbol];
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
    ASSETS.forEach(function (a) {
      if (f && a.symbol.indexOf(f) < 0 && a.name.toUpperCase().indexOf(f) < 0) return;
      var m = market[a.symbol];
      var chg = ((m.price - m.open24h) / m.open24h) * 100;
      var row = el("div", "market-row" + (a.symbol === currentSymbol ? " active" : ""));
      row.setAttribute("role", "option");
      row.dataset.symbol = a.symbol;
      var left = el("div");
      left.appendChild(el("div", "m-name", a.symbol));
      left.appendChild(el("div", "m-sub", a.name));
      var right = el("div");
      right.appendChild(el("div", "m-price", fmtPrice(m.price, a.dec)));
      right.appendChild(el("div", "m-chg " + (chg >= 0 ? "green" : "red"), fmtPct(chg)));
      row.appendChild(left); row.appendChild(right);
      row.addEventListener("click", function () { selectSymbol(a.symbol); });
      list.appendChild(row);
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
    var spread = mid * 0.0004;
    var step = mid * 0.0008;
    var asks = $("ob-asks"), bids = $("ob-bids");
    asks.innerHTML = ""; bids.innerHTML = "";
    var maxTotal = 0;
    var levels = [];
    for (var i = 1; i <= 8; i++) {
      var aPx = mid + spread + step * i;
      var bPx = mid - spread - step * (i - 1);
      var aSz = rand(0.4, 6) * (1 + (11 - i) * 0.05);
      var bSz = rand(0.4, 6) * (1 + (11 - i) * 0.05);
      levels.push({ side: "ask", px: aPx, sz: aSz });
      levels.push({ side: "bid", px: bPx, sz: bSz });
      maxTotal = Math.max(maxTotal, aSz * i, bSz * i);
    }
    // asks rendered bottom-up so best ask is nearest mid (top of asks block)
    var asksData = levels.filter(function (l) { return l.side === "ask"; }).reverse();
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
    asksData.forEach(function (l) { at += l.sz; asks.appendChild(row(l, at)); });
    bidsData.forEach(function (l) { bt += l.sz; bids.appendChild(row(l, bt)); });
    $("ob-mid").textContent = fmtPrice(mid, dec);
    $("ob-mid").className = "ob-mid " + (Math.random() > 0.5 ? "green" : "red");
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
    $("perp-tag").innerHTML = sym + " · <b>Perpetual Futures</b>";
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

  // ----------------------------- Chart -------------------------------------
  var chartCanvas = null, chartCtx = null;
  function setupChart() {
    chartCanvas = $("chart");
    chartCtx = chartCanvas.getContext("2d");
    window.addEventListener("resize", drawChart);
  }
  function drawChart() {
    if (!chartCanvas) return;
    var dpr = window.devicePixelRatio || 1;
    var w = chartCanvas.clientWidth, h = chartCanvas.clientHeight;
    if (w === 0 || h === 0) return;
    chartCanvas.width = w * dpr; chartCanvas.height = h * dpr;
    chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var ctx = chartCtx;
    ctx.clearRect(0, 0, w, h);

    var bars = candlesFor(currentSymbol, currentTimeframe);
    if (!bars.length) return;
    var padR = 58, padT = 10, padB = 16;
    var plotW = w - padR, plotH = h - padT - padB;

    var hi = -Infinity, lo = Infinity;
    bars.forEach(function (b) { hi = Math.max(hi, b.h); lo = Math.min(lo, b.l); });
    var range = hi - lo || 1; lo -= range * 0.05; hi += range * 0.05; range = hi - lo;
    var dec = market[currentSymbol].meta.dec;

    function y(p) { return padT + (1 - (p - lo) / range) * plotH; }
    function x(i) { return (i + 0.5) / bars.length * plotW; }

    // grid + price axis
    ctx.strokeStyle = "#1b2030"; ctx.fillStyle = "#5c6373"; ctx.font = "10px monospace"; ctx.lineWidth = 1;
    var lines = 5;
    for (var g = 0; g <= lines; g++) {
      var p = lo + range * g / lines;
      var yy = y(p);
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(plotW, yy); ctx.stroke();
      ctx.fillText(fmtPrice(p, dec), plotW + 4, yy + 3);
    }

    // candles
    var cw = Math.max(1.5, plotW / bars.length * 0.6);
    bars.forEach(function (b, i) {
      var up = b.c >= b.o;
      var col = up ? "#2ebd85" : "#f6465d";
      ctx.strokeStyle = col; ctx.fillStyle = col;
      var xx = x(i);
      ctx.beginPath(); ctx.moveTo(xx, y(b.h)); ctx.lineTo(xx, y(b.l)); ctx.stroke();
      var yo = y(b.o), yc = y(b.c);
      var top = Math.min(yo, yc), bh = Math.max(1, Math.abs(yc - yo));
      ctx.fillRect(xx - cw / 2, top, cw, bh);
    });

    // last price line
    var last = bars[bars.length - 1].c;
    var ly = y(last);
    ctx.strokeStyle = "#f0b90b"; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(plotW, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#f0b90b";
    ctx.fillRect(plotW, ly - 8, padR, 16);
    ctx.fillStyle = "#1a1400"; ctx.font = "bold 10px monospace";
    ctx.fillText(fmtPrice(last, dec), plotW + 4, ly + 3);
  }

  // ----------------------------- Interaction -------------------------------
  function selectSymbol(sym) { currentSymbol = sym; renderAll(); }

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

    // chart interval
    Array.prototype.forEach.call(document.querySelectorAll("#chart-interval button"), function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll("#chart-interval button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        currentTimeframe = b.dataset.tf;
        drawChart();
      });
    });

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
    renderAll();
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
