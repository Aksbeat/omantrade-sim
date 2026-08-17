(function () {
  var grid = document.getElementById("tv-grid");
  var wait = document.getElementById("tv-wait");
  var channel = (typeof BroadcastChannel !== "undefined") ? new BroadcastChannel("omantrade-cast") : null;
  var tiles = {}; // symbol -> {el, canvas, ctx, head, price, data}

  function layout(n) {
    var cls = n === 1 ? "1fr" : n <= 2 ? "1fr 1fr" : "1fr 1fr";
    var rows = n <= 1 ? "1fr" : n <= 2 ? "1fr" : "1fr 1fr";
    grid.style.gridTemplateColumns = cls;
    grid.style.gridTemplateRows = rows;
  }

  function ensureTile(symbol, idx) {
    if (tiles[symbol]) return tiles[symbol];
    var el = document.createElement("div");
    el.className = "tv-tile";
    var head = document.createElement("div");
    head.className = "tv-head";
    var name = document.createElement("span");
    name.textContent = symbol;
    var price = document.createElement("span");
    price.className = "tv-price";
    head.appendChild(name); head.appendChild(price);
    var canvas = document.createElement("canvas");
    canvas.className = "tile-canvas";
    el.appendChild(head); el.appendChild(canvas);
    grid.appendChild(el);
    tiles[symbol] = { el: el, canvas: canvas, ctx: canvas.getContext("2d"), head: head, price: price, data: null };
    return tiles[symbol];
  }

  function sma(a, n) { var o = [], s = 0; for (var i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; o.push(i >= n - 1 ? s / n : null); } return o; }
  function ema(a, n) { var o = [], k = 2 / (n + 1), p = a[0]; for (var i = 0; i < a.length; i++) { p = i === 0 ? a[0] : a[i] * k + p * (1 - k); o.push(i >= n - 1 ? p : null); } return o; }
  function bollinger(a, n, m) {
    var mid = sma(a, n), up = [], lo = [];
    for (var i = 0; i < a.length; i++) {
      if (mid[i] == null) { up.push(null); lo.push(null); continue; }
      var s = 0, c = 0;
      for (var j = i - n + 1; j <= i; j++) { if (j >= 0) { var d = a[j] - mid[i]; s += d * d; c++; } }
      var sd = Math.sqrt(s / c); up.push(mid[i] + m * sd); lo.push(mid[i] - m * sd);
    }
    return { mid: mid, upper: up, lower: lo };
  }

  function draw(t) {
    var d = t.data; if (!d || !d.candles || !d.candles.length) return;
    var canvas = t.canvas, ctx = t.ctx;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var bars = d.candles, dec = d.dec || 2, showMA = d.showMA, showBB = d.showBB, showRSI = d.showRSI;
    var padR = 70, padT = 8, padB = 10, rsiH = showRSI ? Math.round(h * 0.22) : 0;
    var plotW = w - padR, plotH = h - padT - padB - (rsiH ? rsiH + 8 : 0);
    var closes = bars.map(function (b) { return b.c; });
    var ma = showMA ? { sma: sma(closes, 7), ema: ema(closes, 12) } : null;
    var bb = showBB ? bollinger(closes, 20, 2) : null;
    var hi = -Infinity, lo = Infinity;
    bars.forEach(function (b) { hi = Math.max(hi, b.h); lo = Math.min(lo, b.l); });
    function span(arr) { arr.forEach(function (v) { if (v != null) { hi = Math.max(hi, v); lo = Math.min(lo, v); } }); }
    if (ma) { span(ma.sma); span(ma.ema); }
    if (bb) { span(bb.upper); span(bb.lower); }
    var range = hi - lo || 1; lo -= range * 0.05; hi += range * 0.05; range = hi - lo;
    function y(p) { return padT + (1 - (p - lo) / range) * plotH; }
    function x(i) { return (i + 0.5) / bars.length * plotW; }
    function line(arr, color, width, dash) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash ? [4, 3] : []); ctx.beginPath();
      var started = false;
      bars.forEach(function (b, i) { var v = arr[i]; if (v == null) return; var xx = x(i), yy = y(v); if (!started) { ctx.moveTo(xx, yy); started = true; } else ctx.lineTo(xx, yy); });
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.strokeStyle = "#1b2030"; ctx.fillStyle = "#5c6373"; ctx.font = "13px monospace"; ctx.lineWidth = 1;
    for (var g = 0; g <= 5; g++) { var p = lo + range * g / 5, yy = y(p); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(plotW, yy); ctx.stroke(); ctx.fillText(p.toFixed(dec), plotW + 6, yy + 4); }
    var cw = Math.max(2, plotW / bars.length * 0.6);
    bars.forEach(function (b, i) {
      var up = b.c >= b.o, col = up ? "#2ebd85" : "#f6465d";
      ctx.strokeStyle = col; ctx.fillStyle = col; var xx = x(i);
      ctx.beginPath(); ctx.moveTo(xx, y(b.h)); ctx.lineTo(xx, y(b.l)); ctx.stroke();
      var yo = y(b.o), yc = y(b.c), top = Math.min(yo, yc), bh = Math.max(2, Math.abs(yc - yo));
      ctx.fillRect(xx - cw / 2, top, cw, bh);
    });
    if (bb) {
      ctx.fillStyle = "rgba(59,130,246,0.07)"; ctx.beginPath(); var st = false;
      bars.forEach(function (b, i) { if (bb.upper[i] == null) return; var xx = x(i), yy = y(bb.upper[i]); if (!st) { ctx.moveTo(xx, yy); st = true; } else ctx.lineTo(xx, yy); });
      for (var k = bars.length - 1; k >= 0; k--) { if (bb.lower[k] == null) continue; ctx.lineTo(x(k), y(bb.lower[k])); }
      ctx.closePath(); ctx.fill();
      line(bb.upper, "#3b82f6", 1.5); line(bb.mid, "#3b82f6", 1.5, true); line(bb.lower, "#3b82f6", 1.5);
    }
    if (ma) { line(ma.sma, "#f0b90b", 2); line(ma.ema, "#e879f9", 2); }
    var last = bars[bars.length - 1].c, ly = y(last);
    ctx.strokeStyle = "#f0b90b"; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(plotW, ly); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#f0b90b"; ctx.fillRect(plotW, ly - 11, padR, 22);
    ctx.fillStyle = "#1a1400"; ctx.font = "bold 13px monospace"; ctx.fillText(last.toFixed(dec), plotW + 6, ly + 4);
    t.price.textContent = (d.price != null ? d.price.toFixed(dec) : last.toFixed(dec));
    t.price.style.color = "#f0b90b";
    if (showRSI) {
      // simple RSI drawn inline for TV
    }
  }

  function render(payload) {
    if (!payload || !payload.tiles) return;
    wait.style.display = "none";
    var list = payload.tiles;
    layout(list.length);
    var seen = {};
    list.forEach(function (d, idx) {
      var t = ensureTile(d.symbol, idx);
      t.data = d;
      t.head.childNodes[0].textContent = d.symbol + (d.name && d.name !== d.symbol ? " · " + d.name : "");
      draw(t);
      seen[d.symbol] = true;
    });
    // remove tiles no longer present
    Object.keys(tiles).forEach(function (sym) {
      if (!seen[sym]) { var el = tiles[sym].el; if (el && el.parentNode) el.parentNode.removeChild(el); delete tiles[sym]; }
    });
  }

  if (channel) channel.onmessage = function (e) { render(e.data); };
  window.addEventListener("resize", function () { Object.keys(tiles).forEach(function (s) { draw(tiles[s]); }); });

  // initial shell from querystring
  function q(name) { var m = location.search.match(new RegExp("[?&]" + name + "=([^&]+)")); return m ? decodeURIComponent(m[1]) : ""; }
  var syms = q("symbols").split(",").filter(Boolean);
  var tfs = q("tfs").split(",").filter(Boolean);
  if (syms.length) {
    syms.forEach(function (s, i) {
      var t = ensureTile(s, i);
      t.data = { symbol: s, tf: tfs[i] || "1m", dec: 2, candles: [], price: null, showMA: true, showBB: false, showRSI: false };
      t.head.childNodes[0].textContent = s;
    });
    layout(syms.length);
  }
})();
