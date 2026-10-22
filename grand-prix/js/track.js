/* =====================================================================
   TRACK: turns a centreline (metres) into everything the race needs.
   - arc length along the lap (s), tangents, right-hand normals, curvature
   - collision corridor: asphalt half-width, run-off and the outer wall
   - invisible checkpoint gates + 3 sectors for lap validation
   - starting grid slots (2 staggered columns, like a real grid)
   - ideal speed profile (for AI drivers and lap-time estimates)
   - item box spots, elevation, named corners, render chunks
   Coordinates: x east, y south (screen style). Normals point to the driver's right.
   ===================================================================== */
window.F1 = window.F1 || {};

F1.seededRandom = function (seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
};

F1.Track = class Track {
  constructor(def) {
    const C = F1.CONFIG;
    this.def = def; this.id = def.id;
    const g = F1.TRACK_GEOMETRY[def.id];
    const n = g.length / 2; this.n = n;
    this.x = new Float32Array(n); this.y = new Float32Array(n);
    const sc = def.scale || 1;
    for (let i = 0; i < n; i++) { this.x[i] = g[i * 2] * sc; this.y[i] = g[i * 2 + 1] * sc; }

    // arc length
    this.cum = new Float32Array(n + 1);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.cum[i + 1] = this.cum[i] + Math.hypot(this.x[j] - this.x[i], this.y[j] - this.y[i]); }
    this.length = this.cum[n];

    // tangents, normals, headings
    this.tx = new Float32Array(n); this.ty = new Float32Array(n); this.nx = new Float32Array(n); this.ny = new Float32Array(n); this.head = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n, b = (i + 1) % n;
      let dx = this.x[b] - this.x[a], dy = this.y[b] - this.y[a]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      this.tx[i] = dx; this.ty[i] = dy; this.nx[i] = -dy; this.ny[i] = dx; this.head[i] = Math.atan2(dy, dx);
    }

    // signed curvature (+ = right-hand bend), measured over a ~32 m window
    this.k = new Float32Array(n);
    const w = 4;
    for (let i = 0; i < n; i++) {
      const a = (i - w + n) % n, b = (i + w) % n;
      let d = this.head[b] - this.head[a]; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.k[i] = d / (this.cum[1] * w * 2 || 8);
    }

    // corridor widths
    this.hw = def.width / 2;
    this.wallOff = this.hw + def.runoff;

    this._buildElevation();
    this._buildSpeedProfile();
    this._buildCorners();
    this._buildGates();
    this._buildPit();
    this._buildGrid();
    this._buildItemSpots();
    this._buildChunks();
    this._buildLookup();
  }

  wrapIndex(i) { return ((i % this.n) + this.n) % this.n; }
  wrapS(s) { return ((s % this.length) + this.length) % this.length; }
  indexAtS(s) { s = this.wrapS(s); let lo = 0, hi = this.n; while (lo < hi - 1) { const m = (lo + hi) >> 1; if (this.cum[m] <= s) lo = m; else hi = m; } return lo; }

  /** World position at distance s along the lap and `lat` metres to the right of the centreline. */
  pointAt(s, lat = 0) {
    s = this.wrapS(s); const i = this.indexAtS(s), j = (i + 1) % this.n;
    const t = (s - this.cum[i]) / Math.max(0.001, this.cum[i + 1] - this.cum[i]);
    const x = this.x[i] + (this.x[j] - this.x[i]) * t, y = this.y[i] + (this.y[j] - this.y[i]) * t;
    const nx = this.nx[i] + (this.nx[j] - this.nx[i]) * t, ny = this.ny[i] + (this.ny[j] - this.ny[i]) * t; const nl = Math.hypot(nx, ny) || 1;
    return { x: x + nx / nl * lat, y: y + ny / nl * lat, heading: Math.atan2(this.ty[i] + (this.ty[j] - this.ty[i]) * t, this.tx[i] + (this.tx[j] - this.tx[i]) * t), i };
  }

  /**
   * Where is (x,y) relative to the track? Searches only near `hint` (the segment the car was on last tick),
   * so a car can never "jump" to another part of the circuit that happens to be close by. That is what
   * stops shortcuts across the infield: every car is tied to its own stretch of track.
   */
  locate(x, y, hint) {
    const n = this.n; let best = Infinity, bi = 0, bt = 0;
    const from = hint == null ? 0 : hint - 10, to = hint == null ? n : hint + 26;
    for (let k = from; k < to; k++) {
      const i = ((k % n) + n) % n, j = (i + 1) % n;
      const ax = this.x[i], ay = this.y[i], dx = this.x[j] - ax, dy = this.y[j] - ay, l2 = dx * dx + dy * dy || 1;
      let t = ((x - ax) * dx + (y - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = ax + dx * t - x, py = ay + dy * t - y, d = px * px + py * py;
      if (d < best) { best = d; bi = i; bt = t; }
    }
    const j = (bi + 1) % n, sx = this.x[j] - this.x[bi], sy = this.y[j] - this.y[bi], sl = Math.hypot(sx, sy) || 1;
    const lat = ((x - this.x[bi]) * -sy + (y - this.y[bi]) * sx) / sl;   // + = right of the centreline
    return { i: bi, s: this.cum[bi] + (this.cum[bi + 1] - this.cum[bi]) * bt, lat, dirx: sx / sl, diry: sy / sl, nx: -sy / sl, ny: sx / sl };
  }

  // ---------- elevation ----------
  _buildElevation() {
    const prof = this.def.elevation || [[0, 0], [1, 0]];
    this.elev = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const f = this.cum[i] / this.length; let k = 0; while (k < prof.length - 2 && prof[k + 1][0] < f) k++;
      const [f0, e0] = prof[k], [f1, e1] = prof[k + 1]; const t = (f - f0) / Math.max(1e-6, f1 - f0);
      this.elev[i] = e0 + (e1 - e0) * (t * t * (3 - 2 * t));
    }
    let lo = Infinity, hi = -Infinity; for (const e of this.elev) { lo = Math.min(lo, e); hi = Math.max(hi, e); }
    this.elevMin = lo; this.elevMax = hi;
    this.grade = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) { const a = (i - 3 + this.n) % this.n, b = (i + 3) % this.n; this.grade[i] = (this.elev[b] - this.elev[a]) / (this.cum[1] * 6 || 24); }
  }

  // ---------- ideal speed: corner speed from curvature, then braking and acceleration passes ----------
  _buildSpeedProfile() {
    const C = F1.CONFIG.CAR, n = this.n, v = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let k = 0; for (let d = -3; d <= 3; d++) k = Math.max(k, Math.abs(this.k[(i + d + n) % n]));
      v[i] = Math.min(C.maxSpeed, Math.sqrt(C.latGrip * 0.95 / Math.max(k, 1e-4)));
    }
    const ds = this.length / n;
    for (let pass = 0; pass < 3; pass++) {
      for (let k = 2 * n; k >= 0; k--) { const i = k % n, j = (i + 1) % n; v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * C.brake * 0.8 * ds)); }
      for (let k = 0; k <= 2 * n; k++) { const i = (k + 1) % n, h = k % n; const a = C.accel * Math.max(0.15, 1 - v[h] / C.maxSpeed); v[i] = Math.min(v[i], Math.sqrt(v[h] * v[h] + 2 * a * ds)); }
    }
    this.vIdeal = v;
    let t = 0; for (let i = 0; i < n; i++) t += (this.cum[i + 1] - this.cum[i]) / Math.max(3, v[i]);
    this.idealLap = t;
    this.expectedLap = t * F1.CONFIG.RACE.studentPace;
  }

  // ---------- corners: named from track data, snapped to the tightest point nearby ----------
  _buildCorners() {
    this.corners = (this.def.corners || []).map(([f, name]) => {
      let i = Math.round(f * this.n) % this.n, best = i, bk = 0;
      for (let d = -10; d <= 10; d++) { const j = (i + d + this.n) % this.n; if (Math.abs(this.k[j]) > bk) { bk = Math.abs(this.k[j]); best = j; } }
      if (bk < 1 / 600) best = i;
      return { name, i: best, s: this.cum[best], dir: this.k[best] >= 0 ? 'right' : 'left', radius: bk ? Math.round(1 / bk) : null };
    });
    // kerbs where the bend is tight
    this.kerb = new Uint8Array(this.n);
    for (let i = 0; i < this.n; i++) if (Math.abs(this.k[i]) > 1 / 180) for (let d = -4; d <= 4; d++) this.kerb[(i + d + this.n) % this.n] = this.k[i] > 0 ? 2 : 1;   // 1 = kerb on right edge (outside of a left bend), 2 = left edge
    this.speedZones = [];
    let cur = null;
    for (let i = 0; i < this.n; i++) {
      const kind = this.vIdeal[i] > 70 ? 'high' : this.vIdeal[i] > 40 ? 'medium' : 'slow';
      if (!cur || cur.kind !== kind) { cur = { kind, from: this.cum[i], to: this.cum[i] }; this.speedZones.push(cur); }
      cur.to = this.cum[i + 1];
    }
    this.straights = this.speedZones.filter(z => z.kind === 'high' && z.to - z.from > 250).map(z => ({ from: Math.round(z.from), length: Math.round(z.to - z.from) }));
  }

  cornerAt(s) {
    let best = null, bd = Infinity;
    for (const c of this.corners) { let d = this.wrapS(c.s - s); if (d > this.length / 2) d -= this.length; if (Math.abs(d) < bd && d > -60) { bd = Math.abs(d); best = c; } }
    return best && bd < 320 ? best : null;
  }

  // ---------- invisible checkpoint gates (every ~140 m) grouped into 3 sectors ----------
  _buildGates() {
    const sp = F1.CONFIG.RACE.gateSpacing, count = Math.max(12, Math.round(this.length / sp));
    this.gates = []; for (let g = 1; g < count; g++) this.gates.push(this.length * g / count);   // the start line is the final gate
    this.sectorGate = [Math.round(count / 3) - 1, Math.round(2 * count / 3) - 1];               // gate index that closes sectors 1 and 2
  }

  // ---------- pit lanes: a stop half way round every lap and another at the end of it ----------
  // The main lane runs beside the start straight; the half-way lane sits on a long straight near the middle of the lap
  // (set per circuit as def.midPit). Cars are driven through a lane automatically, so it is a smoothed path
  // (it can cut straight past a gentle kink), sampled every 2 m and indexed by lap distance s.
  _buildPit() {
    const P = F1.CONFIG.PIT, L = this.length, boxLen = (F1.CONFIG.MAX_PLAYERS - 1) * P.slotGap;
    this.pits = [];
    const mid = this.def.midPit;
    if (mid) this.pits.push(this._makePit(mid.at * L + boxLen / 2, mid.side, 'mid'));
    this.pits.push(this._makePit(L - P.boxBeforeLine, this.def.pitSide || 1, 'main'));
    this.pits.forEach((p, k) => p.k = k);
    this.pit = this.pits[this.pits.length - 1];   // the main pit lane by the start line
  }
  _makePit(boxEnd, side, kind) {
    const P = F1.CONFIG.PIT, slots = F1.CONFIG.MAX_PLAYERS;
    const boxStart = boxEnd - (slots - 1) * P.slotGap;
    const entryS = boxStart - P.entryLen - 25, exitS = boxEnd + P.boxBeforeLine + P.exitAfter, endS = exitS + P.exitLen;
    const laneLat = side * (this.wallOff + 7), edgeLat = side * this.hw * 0.55;
    const sm = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    const latAt = s => s < entryS + P.entryLen ? edgeLat + (laneLat - edgeLat) * sm((s - entryS) / P.entryLen) : s > exitS ? laneLat + (edgeLat - laneLat) * sm((s - exitS) / P.exitLen) : laneLat;
    const step = 2, n = Math.ceil((endS - entryS) / step) + 1, raw = [];
    for (let k = 0; k < n; k++) { const s = entryS + k * step, p = this.pointAt(s, latAt(s)); raw.push([p.x, p.y]); }
    const R = 12, xs = new Float32Array(n), ys = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const r = Math.min(R, k, n - 1 - k); let sx = 0, sy = 0;
      for (let d = -r; d <= r; d++) { sx += raw[k + d][0]; sy += raw[k + d][1]; }
      xs[k] = sx / (2 * r + 1); ys[k] = sy / (2 * r + 1);
    }
    return { kind, side, entryS, boxStart, boxEnd, exitS, endS, laneLat, edgeLat, step, n, xs, ys,
      gate: this.gates.filter(g => g < entryS).length, slotS: k => boxEnd - k * P.slotGap };
  }
  /** Position and heading on a pit path at (unwrapped) lap distance s. */
  pitAt(s, p = this.pit) {
    const f = Math.max(0, Math.min(p.n - 1.001, (s - p.entryS) / p.step)), k = Math.floor(f), t = f - k;
    const x = p.xs[k] + (p.xs[k + 1] - p.xs[k]) * t, y = p.ys[k] + (p.ys[k + 1] - p.ys[k]) * t;
    return { x, y, heading: Math.atan2(p.ys[k + 1] - p.ys[k], p.xs[k + 1] - p.xs[k]) };
  }
  /** Is lap distance s inside a pit entry/exit road (where the barrier has a gap)? Only lanes on `side` count when it is given. */
  inPitGap(s, side) {
    s = this.wrapS(s);
    const inR = (x, lo, hi) => lo <= hi ? x >= lo && x <= hi : x >= lo || x <= hi;
    for (const p of this.pits) {
      if (side != null && p.side !== side) continue;
      const a = this.wrapS(p.entryS - 6), b = this.wrapS(p.entryS + this.def.width + F1.CONFIG.PIT.entryLen * 0.75);
      const c = this.wrapS(p.exitS + F1.CONFIG.PIT.exitLen * 0.2), d = this.wrapS(p.endS + 6);
      if (inR(s, a, b) || inR(s, c, d)) return true;
    }
    return false;
  }
  /** Pit stops each car makes per lap. */
  get stopsPerLap() { return this.pits.length; }

  // ---------- grid: 2 staggered columns behind the line, 8 m between rows ----------
  _buildGrid() {
    this.grid = [];
    for (let p = 0; p < F1.CONFIG.MAX_PLAYERS; p++) {
      const row = Math.floor(p / 2), side = p % 2 === 0 ? -1 : 1;
      const s = -12 - row * 8 - (side > 0 ? 4 : 0);
      const pt = this.pointAt(s, side * this.hw * 0.42);
      this.grid.push({ x: pt.x, y: pt.y, heading: pt.heading, s: this.wrapS(s) });
    }
  }

  // ---------- item boxes: rows of three across the track on straights ----------
  _buildItemSpots() {
    this.itemSpots = [];
    for (const f of this.def.itemRows || []) for (const lat of [-0.5, 0, 0.5]) {
      const s = f * this.length, p = this.pointAt(s, lat * this.hw);
      this.itemSpots.push({ x: p.x, y: p.y, s, row: f });
    }
  }

  // ---------- render chunks with bounding boxes (only visible chunks are drawn) ----------
  _buildChunks() {
    const size = 30, pad = this.wallOff + 12; this.chunks = [];
    for (let a = 0; a < this.n; a += size) {
      const b = Math.min(this.n, a + size); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, e = 0;
      for (let i = a; i <= b; i++) { const j = i % this.n; x0 = Math.min(x0, this.x[j]); y0 = Math.min(y0, this.y[j]); x1 = Math.max(x1, this.x[j]); y1 = Math.max(y1, this.y[j]); e += this.elev[j]; }
      this.chunks.push({ a, b, x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad, elev: e / (b - a + 1) });
    }
    let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
    for (let i = 0; i < this.n; i++) { X0 = Math.min(X0, this.x[i]); Y0 = Math.min(Y0, this.y[i]); X1 = Math.max(X1, this.x[i]); Y1 = Math.max(Y1, this.y[i]); }
    this.bounds = { x0: X0, y0: Y0, x1: X1, y1: Y1 };
  }

  // ---------- coarse grid of centreline points, for "how far from any track" checks (scenery placement) ----------
  _buildLookup() {
    this.cell = 50; this.buckets = new Map();
    for (let i = 0; i < this.n; i++) { const key = Math.floor(this.x[i] / this.cell) + ',' + Math.floor(this.y[i] / this.cell); if (!this.buckets.has(key)) this.buckets.set(key, []); this.buckets.get(key).push(i); }
  }
  distanceToTrack(x, y) {
    const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell); let best = Infinity;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const l = this.buckets.get((cx + a) + ',' + (cy + b)); if (l) for (const i of l) best = Math.min(best, Math.hypot(this.x[i] - x, this.y[i] - y)); }
    return best;
  }

  /** About how long a race takes: driving plus every 10-question pit stop (about 6 s a question). */
  minutesFor(laps) { return laps * (this.expectedLap + this.stopsPerLap * (F1.CONFIG.PIT.questions * 6 + 20)) / 60; }

  /** Small SVG outline of the circuit for menus. */
  outlineSVG(stroke = '#22303A', w = 220, h = 150, opts = {}) {
    const b = this.bounds, sc = Math.min((w - 20) / (b.x1 - b.x0), (h - 20) / (b.y1 - b.y0));
    const ox = (w - (b.x1 - b.x0) * sc) / 2, oy = (h - (b.y1 - b.y0) * sc) / 2;
    let d = ''; for (let i = 0; i < this.n; i += 2) d += (i ? 'L' : 'M') + ((this.x[i] - b.x0) * sc + ox).toFixed(1) + ' ' + ((this.y[i] - b.y0) * sc + oy).toFixed(1);
    d += 'Z';
    const sx = (this.x[0] - b.x0) * sc + ox, sy = (this.y[0] - b.y0) * sc + oy;
    return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="#22303A" stroke-width="${opts.ink || 9}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${stroke}" stroke-width="${opts.core || 4.5}" stroke-linejoin="round"/><circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="5.5" fill="#fff" stroke="#22303A" stroke-width="2.5"/></svg>`;
  }
};
