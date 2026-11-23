/* Sustindex admin dashboard charts — dependency-free SVG, sized to their container.
   One y-axis per chart, a hover layer on every plot, colours from CSS variables so
   light and dark both work. Data comes from the json_script block on the page. */
(function () {
  'use strict';
  var node = document.getElementById('sx-dashboard-data');
  if (!node) return;
  var data = JSON.parse(node.textContent);
  var NS = 'http://www.w3.org/2000/svg';
  var lang = document.documentElement.lang || 'en';

  function el(name, attrs, parent, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function fmt(iso, opts) {
    try { return new Date(iso + 'T00:00:00').toLocaleDateString(lang, opts); } catch (e) { return iso; }
  }
  function niceMax(v) {
    if (v <= 4) return 4;
    var pow = Math.pow(10, Math.floor(Math.log10(v))), n = v / pow;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10) * pow;
  }
  function tip(host) {
    var t = document.createElement('div');
    t.className = 'sx-tip'; t.hidden = true; host.appendChild(t);
    return {
      show: function (html, x, y) {
        t.innerHTML = html; t.hidden = false;
        var w = host.clientWidth, half = t.offsetWidth / 2;
        t.style.left = Math.max(half + 2, Math.min(w - half - 2, x)) + 'px';
        t.style.top = y + 'px';
      },
      hide: function () { t.hidden = true; }
    };
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* Daily points up to a month, weekly up to a quarter, monthly beyond. */
  function bucket(series) {
    if (series.length <= 31) {
      return series.map(function (d) {
        return { label: fmt(d.date, { day: 'numeric', month: 'short' }), tip: fmt(d.date, { weekday: 'short', day: 'numeric', month: 'short' }), a: d.completed, b: d.signups };
      });
    }
    var monthly = series.length > 120, out = [], cur = null;
    series.forEach(function (d, i) {
      var key = monthly ? d.date.slice(0, 7) : String(Math.floor(i / 7));
      if (!cur || cur.key !== key) {
        cur = { key: key, a: 0, b: 0,
          label: monthly ? fmt(d.date, { month: 'short', year: '2-digit' }) : fmt(d.date, { day: 'numeric', month: 'short' }),
          start: d.date, tip: fmt(d.date, { month: 'long', year: 'numeric' }) };
        out.push(cur);
      }
      cur.a += d.completed; cur.b += d.signups;
      if (!monthly) {
        cur.tip = fmt(cur.start, { day: 'numeric', month: 'short' }) + (d.date !== cur.start ? ' – ' + fmt(d.date, { day: 'numeric', month: 'short' }) : '');
      }
    });
    return out;
  }

  function lineChart(host, points) {
    var nameA = host.dataset.a, nameB = host.dataset.b, t = null;
    function draw() {
      host.innerHTML = '';
      var w = host.clientWidth, h = w < 480 ? 210 : 280;
      if (!w || !points.length) return;
      var pad = { l: 30, r: 10, t: 10, b: 24 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
      var max = niceMax(Math.max.apply(null, [1].concat(points.map(function (p) { return Math.max(p.a, p.b); }))));
      var x = function (i) { return pad.l + (points.length > 1 ? i / (points.length - 1) * iw : iw / 2); };
      var y = function (v) { return pad.t + ih - v / max * ih; };
      var path = function (k) { return points.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(p[k]).toFixed(1); }).join(''); };
      var svg = el('svg', { width: w, height: h, role: 'img', 'aria-label': nameA + ' / ' + nameB }, host);
      [0, max / 2, max].forEach(function (v) {
        el('line', { x1: pad.l, x2: w - pad.r, y1: y(v), y2: y(v), class: 'grid' }, svg);
        el('text', { x: pad.l - 8, y: y(v) + 3.5, 'text-anchor': 'end' }, svg, v);
      });
      var every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 80))));
      points.forEach(function (p, i) {
        if (i % every === 0) el('text', { x: x(i), y: h - 6, 'text-anchor': i === 0 ? 'start' : 'middle' }, svg, p.label);
      });
      el('path', { d: path('a') + 'L' + x(points.length - 1) + ',' + y(0) + 'L' + x(0) + ',' + y(0) + 'Z', class: 'area' }, svg);
      el('path', { d: path('b'), class: 'line s2' }, svg);
      el('path', { d: path('a'), class: 'line s1' }, svg);
      var cross = el('line', { y1: pad.t, y2: pad.t + ih, class: 'cross', visibility: 'hidden' }, svg);
      var dotB = el('circle', { r: 4.5, class: 'dot s2', visibility: 'hidden' }, svg);
      var dotA = el('circle', { r: 4.5, class: 'dot s1', visibility: 'hidden' }, svg);
      var hit = el('rect', { x: pad.l, y: pad.t, width: iw, height: ih, fill: 'transparent' }, svg);
      t = tip(host);
      function move(clientX) {
        var box = hit.getBoundingClientRect();
        var i = Math.max(0, Math.min(points.length - 1, Math.round((clientX - box.left) / box.width * (points.length - 1))));
        var p = points[i];
        [cross, dotA, dotB].forEach(function (n) { n.setAttribute('visibility', 'visible'); });
        cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
        dotA.setAttribute('cx', x(i)); dotA.setAttribute('cy', y(p.a));
        dotB.setAttribute('cx', x(i)); dotB.setAttribute('cy', y(p.b));
        t.show('<b>' + esc(p.tip) + '</b><div><i class="s1"></i>' + esc(nameA) + '<span>' + p.a + '</span></div><div><i class="s2"></i>' + esc(nameB) + '<span>' + p.b + '</span></div>',
          x(i), Math.min(y(p.a), y(p.b)) - 10);
      }
      function leave() { [cross, dotA, dotB].forEach(function (n) { n.setAttribute('visibility', 'hidden'); }); t.hide(); }
      hit.addEventListener('mousemove', function (e) { move(e.clientX); });
      hit.addEventListener('mouseleave', leave);
      hit.addEventListener('touchstart', function (e) { move(e.touches[0].clientX); }, { passive: true });
      hit.addEventListener('touchmove', function (e) { move(e.touches[0].clientX); }, { passive: true });
      hit.addEventListener('touchend', leave);
    }
    observe(host, draw);
  }

  function barChart(host, bars) {
    function draw() {
      host.innerHTML = '';
      var w = host.clientWidth, h = 190;
      if (!w) return;
      var pad = { l: 4, r: 4, t: 18, b: 22 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
      var max = Math.max.apply(null, [1].concat(bars.map(function (b) { return b.value; })));
      var slot = iw / bars.length, bw = Math.min(Math.max(slot - 6, 4), 44);
      var svg = el('svg', { width: w, height: h, role: 'img' }, host);
      el('line', { x1: pad.l, x2: w - pad.r, y1: pad.t + ih, y2: pad.t + ih, class: 'base' }, svg);
      var t = tip(host);
      bars.forEach(function (b, i) {
        var bh = b.value ? Math.max(b.value / max * ih, 2) : 0, bx = pad.l + i * slot + (slot - bw) / 2;
        var top = pad.t + ih - bh, r = Math.min(4, bh);
        var g = el('g', {}, svg);
        el('rect', { x: pad.l + i * slot, y: pad.t, width: slot, height: ih + pad.b, fill: 'transparent' }, g);
        if (bh > 0) {
          el('path', { class: 'bar', d: 'M' + bx + ',' + (top + bh) + 'V' + (top + r) + 'Q' + bx + ',' + top + ' ' + (bx + r) + ',' + top + 'H' + (bx + bw - r) + 'Q' + (bx + bw) + ',' + top + ' ' + (bx + bw) + ',' + (top + r) + 'V' + (top + bh) + 'Z' }, g);
          if (slot >= 26) el('text', { x: bx + bw / 2, y: top - 5, 'text-anchor': 'middle', class: 'val' }, g, b.value);
        }
        el('text', { x: bx + bw / 2, y: h - 6, 'text-anchor': 'middle' }, g, b.label);
        g.addEventListener('mouseenter', function () { svg.classList.add('hovering'); g.classList.add('on'); t.show(esc(b.tip), pad.l + i * slot + slot / 2, top - 8); });
        g.addEventListener('mouseleave', function () { svg.classList.remove('hovering'); g.classList.remove('on'); t.hide(); });
      });
    }
    observe(host, draw);
  }

  function heatmap(host, days) {
    var max = Math.max.apply(null, [1].concat(days.map(function (d) { return d.count; })));
    var lead = days.length ? (new Date(days[0].date + 'T00:00:00Z').getUTCDay() + 6) % 7 : 0;   // Monday first
    for (var i = 0; i < lead; i++) host.appendChild(document.createElement('span'));
    var t = tip(host.parentNode), unit = host.dataset.unit || '';
    days.forEach(function (d) {
      var c = document.createElement('i');
      c.dataset.l = d.count === 0 ? 0 : Math.min(4, Math.ceil(d.count / max * 4));
      c.addEventListener('mouseenter', function () {
        var box = host.parentNode.getBoundingClientRect(), r = c.getBoundingClientRect();
        t.show(esc(fmt(d.date, { weekday: 'short', day: 'numeric', month: 'short' })) + ' · ' + d.count + ' ' + esc(unit), r.left - box.left + r.width / 2, r.top - box.top - 6);
      });
      host.appendChild(c);
    });
    host.addEventListener('mouseleave', function () { t.hide(); });
  }

  function sparkline(host, values) {
    if (values.length < 2) return;
    var w = 96, h = 34, max = Math.max.apply(null, [1].concat(values));
    var d = values.map(function (v, i) { return (i ? 'L' : 'M') + (2 + i / (values.length - 1) * (w - 4)).toFixed(1) + ',' + (h - 3 - v / max * (h - 6)).toFixed(1); }).join('');
    var svg = el('svg', { width: w, height: h, 'aria-hidden': 'true' }, host);
    el('path', { d: d + 'L' + (w - 2) + ',' + h + 'L2,' + h + 'Z', fill: 'currentColor', opacity: 0.12 }, svg);
    el('path', { d: d, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
  }
  function downsample(series, key) {
    var size = Math.max(1, Math.ceil(series.length / 24)), out = [];
    for (var i = 0; i < series.length; i += size) out.push(series.slice(i, i + size).reduce(function (s, d) { return s + d[key]; }, 0));
    return out;
  }
  function observe(host, draw) {
    draw();
    if (window.ResizeObserver) {
      var last = host.clientWidth;
      new ResizeObserver(function () { if (host.clientWidth !== last) { last = host.clientWidth; draw(); } }).observe(host);
    }
  }

  var line = document.getElementById('sx-line');
  if (line) lineChart(line, bucket(data.series));
  var scores = document.getElementById('sx-scores');
  if (scores) barChart(scores, data.scores.map(function (b) { return { label: b.from, value: b.count, tip: b.from + '–' + b.to + ': ' + b.count }; }));
  var grades = document.getElementById('sx-grades');
  if (grades) barChart(grades, data.grades.map(function (g) { return { label: g.grade, value: g.count, tip: g.grade + ': ' + g.count }; }));
  var heat = document.getElementById('sx-heat');
  if (heat) heatmap(heat, data.calendar);
  document.querySelectorAll('[data-spark]').forEach(function (n) { sparkline(n, downsample(data.series, n.dataset.spark)); });

  var greet = document.getElementById('sx-greeting');
  if (greet && lang.slice(0, 2) === 'en') {
    var hr = new Date().getHours();
    greet.textContent = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  }
})();
