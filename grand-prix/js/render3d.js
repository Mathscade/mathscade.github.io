/* =====================================================================
   3D RENDERER (Three.js): draws the race in 3D.
   Same interface as the old 2D renderer, so the server, AI, maths and UI
   are untouched:  new F1.Renderer(canvas, track, images)
                   .resize()  .draw(snap, meId, alpha, dt)
                   .drawMinimap(cv, snap, meId)  .drawElevation(cv, s)
                   .spark() .puff() .ring()  .cycleCamera()  .userZoom
   World mapping: game x (east) -> 3D x, game y (south) -> 3D z, height -> 3D y.
   Track scenery is built once per circuit and cached between races.
   Cars come from Kenney's Car Kit (CC0), recoloured per team (car-models.js).
   ===================================================================== */
window.F1 = window.F1 || {};
F1.INK = '#22303A';

/* ---------------- shared helpers ---------------- */
const LIN = h => new THREE.Color(h).convertSRGBToLinear();

/** Parse '#rrggbb' or 'rgba(r,g,b,a)' into [r,g,b,a] (0..1). */
F1.parseCol = (() => {
  const cache = new Map();
  return s => {
    if (cache.has(s)) return cache.get(s);
    let out = [1, 1, 1, 1];
    if (s[0] === '#') { const v = parseInt(s.slice(1), 16); out = [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255, 1]; }
    else { const m = s.match(/[\d.]+/g); if (m) out = [m[0] / 255, m[1] / 255, m[2] / 255, m[3] != null ? +m[3] : 1]; }
    cache.set(s, out); return out;
  };
})();

/** Merge simple geometries (each converted to non-indexed) into one, painting each with a flat colour. */
F1.mergeColoured = parts => {
  const pos = [], nor = [], col = [];
  for (const [geo, hex, mat] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo; if (mat) g.applyMatrix4(mat);
    const c = LIN(hex), p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
};
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/* ---------------- cars: liveries built from the Car Kit models ---------------- */
// 25 cars = 5 team colours x 5 styles (body shape + trim colour)
F1.BODY_COLOURS = { red: '#E0362C', blue: '#2F86D6', green: '#2EB86A', yellow: '#F2C51A', black: '#3A4148' };
F1.LIVERY_STYLES = [null, { model: 'race', trim: '#3A3F48' }, { model: 'race-future', trim: '#3A3F48' }, { model: 'race', trim: '#F4F4F4' }, { model: 'race-future', trim: '#F4F4F4' }, { model: 'race', trim: '#FFB020' }];
F1.livery = sprite => { const [, c, m] = sprite.split('_'); const st = F1.LIVERY_STYLES[+m] || F1.LIVERY_STYLES[1]; return { model: st.model, main: F1.BODY_COLOURS[c] || '#E0362C', trim: st.trim }; };
F1.CAR_SCALE = 2.15;   // Kenney model units -> metres (5.6 m long)

F1.carParts = (() => {
  const cache = new Map(), lumRef = new Map();
  const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
  return sprite => {
    if (cache.has(sprite)) return cache.get(sprite);
    const L = F1.livery(sprite), parts = F1.CAR_MODELS[L.model];
    if (!lumRef.has(L.model)) {   // average brightness of the team-colour and trim panels, so the gradients survive recolouring
      const acc = { 1: [0, 0], 2: [0, 0] };
      for (const p of parts) for (let i = 0; i < p.tag.length; i++) if (p.tag[i]) { acc[p.tag[i]][0] += lum(p.c[i * 3], p.c[i * 3 + 1], p.c[i * 3 + 2]); acc[p.tag[i]][1]++; }
      lumRef.set(L.model, { 1: acc[1][0] / Math.max(1, acc[1][1]), 2: acc[2][0] / Math.max(1, acc[2][1]) });
    }
    const ref = lumRef.get(L.model), main = new THREE.Color(L.main), trim = new THREE.Color(L.trim);
    const out = parts.map(p => {
      const g = new THREE.BufferGeometry(), col = new Float32Array(p.c.length);
      for (let i = 0; i < p.tag.length; i++) {
        const r = p.c[i * 3], gg = p.c[i * 3 + 1], b = p.c[i * 3 + 2]; let c;
        if (p.tag[i]) { const base = p.tag[i] === 1 ? main : trim, sh = Math.min(1.25, lum(r, gg, b) / ref[p.tag[i]]); c = new THREE.Color(Math.min(1, base.r * sh), Math.min(1, base.g * sh), Math.min(1, base.b * sh)); }
        else c = new THREE.Color(r / 255, gg / 255, b / 255);
        c.convertSRGBToLinear(); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(p.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(p.n, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setIndex(p.i);
      return { name: p.name, t: p.t, geo: g };
    });
    cache.set(sprite, out); return out;
  };
})();

F1.buildCar = (sprite, material) => {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(F1.CAR_SCALE);
  const wheels = [];
  for (const p of F1.carParts(sprite)) {
    const m = new THREE.Mesh(p.geo, material); m.position.set(p.t[0], p.t[1], p.t[2]); m.castShadow = true;
    if (p.name.startsWith('wheel')) { m.rotation.order = 'YXZ'; wheels.push({ m, front: p.name.includes('front') }); }
    body.add(m);
  }
  return { root, body, wheels };
};

/** Small pictures of every car for the menus and results, rendered once from the 3D models. */
F1.CAR_THUMBS = {};
F1.carImg = s => F1.CAR_THUMBS[s] || '';
F1.makeCarThumbs = () => {
  try {
    const W = 160, H = 110, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.outputEncoding = THREE.sRGBEncoding; r.setClearColor(0x000000, 0);
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    sc.add(new THREE.HemisphereLight(0xFFFFFF, 0x667788, 0.9)); const d = new THREE.DirectionalLight(0xFFFFFF, 0.8); d.position.set(4, 8, 6); sc.add(d);
    cam.position.set(6.0, 3.9, 6.9); cam.lookAt(0, 0.75, 0);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (const s of F1.CAR_SPRITES) {
      const car = F1.buildCar(s, mat); car.root.rotation.y = -0.35; sc.add(car.root);
      r.render(sc, cam); F1.CAR_THUMBS[s] = cv.toDataURL('image/png'); sc.remove(car.root);
    }
    r.dispose(); if (r.forceContextLoss) r.forceContextLoss();
  } catch (e) { console.warn('car thumbnails', e); }
};

/* ---------------- canvas textures ---------------- */
F1.tex = (w, h, draw, repeat) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
};

F1.Renderer = class Renderer {
  constructor(canvas, track, images) {
    this.cv = canvas; this.track = track; this.img = images; this.theme = track.def.theme;
    this.mode = 'chase'; this.userZoom = 1;
    // one WebGL renderer for the page, reused race after race
    if (!Renderer.gl || Renderer.gl.domElement !== canvas) {
      const gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      gl.outputEncoding = THREE.sRGBEncoding; gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap;
      Renderer.gl = gl; Renderer.quality = 2;
    }
    this.gl = Renderer.gl;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 1600);
    // the name tags sit on a transparent 2D canvas over the 3D view
    this.tagCv = canvas.parentNode.querySelector('.tags3d');
    if (!this.tagCv) { this.tagCv = document.createElement('canvas'); this.tagCv.className = 'tags3d'; this.tagCv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; canvas.after(this.tagCv); }
    this.tg = this.tagCv.getContext('2d');

    this.world = Renderer.worldFor(track);
    this.scene.add(this.world.group);
    this.scene.fog = this.world.fog;
    this.scene.background = null;
    this._lights();
    this.dyn = new THREE.Group(); this.scene.add(this.dyn);
    this.cars = new Map();
    this._initItems(); this._initSkids(); this._initParticles();
    this.cam = { h: track.head[0], pos: new THREE.Vector3(), look: new THREE.Vector3(), init: false };
    this.tunnels = (track.def.tunnels || []).map(([f0, f1]) => ({ a: Math.round(f0 * track.n), b: Math.round(f1 * track.n) }));
    this.fps = { t: 0, n: 0, checks: 0 };
    this._applyQuality();
  }

  /* ---------- lights, sky ---------- */
  _lights() {
    const th = this.track.def.theme, night = !!th.night;
    this.scene.add(new THREE.HemisphereLight(night ? 0x9AA0E0 : 0xFFF1DC, night ? 0x3A2E48 : th.props === 'city' ? 0x8C8478 : 0x5A6A4A, night ? 0.5 : 0.72));
    const sun = new THREE.DirectionalLight(night ? 0xC8D4FF : 0xFFE9C4, night ? 0.42 : 0.95);
    if (night) { this.glow = new THREE.PointLight(0xFFD9A8, 1.4, 60, 1.6); this.scene.add(this.glow); }
    sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536);
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 500 }); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.4;
    this.sun = sun; this.scene.add(sun, sun.target);
    this.scene.add(this.world.sky);
  }

  _applyQuality() {
    const q = Renderer.quality, gl = this.gl;
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, q >= 2 ? 1.5 : q === 1 ? 1 : 0.75));
    gl.shadowMap.enabled = q >= 1; this.sun.castShadow = q >= 1;
    this.camera.far = q >= 1 ? this.world.fogFar + 60 : 700; this.camera.updateProjectionMatrix();
    this.scene.fog.far = q >= 1 ? this.world.fogFar : 650; this.scene.fog.near = q >= 1 ? this.world.fogNear : 200;
    this.world.detail.forEach(o => o.visible = q >= 1);
    this.world.sky.scale.setScalar(this.camera.far * 0.92 / 1400);   // the sky dome must sit inside the far clipping plane
    gl.setClearColor(this.scene.fog.color);
    this.resize();
  }

  /* ---------- the static world for a circuit (cached) ---------- */
  static worldFor(T) {
    Renderer.worlds = Renderer.worlds || {};
    if (!Renderer.worlds[T.id]) Renderer.worlds[T.id] = new F1.World3D(T);
    const w = Renderer.worlds[T.id]; if (w.group.parent) w.group.parent.remove(w.group); if (w.sky.parent) w.sky.parent.remove(w.sky);
    return w;
  }

  /* ---------- effects (game coordinates) ---------- */
  spark(x, y, n = 10, col = '#FFD34D') { const h = this._hAt(x, y); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 5 + Math.random() * 12; this._emit(x, h + 0.6, y, Math.cos(a) * v, 2 + Math.random() * 6, Math.sin(a) * v, 0.35 + Math.random() * 0.3, 0.45, col, -14); } }
  puff(x, y, col = 'rgba(80,80,80,.5)', size = 1.4, vx = 0, vy = 0) { const h = this._hAt(x, y); this._emit(x, h + 0.5, y, vx + (Math.random() - 0.5) * 2, 0.8 + Math.random(), vy + (Math.random() - 0.5) * 2, 1.1, size * 1.6, col, 0.6, true); }
  ring(x, y, col) { const h = this._hAt(x, y); for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28; this._emit(x, h + 1, y, Math.cos(a) * 9, 1.5, Math.sin(a) * 9, 0.45, 0.7, col, 0); } }
  _hAt(x, y) { return this.world.groundAt(x, y) + 0.3; }

  /* ---------- camera ---------- */
  cycleCamera() {
    const order = ['chase', 'far', 'top'], names = { chase: 'Camera: chase', far: 'Camera: high chase', top: 'Camera: overhead' };
    this.mode = order[(order.indexOf(this.mode) + 1) % order.length]; return names[this.mode];
  }

  resize() {
    const r = this.cv.getBoundingClientRect(); this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    this.gl.setSize(this.W, this.H, false);
    this.camera.aspect = this.W / this.H; this.camera.updateProjectionMatrix();
    const dpr = Math.min(2, window.devicePixelRatio || 1); this.tagCv.width = Math.round(this.W * dpr); this.tagCv.height = Math.round(this.H * dpr); this.tdpr = dpr;
  }

  /* ---------- frame ---------- */
  draw(snap, meId, alpha, dt) {
    if (!this.W) this.resize();
    const T = this.track, W3 = this.world;
    const me = snap.cars.find(c => c.id === meId) || snap.cars[0];
    const lerp = (a, b) => a + (b - a) * alpha, lerpA = (a, b) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * alpha;
    for (const c of snap.cars) { c.rx = lerp(c.px ?? c.x, c.x); c.ry = lerp(c.py ?? c.y, c.y); c.rh = lerpA(c.ph ?? c.h, c.h); }

    // cars
    const seen = new Set();
    for (const c of snap.cars) { seen.add(c.id); this._drawCar(c, c.id === meId, dt, snap); }
    for (const [id, o] of this.cars) if (!seen.has(id)) { this.dyn.remove(o.root); this.cars.delete(id); }

    // items, oil, gantry lights
    this._drawItems(snap);
    W3.setLights(snap.phase === 'countdown' ? Math.max(0, Math.min(5, Math.ceil((3 - snap.countdown) / 0.6))) : snap.phase === 'grid' ? 0 : -1);

    // camera
    this._camera(me, snap, dt);

    // sun follows the action so shadows stay sharp
    const mp = this.cars.get(me.id).root.position;
    this.sun.position.set(mp.x + 60, mp.y + 140, mp.z + 40); this.sun.target.position.copy(mp);
    if (this.glow) this.glow.position.set(mp.x, mp.y + 14, mp.z);
    W3.sky.position.copy(this.camera.position);

    this._updateParticles(dt);
    this.gl.render(this.scene, this.camera);
    this._drawTags(snap, meId);
    this._watchFps(dt, snap);
  }

  _camera(me, snap, dt) {
    const o = this.cars.get(me.id), p = o.root.position, cam = this.camera, C = this.cam;
    const k = 1 - Math.exp(-dt * 4.5);
    if (!C.init || snap.phase === 'grid') { C.h = me.rh; }
    else C.h += Math.atan2(Math.sin(me.rh - C.h), Math.cos(me.rh - C.h)) * Math.min(1, k * 1.5);
    const fx = Math.cos(C.h), fz = Math.sin(C.h), v = Math.max(0, me.speed || 0), z = this.userZoom || 1;
    let want, look, fov = 62;
    if (me.pit && me.pit.phase === 'box') {
      // garage view: from the pit wall, looking at the car and the crew
      const side = (this.track.pits[me.pit.k] || this.track.pit).side, ox = side * Math.sin(me.rh), oz = -side * Math.cos(me.rh);
      want = new THREE.Vector3(p.x + ox * 9 + fx * 5, p.y + 3.4, p.z + oz * 9 + fz * 5); look = new THREE.Vector3(p.x - ox * 1.5, p.y + 0.9, p.z - oz * 1.5); fov = 55;
    } else if (this.mode === 'chase') {
      const back = (9.5 + v * 0.03) * z, up = 3.6 * z + 0.6;
      want = new THREE.Vector3(p.x - fx * back, p.y + up, p.z - fz * back); look = new THREE.Vector3(p.x + fx * 14, p.y + 1.4, p.z + fz * 14);
      fov = 60 + Math.min(14, v / 6.5);
    } else if (this.mode === 'far') {
      const back = 22 * z;
      want = new THREE.Vector3(p.x - fx * back, p.y + 13 * z, p.z - fz * back); look = new THREE.Vector3(p.x + fx * 18, p.y, p.z + fz * 18);
      fov = 58;
    } else {
      want = new THREE.Vector3(p.x - fx * 6, p.y + 70 * z, p.z - fz * 6); look = new THREE.Vector3(p.x + fx * 8, p.y, p.z + fz * 8); fov = 50;
    }
    // never let the camera sink under the ground or a hill
    const gy = this.world.groundAt(want.x, want.z) + 1.2; if (want.y < gy) want.y = gy;
    if (!C.init) { C.pos.copy(want); C.look.copy(look); C.init = true; }
    const kp = 1 - Math.exp(-dt * 9), kl = 1 - Math.exp(-dt * 14);
    C.pos.lerp(want, kp); C.look.lerp(look, kl);
    cam.position.copy(C.pos); cam.lookAt(C.look);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
  }

  _watchFps(dt, snap) {
    // automatic graphics level: if a slow laptop can't keep up, drop shadows and resolution
    if (snap.phase !== 'racing') return;
    const f = this.fps; f.t += dt; f.n++;
    if (f.t < 4) return;
    const fps = f.n / f.t; f.t = 0; f.n = 0; f.checks++;
    if (fps < 38 && Renderer.quality > 0) { Renderer.quality--; this._applyQuality(); }
  }

  /* ---------- cars ---------- */
  _drawCar(c, me, dt, snap) {
    let o = this.cars.get(c.id);
    if (!o) {
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true });
      o = F1.buildCar(c.sprite, mat); o.mat = mat; o.spin = 0; o.prevH = c.rh;
      if (me) {   // a yellow marker over your car for the high cameras
        const mk = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 4), new THREE.MeshBasicMaterial({ color: 0xFFE36B }));
        mk.rotation.x = Math.PI; mk.position.y = 4.2; o.marker = mk; o.root.add(mk);
      }
      this.dyn.add(o.root); this.cars.set(c.id, o);
    }
    const T = this.track, i = T.indexAtS(c.s), j = (i + 1) % T.n, f = (T.wrapS(c.s) - T.cum[i]) / Math.max(0.01, T.cum[i + 1] - T.cum[i]);
    const y = this.world.roadY(i) + (this.world.roadY(j) - this.world.roadY(i)) * Math.max(0, Math.min(1, f)) + 0.02;
    o.root.position.set(c.rx, y, c.ry);
    o.root.rotation.order = 'YXZ';
    o.root.rotation.y = Math.atan2(Math.cos(c.rh), Math.sin(c.rh));
    o.root.rotation.x = -Math.atan(T.grade[i] || 0);
    // wheels: spin with speed, front wheels steer with the turn rate
    const yaw = Math.atan2(Math.sin(c.rh - o.prevH), Math.cos(c.rh - o.prevH)) / Math.max(dt, 0.001); o.prevH = c.rh;
    o.spin += (c.speed || 0) * dt / 0.65;
    const steer = Math.max(-0.45, Math.min(0.45, -yaw * 0.25));
    for (const w of o.wheels) { w.m.rotation.x = o.spin; w.m.rotation.y = w.front ? steer : 0; }
    // ghost after a reset, red glow when critical
    o.mat.opacity = c.ghostT > 0 ? 0.45 + 0.3 * Math.sin(performance.now() / 70) : 1;
    o.mat.emissive.setRGB(c.critical ? 0.35 + 0.25 * Math.sin(performance.now() / 120) : 0, 0, 0);
    // pit crew around the car while it sits in its box
    const inBox = !!(c.pit && c.pit.phase === 'box');
    if (inBox && !o.crew) o.crew = this._crew(c), o.root.add(o.crew);
    if (o.crew) { o.crew.visible = inBox; if (inBox) { const t = performance.now() / 1000; o.crew.children.forEach((m, k) => { m.position.y = Math.abs(Math.sin(t * 6 + k * 1.3)) * 0.18; }); } }
    if (o.marker) { o.marker.visible = this.mode !== 'chase'; o.marker.position.y = 4.2 + Math.sin(performance.now() / 250) * 0.3; }

    // effects
    const fx = Math.cos(c.rh), fy = Math.sin(c.rh), L = F1.CONFIG.CAR.length;
    if (c.boostT > 0 && c.speed > 5 && Math.random() < 0.8) this._emit(c.rx - fx * L * 0.55, y + 0.5, c.ry - fy * L * 0.55, -fx * 6, 0.5, -fy * 6, 0.18, 0.4, Math.random() < 0.5 ? '#FFB020' : '#FF5A3C', 0);
    if (c.health < 50 && Math.random() < (c.health < 25 ? 0.5 : 0.18)) this.puff(c.rx - fx * 2, c.ry - fy * 2, c.health < 25 ? 'rgba(40,40,40,.55)' : 'rgba(120,120,120,.45)', 1.1);
    if ((c.surface === 'gravel' || c.surface === 'grass') && Math.abs(c.speed) > 8 && Math.random() < 0.6) this.puff(c.rx - fx * 2.5, c.ry - fy * 2.5, c.surface === 'gravel' ? 'rgba(210,180,120,.6)' : 'rgba(90,140,60,.5)', 1.2);
    if ((c.sliding || c.slideT > 0) && Math.abs(c.speed) > 8) {
      const rx = -fy, ry = fx, mem = this._skidMem || (this._skidMem = new Map()), prev = mem.get(c.id) || {};
      for (const side of [-1, 1]) { const bx = c.rx - fx * 1.9 + rx * side * 1.0, by = c.ry - fy * 1.9 + ry * side * 1.0, last = prev[side]; if (last && Math.hypot(last[0] - bx, last[1] - by) < 6) this._skid(last[0], last[1], bx, by, y); prev[side] = [bx, by]; }
      mem.set(c.id, prev);
    } else if (this._skidMem) this._skidMem.delete(c.id);
  }

  /** Five pit crew: one at each wheel and the lollipop man in front. */
  _crew(c) {
    const g = new THREE.Group(), suit = new THREE.MeshLambertMaterial({ color: new THREE.Color(F1.BODY_COLOURS[c.sprite.split('_')[1]] || '#E0362C') }), helm = new THREE.MeshLambertMaterial({ color: 0xF4F4F4 });
    const body = new THREE.BoxGeometry(0.7, 1.0, 0.5), head = new THREE.SphereGeometry(0.28, 8, 6);
    const spots = [[1.9, 1.7, -Math.PI / 2], [-1.9, 1.7, Math.PI / 2], [1.9, -1.9, -Math.PI / 2], [-1.9, -1.9, Math.PI / 2], [0, 4.4, Math.PI]];
    for (const [x, z, r] of spots) {
      const man = new THREE.Group(); man.position.set(x, 0, z); man.rotation.y = r;
      const b = new THREE.Mesh(body, suit); b.position.y = 0.75; b.castShadow = true; man.add(b);
      const h = new THREE.Mesh(head, helm); h.position.y = 1.5; man.add(h);
      if (z > 4) { const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), helm); stick.position.set(0.4, 1.4, 0.2); man.add(stick); const sign = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 12), new THREE.MeshBasicMaterial({ color: 0xE0362C })); sign.rotation.x = Math.PI / 2; sign.position.set(0.4, 2.2, 0.2); man.add(sign); }
      g.add(man);
    }
    return g;
  }

  /* ---------- item boxes and oil ---------- */
  _initItems() {
    const tex = F1.tex(128, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#FFE36B'); gr.addColorStop(1, '#FF8A1F'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = F1.INK; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
      g.font = '900 86px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeText('?', w / 2, h / 2 + 6); g.fillStyle = '#fff'; g.fillText('?', w / 2, h / 2 + 6);
    });
    this.boxGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8); this.boxMat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x332200 });
    this.boxes = new Map();
    const oilTex = this.img.oil && this.img.oil.width ? new THREE.CanvasTexture(this.img.oil) : null; if (oilTex) oilTex.encoding = THREE.sRGBEncoding;
    this.oilGeo = new THREE.PlaneGeometry(5.2, 4.6); this.oilGeo.rotateX(-Math.PI / 2);
    this.oilMat = new THREE.MeshBasicMaterial({ map: oilTex, color: oilTex ? 0xFFFFFF : 0x15181E, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.oils = new Map();
  }
  _drawItems(snap) {
    const t = performance.now() / 1000;
    const keep = new Set();
    for (const b of snap.boxes) {
      let m = this.boxes.get(b.id);
      if (!m) { m = new THREE.Mesh(this.boxGeo, this.boxMat); m.castShadow = true; m.position.set(b.x, this.world.groundAt(b.x, b.y) + 1.6, b.y); m.userData.y = m.position.y; this.dyn.add(m); this.boxes.set(b.id, m); }
      m.visible = b.ready; m.rotation.y = t * 1.6 + b.id; m.rotation.x = 0.35; m.position.y = m.userData.y + Math.sin(t * 3 + b.id) * 0.25;
    }
    for (const o of snap.oils) {
      keep.add(o.id); let m = this.oils.get(o.id);
      if (!m) { m = new THREE.Mesh(this.oilGeo, this.oilMat); m.position.set(o.x, this.world.groundAt(o.x, o.y) + 0.12, o.y); m.rotation.y = -o.rot; this.dyn.add(m); this.oils.set(o.id, m); }
    }
    for (const [id, m] of this.oils) if (!keep.has(id)) { this.dyn.remove(m); this.oils.delete(id); }
  }

  /* ---------- skid marks: a ring buffer of thin quads ---------- */
  _initSkids() {
    this.skidMax = 900; this.skidN = 0;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.skidMax * 18), 3)); g.setDrawRange(0, 0);
    this.skidMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x1E1E1E, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide }));
    this.skidMesh.frustumCulled = false; this.dyn.add(this.skidMesh);
  }
  _skid(x0, z0, x1, z1, y) {
    const a = this.skidMesh.geometry.attributes.position.array, i = (this.skidN % this.skidMax) * 18;
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l * 0.25, nz = dx / l * 0.25; y += 0.1;
    a.set([x0 - nx, y, z0 - nz, x0 + nx, y, z0 + nz, x1 + nx, y, z1 + nz, x0 - nx, y, z0 - nz, x1 + nx, y, z1 + nz, x1 - nx, y, z1 - nz], i);
    this.skidN++; this.skidMesh.geometry.setDrawRange(0, Math.min(this.skidN, this.skidMax) * 6); this.skidMesh.geometry.attributes.position.needsUpdate = true;
  }

  /* ---------- particles: one point cloud, each point with its own colour, size and fade ---------- */
  _initParticles() {
    const N = this.pMax = 700;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('pcol', new THREE.BufferAttribute(new Float32Array(N * 4), 4));
    g.setAttribute('psize', new THREE.BufferAttribute(new Float32Array(N), 1));
    g.setDrawRange(0, 0);
    this.pMat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 500 } }, transparent: true, depthWrite: false,
      vertexShader: 'attribute vec4 pcol; attribute float psize; uniform float scale; varying vec4 vC; void main(){ vC=pcol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=clamp(psize*scale/-mv.z,1.0,36.0); if(-mv.z<4.0) gl_PointSize=0.0; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec4 vC; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard; gl_FragColor=vec4(vC.rgb, vC.a*smoothstep(0.5,0.3,r)); }',
    });
    this.pts = new THREE.Points(g, this.pMat); this.pts.frustumCulled = false; this.dyn.add(this.pts);
    this.parts = [];
  }
  _emit(x, y, z, vx, vy, vz, life, size, col, grav, grow) {
    if (this.parts.length >= this.pMax) this.parts.shift();
    this.parts.push({ x, y, z, vx, vy, vz, life, max: life, size, c: F1.parseCol(col), grav, grow });
  }
  _updateParticles(dt) {
    const P = this.parts, g = this.pts.geometry, pos = g.attributes.position.array, pc = g.attributes.pcol.array, ps = g.attributes.psize.array;
    let n = 0;
    for (const p of P) {
      p.life -= dt; if (p.life <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 0.92; p.vz *= 0.92; p.vy += (p.grav || 0) * dt;
      const a = p.life / p.max;
      pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
      pc[n * 4] = p.c[0]; pc[n * 4 + 1] = p.c[1]; pc[n * 4 + 2] = p.c[2]; pc[n * 4 + 3] = p.c[3] * a;
      ps[n] = p.grow ? p.size * (1.6 - a * 0.6) : p.size; n++;
    }
    this.parts = P.filter(p => p.life > 0);
    g.setDrawRange(0, n); g.attributes.position.needsUpdate = g.attributes.pcol.needsUpdate = g.attributes.psize.needsUpdate = true;
    this.pMat.uniforms.scale.value = this.H * this.gl.getPixelRatio() / (2 * Math.tan(this.camera.fov * Math.PI / 360));
  }

  /* ---------- name tags over nearby rivals ---------- */
  _drawTags(snap, meId) {
    const g = this.tg, W = this.W, H = this.H, cam = this.camera, v = new THREE.Vector3();
    g.setTransform(this.tdpr, 0, 0, this.tdpr, 0, 0); g.clearRect(0, 0, W, H);
    g.font = '800 12px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const me = this.cars.get(meId); if (!me) return;
    for (const c of snap.cars) {
      if (c.id === meId) continue;
      const o = this.cars.get(c.id); if (!o) continue;
      const d = o.root.position.distanceTo(me.root.position); if (d > 70) continue;
      v.copy(o.root.position); v.y += 2.6; v.project(cam); if (v.z > 1 || v.z < -1) continue;
      const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H; if (x < -40 || x > W + 40 || y < -20 || y > H + 20) continue;
      const w = g.measureText(c.name).width + 14; g.globalAlpha = Math.max(0.35, 1 - d / 80);
      g.fillStyle = 'rgba(20,30,40,.8)'; g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - 10, w, 20, 10) : g.rect(x - w / 2, y - 10, w, 20); g.fill();
      g.fillStyle = c.colour || '#fff'; g.beginPath(); g.arc(x - w / 2 + 9, y, 3.5, 0, 6.28); g.fill();
      g.fillStyle = '#fff'; g.fillText(c.name, x + 4, y + 0.5);
    }
    g.globalAlpha = 1;
  }

  /* ---------- minimap (2D) ---------- */
  drawMinimap(cv, snap, meId) {
    const T = this.track, g = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); this._miniPath = null; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const b = T.bounds, sc = Math.min((w - 16) / (b.x1 - b.x0), (h - 16) / (b.y1 - b.y0));
    const ox = (w - (b.x1 - b.x0) * sc) / 2 - b.x0 * sc, oy = (h - (b.y1 - b.y0) * sc) / 2 - b.y0 * sc;
    if (!this._miniPath) { const p = new Path2D(); for (let i = 0; i <= T.n; i += 2) { const j = i % T.n; i ? p.lineTo(T.x[j] * sc + ox, T.y[j] * sc + oy) : p.moveTo(T.x[j] * sc + ox, T.y[j] * sc + oy); } p.closePath(); this._miniPath = p; }
    g.lineJoin = 'round';
    g.strokeStyle = F1.INK; g.lineWidth = 7; g.stroke(this._miniPath);
    g.strokeStyle = '#F6F1E7'; g.lineWidth = 3.5; g.stroke(this._miniPath);
    for (const t of this.tunnels) { g.strokeStyle = '#59606A'; g.lineWidth = 3.5; g.beginPath(); for (let i = t.a; i <= t.b; i++) { const j = i % T.n; i === t.a ? g.moveTo(T.x[j] * sc + ox, T.y[j] * sc + oy) : g.lineTo(T.x[j] * sc + ox, T.y[j] * sc + oy); } g.stroke(); }
    const s0 = T.pointAt(0, 0); g.fillStyle = '#fff'; g.strokeStyle = F1.INK; g.lineWidth = 2; g.beginPath(); g.arc(s0.x * sc + ox, s0.y * sc + oy, 4, 0, 6.28); g.fill(); g.stroke();
    for (const c of snap.cars) { if (c.id === meId) continue; g.fillStyle = c.colour; g.strokeStyle = F1.INK; g.lineWidth = 1.2; g.beginPath(); g.arc(c.x * sc + ox, c.y * sc + oy, 3.2, 0, 6.28); g.fill(); g.stroke(); }
    const me = snap.cars.find(c => c.id === meId);
    if (me) { g.fillStyle = '#FFE36B'; g.strokeStyle = F1.INK; g.lineWidth = 2.2; g.beginPath(); g.arc(me.x * sc + ox, me.y * sc + oy, 5.5, 0, 6.28); g.fill(); g.stroke(); }
  }

  /** Height profile of the lap with your position on it. */
  drawElevation(cv, s) {
    const T = this.track, g = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const lo = T.elevMin - 5, hi = T.elevMax + 5, X = f => 4 + f * (w - 8), Y = e => h - 4 - (e - lo) / (hi - lo) * (h - 8);
    g.beginPath(); g.moveTo(X(0), h);
    for (let i = 0; i < T.n; i += 6) g.lineTo(X(T.cum[i] / T.length), Y(T.elev[i]));
    g.lineTo(X(1), h); g.closePath(); g.fillStyle = 'rgba(111,167,90,.55)'; g.fill();
    g.strokeStyle = '#F6F1E7'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < T.n; i += 6) { const x = X(T.cum[i] / T.length), y = Y(T.elev[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    const i = T.indexAtS(s); g.fillStyle = '#FFE36B'; g.strokeStyle = F1.INK; g.lineWidth = 2; g.beginPath(); g.arc(X(s / T.length), Y(T.elev[i]), 5, 0, 6.28); g.fill(); g.stroke();
    return Math.round(T.elev[i]);
  }
};

/* =====================================================================
   WORLD3D: the circuit itself, built from the track centreline.
   Road, run-off, kerbs, barriers, terrain that follows the track's height,
   trees / city blocks / harbour, grandstands, corner boards, start gantry.
   ===================================================================== */
F1.World3D = class World3D {
  constructor(T) {
    this.T = T; const def = T.def, th = def.theme;
    this.group = new THREE.Group(); this.detail = [];
    this.base = T.elevMin;
    this.rnd = F1.seededRandom([...T.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    this._sky(th);
    this._terrain(th);
    this._road(th);
    for (const P of this.T.pits) this._pitLane(th, P);
    this._scenery(th);
    this._gantry();
  }
  roadY(i) { return this.T.elev[i] - this.base; }

  /* ---------- sky and fog ---------- */
  _sky(th) {
    const city = th.props === 'city', night = !!th.night;
    const g = new THREE.SphereGeometry(1400, 24, 12), c = [];
    const top = LIN(night ? 0x070B1E : 0x3A6EA8), mid = LIN(night ? 0x24164A : city ? 0xF9C99A : 0xFFC98F), low = LIN(night ? 0x9C3A78 : city ? 0xFBE3C6 : 0xFFE7B8);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 1400; const col = y > 0.08 ? mid.clone().lerp(top, Math.min(1, (y - 0.08) / 0.5)) : low.clone().lerp(mid, Math.max(0, (y + 0.05) / 0.13)); c.push(col.r, col.g, col.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    this.sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.renderOrder = -1;
    if (night) {   // stars
      const sp = []; for (let i = 0; i < 900; i++) { const a = Math.random() * 6.283, e = 0.12 + Math.random() * 1.3, r = 1350; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      this.sky.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xFFFFFF, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
    }
    this.fogNear = night ? 220 : 260; this.fogFar = night ? 1150 : 1250;
    this.fog = new THREE.Fog(night ? 0x2A1840 : city ? 0xF6DCC0 : 0xFFDDB0, this.fogNear, this.fogFar);
  }

  /* ---------- nearest centreline point (for terrain and prop heights) ---------- */
  _nearest(x, y) {
    // candidates from the four surrounding grid points, then a short exact search along the lap around each
    const T = this.T, G = this.ng, n = T.n;
    const fx = Math.max(0, Math.min(G.nx - 2, Math.floor((x - G.x0) / G.step))), fy = Math.max(0, Math.min(G.ny - 2, Math.floor((y - G.y0) / G.step)));
    let best = Infinity, bi = 0;
    for (const c of [fy * G.nx + fx, fy * G.nx + fx + 1, (fy + 1) * G.nx + fx, (fy + 1) * G.nx + fx + 1]) {
      const i0 = G.idx[c];
      for (let d = -10; d <= 10; d++) { const i = (i0 + d + n) % n, dd = (T.x[i] - x) ** 2 + (T.y[i] - y) ** 2; if (dd < best) { best = dd; bi = i; } }
    }
    return { i: bi, d: Math.sqrt(best) };
  }
  /** Nearest centreline point for every grid point (jump flooding: fast even for big grids). */
  _nearestGrid(x0, y0, nx, ny, step) {
    const T = this.T, idx = new Int32Array(nx * ny).fill(-1), dist = new Float32Array(nx * ny).fill(Infinity);
    const cx = new Float32Array(nx * ny), cy = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { cx[j * nx + i] = x0 + i * step; cy[j * nx + i] = y0 + j * step; }
    for (let k = 0; k < T.n; k++) {
      const i = Math.round((T.x[k] - x0) / step), j = Math.round((T.y[k] - y0) / step); if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
      const c = j * nx + i, d = Math.hypot(T.x[k] - cx[c], T.y[k] - cy[c]); if (d < dist[c]) { dist[c] = d; idx[c] = k; }
    }
    let k = 1; while (k * 2 < Math.max(nx, ny)) k *= 2;
    const passes = []; for (; k >= 1; k >>= 1) passes.push(k); passes.push(1, 1);
    for (const s of passes) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const ii = i + a * s, jj = j + b * s; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const q = idx[jj * nx + ii]; if (q < 0 || q === idx[c]) continue;
        const d = Math.hypot(T.x[q] - cx[c], T.y[q] - cy[c]); if (d < dist[c]) { dist[c] = d; idx[c] = q; }
      }
    }
    return { idx, dist };
  }

  /* ---------- terrain: a height grid that hugs the track and rolls away into hills ---------- */
  _terrain(th) {
    const T = this.T, b = T.bounds, vegas = th.props === 'vegas', city = th.props === 'city' || vegas, forest = th.props === 'forest';
    const M = city ? 260 : 520, step = city ? 10 : 14;
    const x0 = b.x0 - M, y0 = b.y0 - M, nx = Math.ceil((b.x1 - b.x0 + 2 * M) / step) + 1, ny = Math.ceil((b.y1 - b.y0 + 2 * M) / step) + 1;
    const H = new Float32Array(nx * ny), D = new Float32Array(nx * ny);
    const NG = this._nearestGrid(x0, y0, nx, ny, step); this.ng = { x0, y0, nx, ny, step, idx: NG.idx };
    const noise = (x, y) => Math.sin(x * 0.011 + 1.3) * Math.cos(y * 0.013 - 0.7) + 0.5 * Math.sin(x * 0.027 + y * 0.019) + 0.25 * Math.cos(x * 0.051 - y * 0.043);
    const corr = T.wallOff + 4;
    this.sea = city && !vegas ? -3 : null;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * step, y = y0 + j * step, n = { i: NG.idx[j * nx + i], d: NG.dist[j * nx + i] }, e = this.roadY(n.i);
      const out = Math.max(0, n.d - corr);
      let h = e - (city ? 0.35 : 0.6) - Math.min(out, 30) * 0.05;
      if (forest) h += (noise(x, y) + 0.6) * 26 * Math.min(1, Math.max(0, (out - 30) / 220));
      else if (!city) h += (noise(x, y) + 0.7) * 6 * Math.min(1, Math.max(0, (out - 40) / 260));
      else if (!vegas && n.d > 115) h = Math.min(h, this.sea - 2 - (n.d - 115) * 0.05);   // Monaco: the city stops at the harbour
      const edge = Math.min(i, nx - 1 - i, j, ny - 1 - j) * step; if (!city && edge < 160) h = -2 + (h + 2) * edge / 160;   // slope down to the far plain at the edge
      H[j * nx + i] = h; D[j * nx + i] = n.d;
    }
    // where two parts of the lap pass close at different heights (Monaco's hairpin), never let the ground
    // rise above either road: carve it below every road nearby. Retaining walls under the road edges hide the drop.
    const rc = Math.ceil((T.wallOff + 1) / step) + 1;
    for (let k = 0; k < T.n; k++) {
      const ci = Math.round((T.x[k] - x0) / step), cj = Math.round((T.y[k] - y0) / step), lim = this.roadY(k) - (city ? 0.35 : 0.6), r2 = (T.wallOff + 1 + step) ** 2;
      for (let j = cj - rc; j <= cj + rc; j++) for (let i = ci - rc; i <= ci + rc; i++) {
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        if ((x0 + i * step - T.x[k]) ** 2 + (y0 + j * step - T.y[k]) ** 2 > r2) continue;
        if (H[j * nx + i] > lim) H[j * nx + i] = lim;
      }
    }
    const prc = Math.ceil(22 / step) + 1;
    for (const PL of T.pits) for (let k = 0; k < PL.n; k += 2) {
      const s = PL.entryS + k * PL.step, ci = Math.round((PL.xs[k] - x0) / step), cj = Math.round((PL.ys[k] - y0) / step), lim = this.roadY(T.indexAtS(s)) - 0.4;
      for (let j = cj - prc; j <= cj + prc; j++) for (let i = ci - prc; i <= ci + prc; i++) {
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        if ((x0 + i * step - PL.xs[k]) ** 2 + (y0 + j * step - PL.ys[k]) ** 2 > 24 * 24) continue;
        if (H[j * nx + i] > lim) H[j * nx + i] = lim;
      }
    }
    this.tg = { x0, y0, nx, ny, step, H };
    const g = new THREE.PlaneGeometry(1, 1, nx - 1, ny - 1), p = g.attributes.position, col = [];
    const gA = LIN(th.ground), gB = LIN(th.groundDark), pave = LIN(city ? '#B9B4AA' : th.ground), sand = LIN('#D9C9A0');
    for (let k = 0; k < p.count; k++) {
      const i = k % nx, j = Math.floor(k / nx), x = x0 + i * step, y = y0 + j * step;
      p.setXYZ(k, x, H[j * nx + i], y);
      const t = 0.5 + 0.5 * Math.sin(x * 0.02 + Math.cos(y * 0.017) * 2);
      let c = gA.clone().lerp(gB, city ? 0.3 * t : t * 0.8);
      if (city && !vegas && D[j * nx + i] > 100) c = sand.clone().lerp(pave, Math.max(0, Math.min(1, (115 - D[j * nx + i]) / 15)));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); m.receiveShadow = true;
    this.group.add(m);
    if (city && !vegas) {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: LIN('#2F87B8') }));
      sea.rotation.x = -Math.PI / 2; sea.position.set((b.x0 + b.x1) / 2, this.sea, (b.y0 + b.y1) / 2); this.group.add(sea);
    } else {   // far-off ground beyond the terrain grid
      const far = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshLambertMaterial({ color: LIN(th.groundDark) }));
      far.rotation.x = -Math.PI / 2; far.position.set((b.x0 + b.x1) / 2, -2, (b.y0 + b.y1) / 2); this.group.add(far);
    }
  }
  /** Ground height at a game position (bilinear on the terrain grid). */
  groundAt(x, y) {
    const t = this.tg; if (!t) return 0;
    const fx = (x - t.x0) / t.step, fy = (y - t.y0) / t.step, i = Math.max(0, Math.min(t.nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(t.ny - 2, Math.floor(fy)));
    const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fy - j)), H = t.H, n = t.nx;
    const h = H[j * n + i] * (1 - u) * (1 - v) + H[j * n + i + 1] * u * (1 - v) + H[(j + 1) * n + i] * (1 - u) * v + H[(j + 1) * n + i + 1] * u * v;
    // on the circuit itself use the road height
    const loc = this._nearest(x, y); return loc.d < this.T.wallOff + 1 ? this.roadY(loc.i) : h;
  }

  /* ---------- offset line with the inside of tight bends held still (no folding) ---------- */
  _offset(off) {
    const T = this.T, n = T.n, pts = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { pts[i * 2] = T.x[i] + T.nx[i] * off; pts[i * 2 + 1] = T.y[i] + T.ny[i] * off; }
    const keep = new Uint8Array(n).fill(1);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, dx = pts[j * 2] - pts[i * 2], dy = pts[j * 2 + 1] - pts[i * 2 + 1]; if (dx * T.tx[i] + dy * T.ty[i] < 0 || Math.abs(T.k[i]) * Math.abs(off) > 0.85) { keep[i] = 0; keep[j] = 0; } }
    let lx = null, ly = null;
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) { if (keep[i]) { lx = pts[i * 2]; ly = pts[i * 2 + 1]; } else if (lx != null) { pts[i * 2] = lx; pts[i * 2 + 1] = ly; } }
    return pts;
  }
  /** A strip between two offset lines; colours may alternate in stripes; only where mask(i) is true. */
  _strip(offA, offB, yA, yB, colA, colB, stripe, mask, opts = {}) {
    const T = this.T, n = T.n, A = this._offset(offA), B = this._offset(offB), pos = [], col = [];
    const ca = LIN(colA), cb = colB ? LIN(colB) : ca;
    for (let i = 0; i < n; i++) {
      if (mask && !mask(i)) continue;
      const j = (i + 1) % n, ya = this.roadY(i), yb = this.roadY(j), c = stripe && Math.floor(i / stripe) % 2 ? cb : ca;
      const a0 = [A[i * 2], ya + yA, A[i * 2 + 1]], b0 = [B[i * 2], ya + yB, B[i * 2 + 1]], a1 = [A[j * 2], yb + yA, A[j * 2 + 1]], b1 = [B[j * 2], yb + yB, B[j * 2 + 1]];
      pos.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: !!opts.po, polygonOffsetFactor: opts.po || 0 }));
    m.receiveShadow = true; m.castShadow = !!opts.cast; this.group.add(m); return m;
  }

  _road(th) {
    const T = this.T, def = T.def, hw = T.hw, wo = T.wallOff;
    // run-off (gravel / grass / pavement), asphalt, white edge lines
    this._strip(-wo - 1, wo + 1, 0.0, 0.0, th.runoff, null, 0, null, { po: -1 });
    this._strip(-hw, hw, 0.04, 0.04, th.asphalt, null, 0, null, { po: -2 });
    this._strip(-hw + 0.3, -hw + 0.65, 0.06, 0.06, th.line, null, 0, null, { po: -3 });
    this._strip(hw - 0.65, hw - 0.3, 0.06, 0.06, th.line, null, 0, null, { po: -3 });
    // red and white kerbs on the tight bends, both edges
    const kerb = i => T.kerb[i] > 0;
    this._strip(-hw - 1.3, -hw + 0.05, 0.09, 0.05, '#E2483D', '#F2F2F2', 1, kerb, { po: -3 });
    this._strip(hw - 0.05, hw + 1.3, 0.05, 0.09, '#E2483D', '#F2F2F2', 1, kerb, { po: -3 });
    // retaining walls below the outer edges, so a road above lower ground never looks like it floats
    const skirt = th.props === 'city' ? ['#CFC3AE', '#C2B59E'] : [th.groundDark, null];
    for (const s of [-1, 1]) this._strip(s * (wo + 1), s * (wo + 1), -14, 0.0, skirt[0], skirt[1], 5, null);
    // barriers
    const gap = s => T.pits.some(P => P.side === s) ? (i => !T.inPitGap(T.cum[i], s)) : null;   // openings for the pit entry and exit roads
    if (def.wall === 'armco') {
      for (const s of [-1, 1]) { this._strip(s * wo, s * wo, 0.0, 1.0, '#C9D1D8', '#AEB7BF', 3, gap(s), { cast: true }); this._strip(s * (wo + 0.35), s * (wo + 0.35), 0.0, 1.0, '#9AA2AA', null, 0, gap(s)); }
    } else {
      for (const s of [-1, 1]) { this._strip(s * wo, s * wo, 0.0, 1.1, '#2B3138', '#F2F2F2', 2, gap(s), { cast: true }); this._strip(s * (wo + 0.8), s * (wo + 0.8), 0.0, 1.1, '#2B3138', null, 0, gap(s)); this._strip(s * wo, s * (wo + 0.8), 1.1, 1.1, '#3B82C4', null, 0, gap(s)); }
    }
    // Monaco tunnel: roof, outer wall and lights
    for (const [f0, f1] of def.tunnels || []) {
      const a = Math.round(f0 * T.n), b = Math.round(f1 * T.n), inT = i => i >= a && i <= b;
      this._strip(-wo - 1.5, wo + 1.5, 7.5, 7.5, '#8B8478', null, 0, inT, { cast: true });
      this._strip(-wo - 1.5, wo + 1.5, 8.3, 8.3, '#CFC6B6', null, 0, inT);
      this._strip(wo + 1.5, wo + 1.5, 0, 8.3, '#D8CFC0', null, 0, inT);
      this._strip(-wo - 1.5, -wo - 1.5, 0, 8.3, '#B7AE9E', '#A79E8E', 6, inT);
      this._strip(-1.0, 1.0, 7.45, 7.45, '#FFE9A8', '#6E675D', 3, inT);
    }
    // start line (chequered) and grid boxes
    const chk = F1.tex(128, 16, (g) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#1E1E1E' : '#FFFFFF'; g.fillRect(i * 8, j * 8, 8, 8); } });
    chk.magFilter = THREE.NearestFilter;
    const p0 = T.pointAt(0, 0), line = new THREE.Mesh(new THREE.PlaneGeometry(T.hw * 2, 2), new THREE.MeshLambertMaterial({ map: chk, polygonOffset: true, polygonOffsetFactor: -4 }));
    line.rotation.order = 'YXZ'; line.rotation.set(-Math.PI / 2, Math.atan2(Math.cos(p0.heading), Math.sin(p0.heading)), 0, 'YXZ'); line.position.set(p0.x, this.roadY(0) + 0.07, p0.y); this.group.add(line);
    const gp = [], white = LIN('#FFFFFF');
    for (const s of T.grid) {
      const hx = Math.cos(s.heading), hy = Math.sin(s.heading), rx = -hy, ry = hx, i = T.indexAtS(s.s), y = this.roadY(i) + 0.07;
      const seg = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy), nx = -dy / l * 0.15, ny = dx / l * 0.15; gp.push(ax - nx, y, ay - ny, ax + nx, y, ay + ny, bx + nx, y, by + ny, ax - nx, y, ay - ny, bx + nx, y, by + ny, bx - nx, y, by - ny); };
      seg(s.x + hx * 3.4 + rx * 1.7, s.y + hy * 3.4 + ry * 1.7, s.x + hx * 3.4 - rx * 1.7, s.y + hy * 3.4 - ry * 1.7);
      seg(s.x + hx * 3.4 - rx * 1.7, s.y + hy * 3.4 - ry * 1.7, s.x - hx * 1.4 - rx * 1.7, s.y - hy * 1.4 - ry * 1.7);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    this.group.add(new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color: white, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 })));
  }

  /* ---------- scenery ---------- */
  _scenery(th) {
    const T = this.T, rnd = this.rnd, b = T.bounds, kind = th.props;
    const tiles = new Map(), tileSize = 220;
    const tileOf = (x, y) => { const k = Math.floor(x / tileSize) + ',' + Math.floor(y / tileSize); if (!tiles.has(k)) tiles.set(k, { trees: [], blocks: [] }); return tiles.get(k); };
    const vegas = kind === 'vegas', night = !!th.night;
    if (kind === 'city' || vegas) {
      // the same block layout rules as the 2D map, now with real heights
      const grid = new Map(), cell = 120, placed = [];
      const area = (b.x1 - b.x0 + 300) * (b.y1 - b.y0 + 300);
      for (let i = 0; i < area / 200; i++) {
        const x = b.x0 - 150 + rnd() * (b.x1 - b.x0 + 300), y = b.y0 - 150 + rnd() * (b.y1 - b.y0 + 300);
        const w = 10 + rnd() * 18, d = 10 + rnd() * 16, half = Math.hypot(w, d) / 2, near = this._nearest(x, y);
        if (near.d < T.wallOff + half + 3 || near.d > 100 || this._nearPit(x, y, half + 26)) continue;
        const key = Math.floor(x / cell) + ',' + Math.floor(y / cell), cx = Math.floor(x / cell), cy = Math.floor(y / cell);
        let clash = false; for (let a = -1; a <= 1 && !clash; a++) for (let c = -1; c <= 1 && !clash; c++) for (const o of grid.get((cx + a) + ',' + (cy + c)) || []) if (Math.hypot(o.x - x, o.y - y) < (half + o.half) * 0.8) { clash = true; break; }
        if (clash) continue;
        const o = { x, y, w, d, half, rot: T.head[near.i], h: vegas ? 14 + rnd() * (near.d > 45 ? 95 : 30) : 10 + rnd() * 26 * (near.d > 50 ? 1.3 : 1), col: ['#F2D7B6', '#E8B49A', '#F6EBD2', '#D9C3A3', '#F0C9A0', '#E7D9C4', '#EFD3B5', '#F5EBDD'][Math.floor(rnd() * 8)], roof: rnd() < 0.6 };
        if (!grid.has(key)) grid.set(key, []); grid.get(key).push(o); placed.push(o); tileOf(x, y).blocks.push(o);
      }
      // palm trees along the harbour side
      const inTunnel = s => (T.def.tunnels || []).some(([a, b]) => s / T.length > a - 0.02 && s / T.length < b + 0.02);
      for (let s = 0; s < T.length; s += 34) for (const side of [-1, 1]) { const p = T.pointAt(s, side * (T.wallOff + 3.5)), n = this._nearest(p.x, p.y); if (inTunnel(s) || n.d < T.wallOff + 2.5 || this._nearPit(p.x, p.y, 20) || placed.some(o => Math.hypot(o.x - p.x, o.y - p.y) < o.half + 3)) continue; tileOf(p.x, p.y).trees.push({ x: p.x, y: p.y, s: 0.8 + rnd() * 0.3, kind: 2, rot: rnd() * 6.28 }); }
    } else {
      const area = (b.x1 - b.x0 + 400) * (b.y1 - b.y0 + 400), forest = kind === 'forest';
      const tries = forest ? area / 170 : area / 520, maxD = forest ? 330 : 240;
      for (let i = 0; i < tries; i++) {
        const x = b.x0 - 200 + rnd() * (b.x1 - b.x0 + 400), y = b.y0 - 200 + rnd() * (b.y1 - b.y0 + 400), n = this._nearest(x, y);
        if (n.d < T.wallOff + 8 || n.d > maxD || this._nearPit(x, y, 30)) continue;
        if (!forest && rnd() < 0.35 && n.d > 60) continue;
        tileOf(x, y).trees.push({ x, y, s: 0.75 + rnd() * 0.6, kind: forest ? (rnd() < 0.85 ? 0 : 1) : (rnd() < 0.5 ? 0 : 1), rot: rnd() * 6.28 });
      }
    }
    // shared geometries
    const pine = F1.mergeColoured([
      [new THREE.CylinderGeometry(0.35, 0.5, 2.4, 6), '#8A5A3B', M4(0, 1.2, 0)],
      [new THREE.ConeGeometry(3.2, 4.6, 7), '#2F8F5B', M4(0, 4.0, 0)],
      [new THREE.ConeGeometry(2.6, 3.8, 7), '#37A066', M4(0, 6.0, 0)],
      [new THREE.ConeGeometry(1.8, 3.0, 7), '#44B272', M4(0, 7.9, 0)],
    ]);
    const round = F1.mergeColoured([
      [new THREE.CylinderGeometry(0.35, 0.5, 3.0, 6), '#8A5A3B', M4(0, 1.5, 0)],
      [new THREE.IcosahedronGeometry(3.0, 0), '#5DAE4B', M4(0, 5.0, 0)],
      [new THREE.IcosahedronGeometry(2.0, 0), '#72C25A', M4(0.9, 6.6, 0.4)],
    ]);
    const palm = F1.mergeColoured([
      [new THREE.CylinderGeometry(0.22, 0.35, 7, 6), '#A47750', M4(0, 3.5, 0, 0, 0, 0.08)],
      ...[0, 1, 2, 3, 4, 5].map(k => [new THREE.BoxGeometry(4.2, 0.15, 1.0), k % 2 ? '#3E9A55' : '#4CB063', M4(Math.cos(k * 1.047) * 1.9, 7.0, Math.sin(k * 1.047) * 1.9, 0, -k * 1.047, -0.35)]),
    ]);
    const geos = [pine, round, palm], treeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const winTex = F1.tex(64, 128, (g, w, h) => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h); for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) { g.fillStyle = '#7FA6C4'; g.fillRect(8 + c * 19, 10 + r * 20, 11, 12); g.fillStyle = '#5D7F9A'; g.fillRect(8 + c * 19, 18 + r * 20, 11, 4); } g.fillStyle = '#D8CBB8'; g.fillRect(0, h - 8, w, 8); });
    const glowTex = night ? F1.tex(64, 128, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) if (Math.random() < 0.62) { g.fillStyle = ['#FFD98A', '#FFF1C8', '#9FE6FF', '#FFB46B'][Math.floor(Math.random() * 4)]; g.fillRect(8 + c * 19, 10 + r * 20, 11, 12); } }) : null;
    const blockGeo = new THREE.BoxGeometry(1, 1, 1), blockMat = night ? new THREE.MeshLambertMaterial({ map: winTex, emissive: 0xFFFFFF, emissiveMap: glowTex, emissiveIntensity: 0.95 }) : new THREE.MeshLambertMaterial({ map: winTex }), roofMat = new THREE.MeshLambertMaterial({ color: LIN('#C8664A') }), flatMat = new THREE.MeshLambertMaterial({ color: LIN('#D9CFC0') });
    const dummy = new THREE.Object3D();
    for (const [, t] of tiles) {
      for (let k = 0; k < 3; k++) {
        const list = t.trees.filter(o => o.kind === k); if (!list.length) continue;
        const im = new THREE.InstancedMesh(geos[k], treeMat, list.length);
        list.forEach((o, i) => { dummy.position.set(o.x, this.groundAt(o.x, o.y) - 0.2, o.y); dummy.rotation.set(0, o.rot, 0); dummy.scale.setScalar(o.s * (k === 0 ? 1.25 : 1.1)); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
        im.castShadow = true; im.receiveShadow = false; im.computeBoundingSphere && im.computeBoundingSphere(); this._fixBounds(im, list); this.group.add(im);
      }
      if (t.blocks.length) {
        const im = new THREE.InstancedMesh(blockGeo, blockMat, t.blocks.length), roofs = t.blocks.filter(o => o.roof), rf = new THREE.InstancedMesh(blockGeo, roofMat, Math.max(1, roofs.length)), fl = new THREE.InstancedMesh(blockGeo, flatMat, Math.max(1, t.blocks.length - roofs.length));
        let ri = 0, fi = 0;
        t.blocks.forEach((o, i) => {
          const gy = this.groundAt(o.x, o.y) - 1;
          dummy.position.set(o.x, gy + o.h / 2, o.y); dummy.rotation.set(0, -o.rot, 0); dummy.scale.set(o.w, o.h, o.d); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, night ? LIN(o.col).multiplyScalar(0.42) : LIN(o.col));
          dummy.position.y = gy + o.h + 0.5; dummy.scale.set(o.w + 0.8, 1.0, o.d + 0.8); dummy.updateMatrix();
          if (o.roof) rf.setMatrixAt(ri++, dummy.matrix); else fl.setMatrixAt(fi++, dummy.matrix);
        });
        rf.count = ri; fl.count = fi;
        for (const m of [im, rf, fl]) { m.castShadow = true; m.receiveShadow = true; this._fixBounds(m, t.blocks, 40); this.group.add(m); }
      }
    }
    if (night) this._nightLights(th, tiles);
    // grandstands on the outside of the listed spots
    const stand = this._standGeo(th);
    for (const f of T.def.grandstands || []) {
      const s = f * T.length, i = T.indexAtS(s); let side = T.k[i] > 0 ? -1 : 1;
      { const q = T.pointAt(s, side * (T.wallOff + 9)); if (this._nearPit(q.x, q.y, 34)) side = -side; }   // keep the pit side clear
      const p = T.pointAt(s, side * (T.wallOff + 9));
      const m = new THREE.Mesh(stand, treeMat); m.position.set(p.x, this.roadY(i) - 0.2, p.y);
      m.rotation.y = Math.atan2(side * Math.sin(p.heading), -side * Math.cos(p.heading));   // seats face the track
      m.castShadow = m.receiveShadow = true; this.group.add(m);
    }
    // tyre stacks at the outside of tight corners
    const ty = []; for (const c of T.corners) { if (!c.radius || c.radius > 140) continue; const side = T.k[c.i] > 0 ? -1 : 1; for (let d = -20; d <= 20; d += 2.2) { const p = T.pointAt(c.s + d, side * (T.wallOff + 0.75)); ty.push({ x: p.x, y: p.y, red: Math.round(d / 2.2) % 2 === 0, e: this.roadY(T.indexAtS(c.s + d)) }); } }
    if (ty.length) {
      const tg = new THREE.CylinderGeometry(0.62, 0.62, 1.2, 10), im = new THREE.InstancedMesh(tg, new THREE.MeshLambertMaterial({}), ty.length);
      ty.forEach((o, i) => { dummy.position.set(o.x, o.e + 0.6, o.y); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, LIN(o.red ? '#D9302C' : '#F2F2F2')); });
      im.castShadow = true; this.group.add(im); this.detail.push(im);
    }
    // corner name boards before each named bend
    for (const c of T.corners) {
      const side = T.k[c.i] > 0 ? -1 : 1, sb = c.s - 70, p = T.pointAt(sb, side * (T.wallOff + 3)), i = T.indexAtS(sb);
      const tex = F1.tex(512, 96, (g, w, h) => { g.fillStyle = '#13233A'; g.fillRect(0, 0, w, h); g.strokeStyle = '#FFE36B'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = '#FFFFFF'; let fs = 52; g.font = `${fs}px Bungee, Nunito, sans-serif`; while (g.measureText(c.name.toUpperCase()).width > w - 40 && fs > 20) { fs -= 2; g.font = `${fs}px Bungee, Nunito, sans-serif`; } g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c.name.toUpperCase(), w / 2, h / 2 + 3); });
      const board = new THREE.Group();
      const face = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.9), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); face.position.y = 3.6; board.add(face);
      for (const sx of [-4, 4]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.6, 6), new THREE.MeshLambertMaterial({ color: 0x59606A })); post.position.set(sx, 1.8, -0.05); board.add(post); }
      board.position.set(p.x, this.roadY(i), p.y);
      board.rotation.y = Math.atan2(Math.cos(p.heading), Math.sin(p.heading)) + Math.PI;   // faces the cars coming towards it
      board.rotateY(side * 0.35);
      this.group.add(board); this.detail.push(board);
    }
  }
  /** Night circuit: street lamps with pools of light, neon roof lines, maths billboards and a glowing sphere. */
  _nightLights(th, tiles) {
    const T = this.T, rnd = this.rnd, dummy = new THREE.Object3D(), lamps = [], pools = [];
    for (let s = 0; s < T.length; s += 36) for (const side of [-1, 1]) {
      const i = T.indexAtS(s), p = T.pointAt(s, side * (T.wallOff + 1.2)); if (this._nearPit(p.x, p.y, 4)) continue;
      lamps.push({ x: p.x, y: p.y, e: this.roadY(i), h: p.heading, side }); const q = T.pointAt(s, side * T.hw * 0.45); pools.push({ x: q.x, y: q.y, e: this.roadY(i) });
    }
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.18, 10, 6), new THREE.MeshLambertMaterial({ color: 0x2B3138 }), lamps.length);
    const head = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.35, 0.7), new THREE.MeshBasicMaterial({ color: 0xFFF0C8 }), lamps.length);
    lamps.forEach((l, k) => {
      dummy.position.set(l.x, l.e + 5, l.y); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); pole.setMatrixAt(k, dummy.matrix);
      dummy.position.set(l.x - Math.sin(l.h) * -l.side * 1.6, l.e + 10, l.y + Math.cos(l.h) * -l.side * 1.6); dummy.rotation.set(0, -l.h + Math.PI / 2, 0); dummy.updateMatrix(); head.setMatrixAt(k, dummy.matrix);
    });
    this.group.add(pole, head);
    const poolTex = F1.tex(64, 64, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,225,170,0.55)'); r.addColorStop(1, 'rgba(255,225,170,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    const pg = new THREE.PlaneGeometry(22, 22); pg.rotateX(-Math.PI / 2);
    const pool = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6 }), pools.length);
    pools.forEach((q, k) => { dummy.position.set(q.x, q.e + 0.12, q.y); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); pool.setMatrixAt(k, dummy.matrix); });
    pool.renderOrder = 2; this.group.add(pool);
    // neon outlines on the tall buildings
    const neon = ['#FF3EA5', '#2EF2FF', '#FFE36B', '#A65BFF', '#FF8A1F'], bars = [];
    for (const [, t] of tiles) for (const o of t.blocks) if (o.h > 34 && rnd() < 0.8) {
      const c = neon[Math.floor(rnd() * neon.length)], gy = this.groundAt(o.x, o.y) - 1, ca = Math.cos(-o.rot), sa = Math.sin(-o.rot);
      for (const y of [o.h + 1.1, o.h * 0.55]) for (const [lx, lz, len, rot] of [[0, o.d / 2 + 0.5, o.w + 1, 0], [0, -o.d / 2 - 0.5, o.w + 1, 0], [o.w / 2 + 0.5, 0, o.d + 1, Math.PI / 2], [-o.w / 2 - 0.5, 0, o.d + 1, Math.PI / 2]])
        bars.push({ x: o.x + lx * ca + lz * sa, z: o.y - lx * sa + lz * ca, y: gy + y, len, rot: -o.rot + rot, c });
    }
    if (bars.length) {
      const nb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.45, 0.45), new THREE.MeshBasicMaterial({ color: 0xFFFFFF }), bars.length);
      bars.forEach((b, k) => { dummy.position.set(b.x, b.y, b.z); dummy.rotation.set(0, b.rot, 0); dummy.scale.set(b.len, 1, 1); dummy.updateMatrix(); nb.setMatrixAt(k, dummy.matrix); nb.setColorAt(k, new THREE.Color(b.c)); });
      this._fixBounds(nb, bars.map(b => ({ x: b.x, y: b.z })), 60); this.group.add(nb);
    }
    // maths billboards facing the track
    const words = [['π = 3.14', '#2EF2FF'], ['x² + y²', '#FF3EA5'], ['7 × 8 = 56', '#FFE36B'], ['MATHCADE GP', '#FF8A1F'], ['½ + ¼ = ¾', '#A65BFF'], ['√144 = 12', '#2EF2FF'], ['a² + b² = c²', '#FF3EA5'], ['GO FASTER', '#FFE36B']];
    words.forEach(([w, c], k) => {
      const s = T.length * (0.08 + k * 0.11), side = k % 2 ? 1 : -1, p = T.pointAt(s, side * (T.wallOff + 7)); if (this._nearPit(p.x, p.y, 8)) return;
      const tex = F1.tex(512, 192, (g, W, H) => { g.fillStyle = '#0B0F22'; g.fillRect(0, 0, W, H); g.strokeStyle = c; g.lineWidth = 10; g.shadowColor = c; g.shadowBlur = 24; g.strokeRect(14, 14, W - 28, H - 28); g.font = '72px Bungee, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#FFFFFF'; g.fillText(w, W / 2, H / 2 + 4); g.fillStyle = c; g.globalAlpha = 0.5; g.fillText(w, W / 2, H / 2 + 4); });
      const b = new THREE.Group(), face = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); face.position.y = 9; b.add(face);
      for (const x of [-5, 5]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 9, 6), new THREE.MeshLambertMaterial({ color: 0x2B3138 })); post.position.set(x, 4.5, 0); b.add(post); }
      b.position.set(p.x, this.roadY(T.indexAtS(s)), p.y); b.rotation.y = Math.atan2(Math.cos(p.heading), Math.sin(p.heading)) + Math.PI + side * 0.6; this.group.add(b);
    });
    // a giant glowing sphere inside the loop
    let spot = null;
    for (let f = 0.30; f < 0.42 && !spot; f += 0.01) for (const side of [-1, 1]) for (const d of [110, 140, 90]) { const p = T.pointAt(f * T.length, side * d); if (this._nearest(p.x, p.y).d > 80 && !this._nearPit(p.x, p.y, 60)) { spot = p; break; } }
    if (spot) {
      const tex = F1.tex(1024, 512, (g, W, H) => {
        const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#2EF2FF'); gr.addColorStop(0.35, '#A65BFF'); gr.addColorStop(0.7, '#FF3EA5'); gr.addColorStop(1, '#FFE36B'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.font = '120px Bungee, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,.92)';
        for (let k = 0; k < 2; k++) g.fillText('MATHCADE', W * (0.25 + k * 0.5), H * 0.5);
        g.font = '60px Bungee, sans-serif'; g.fillStyle = 'rgba(19,35,58,.55)'; ['π', '×', '÷', '√', '∑', '+', '%', '='].forEach((m, k) => g.fillText(m, (k + 0.5) * W / 8, H * 0.2 + (k % 2) * H * 0.6));
      });
      const sph = new THREE.Mesh(new THREE.SphereGeometry(48, 48, 24), new THREE.MeshBasicMaterial({ map: tex })); sph.position.set(spot.x, this.groundAt(spot.x, spot.y) + 44, spot.y); this.group.add(sph); this.sphere = sph;
    }
  }

  /** Is (x,y) within r metres of the pit lane or its garages? */
  _nearPit(x, y, r) {
    if (!this._pitBoxes) this._pitBoxes = this.T.pits.map(P => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (let k = 0; k < P.n; k++) { a = Math.min(a, P.xs[k]); b = Math.max(b, P.xs[k]); c = Math.min(c, P.ys[k]); d = Math.max(d, P.ys[k]); } return [a - 80, b + 80, c - 80, d + 80]; });
    const rr = (r + 14) ** 2;
    return this.T.pits.some((P, j) => {
      const B = this._pitBoxes[j]; if (x < B[0] || x > B[1] || y < B[2] || y > B[3]) return false;
      for (let k = 0; k < P.n; k += 3) if ((P.xs[k] - x) ** 2 + (P.ys[k] - y) ** 2 < rr) return true;
      return false;
    });
  }

  /* ---------- pit lane, pit wall, garages and painted pit boxes ---------- */
  _pitLane(th, P) {
    const T = this.T, side = P.side, n = P.n, hwL = 4.5, G = F1.CONFIG.PIT.slotGap;
    const at = k => { const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1), h = Math.atan2(P.ys[b] - P.ys[a], P.xs[b] - P.xs[a]); return { x: P.xs[k], y: P.ys[k], nx: -Math.sin(h), ny: Math.cos(h), e: this.roadY(T.indexAtS(P.entryS + k * P.step)) }; };
    const quads = (o0, o1, y0, y1, colA, colB, stripe, mask) => {
      const pos = [], col = [], ca = LIN(colA), cb = colB ? LIN(colB) : ca;
      for (let k = 0; k < n - 1; k++) {
        if (mask && !mask(k)) continue;
        const A = at(k), B = at(k + 1), c = stripe && Math.floor(k / stripe) % 2 ? cb : ca;
        const v = (Q, o, y) => [Q.x + Q.nx * o, Q.e + y, Q.y + Q.ny * o];
        pos.push(...v(A, o0, y0), ...v(A, o1, y1), ...v(B, o0, y0), ...v(B, o0, y0), ...v(A, o1, y1), ...v(B, o1, y1)); for (let j = 0; j < 6; j++) col.push(c.r, c.g, c.b);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })); m.receiveShadow = true; this.group.add(m); return m;
    };
    quads(-hwL, hwL, 0.06, 0.06, th.asphalt);
    quads(-hwL, -hwL + 0.3, 0.08, 0.08, '#F4F4F4'); quads(hwL - 0.3, hwL, 0.08, 0.08, '#F4F4F4');
    // speed limiter lines where the limiter switches on and off
    const kIn = Math.round(F1.CONFIG.PIT.entryLen / P.step), kOut = Math.round((P.exitS - P.entryS) / P.step);
    quads(-hwL, hwL, 0.09, 0.09, '#F4F4F4', null, 0, k => k === kIn || k === kOut);
    // pit wall between the lane and the track, alongside the garages
    const kb0 = Math.round((P.boxStart - 15 - P.entryS) / P.step), kb1 = Math.round((P.exitS - 10 - P.entryS) / P.step), inner = -side * (hwL + 1.2);
    const wallM = quads(inner, inner, 0, 1.1, '#D9D4CA', '#CFC9BD', 4, k => k >= kb0 && k <= kb1); wallM.castShadow = true;
    quads(inner, inner, 1.1, 1.35, '#F2B800', null, 0, k => k >= kb0 && k <= kb1);
    // garages: one per car, open towards the lane, with a team colour header and a painted box on the lane
    const parts = [], cols = ['#E0362C', '#2F86D6', '#2EB86A', '#F2C51A', '#3A4148'];
    for (let slot = 0; slot < F1.CONFIG.MAX_PLAYERS; slot++) {
      const s = P.slotS(slot), Q = T.pitAt(s, P), e = this.roadY(T.indexAtS(s)), ry = Math.atan2(Math.cos(Q.heading), Math.sin(Q.heading));
      const nx = -Math.sin(Q.heading), ny = Math.cos(Q.heading), out = side * (hwL + 5.5);
      const W = M4(Q.x + nx * out, e, Q.y + ny * out, 0, ry, 0), f = side;   // local +x times f points back to the lane
      const L = (geo, hex, x, y, z) => parts.push([geo, hex, W.clone().multiply(M4(x, y, z))]);
      L(new THREE.BoxGeometry(10, 5.5, 0.3), '#ECE6DA', 0, 2.75, G / 2);                 // dividing wall
      L(new THREE.BoxGeometry(10.4, 0.5, G), '#F4F0E8', 0, 5.6, 0);                       // roof
      L(new THREE.BoxGeometry(0.4, 5.5, G), '#4A5059', -f * 5, 2.75, 0);                  // back wall
      L(new THREE.BoxGeometry(0.3, 1.0, G - 0.4), cols[slot % 5], f * 5.05, 5.0, 0);      // team colour header
      L(new THREE.BoxGeometry(9.6, 0.06, G - 0.4), '#5C636D', 0, 0.04, 0);                // garage floor
      for (const z of [-2.9, 2.9]) L(new THREE.BoxGeometry(3.4, 0.05, 0.25), '#FFE36B', f * 7.8, 0.1, z);   // the pit box lines
    }
    const m = new THREE.Mesh(F1.mergeColoured(parts), new THREE.MeshLambertMaterial({ vertexColors: true })); m.castShadow = m.receiveShadow = true; this.group.add(m);
  }

  /** InstancedMesh bounds default to the base geometry; widen them so tiles cull correctly. */
  _fixBounds(im, list, pad = 12) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const o of list) { x0 = Math.min(x0, o.x); x1 = Math.max(x1, o.x); z0 = Math.min(z0, o.y); z1 = Math.max(z1, o.y); }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, cy = this.groundAt(cx, cz);
    im.geometry = im.geometry.clone(); im.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, cy, cz), Math.hypot(x1 - x0, z1 - z0) / 2 + pad + 60);
  }
  _standGeo(th) {
    const parts = [], acc = th.accent || '#D9302C';
    for (let r = 0; r < 6; r++) parts.push([new THREE.BoxGeometry(30, 0.9, 1.6), r % 2 ? acc : '#F4F4F4', M4(0, 0.45 + r * 0.9, -r * 1.6)]);
    parts.push([new THREE.BoxGeometry(30, 6, 1), '#D8D2C6', M4(0, 3, -9.8)]);
    parts.push([new THREE.BoxGeometry(31, 0.4, 12), '#F4F4F4', M4(0, 9.6, -4.4, -0.12)]);
    for (const x of [-14.5, 0, 14.5]) parts.push([new THREE.BoxGeometry(0.4, 9.6, 0.4), '#59606A', M4(x, 4.8, -9.6)]);
    // crowd: little coloured blocks on the steps
    const cols = ['#FF5A3C', '#2EC4B6', '#FFE36B', '#2F86D6', '#FFFFFF', '#FF8A1F'];
    let k = 0; for (let r = 0; r < 6; r++) for (let x = -14; x <= 14; x += 1.6) if ((r * 31 + x * 7 + k++) % 3) parts.push([new THREE.BoxGeometry(0.7, 0.9, 0.6), cols[(r * 5 + k) % cols.length], M4(x, 1.3 + r * 0.9, -r * 1.6 - 0.2)]);
    return F1.mergeColoured(parts);
  }

  /* ---------- start gantry with five red lights ---------- */
  _gantry() {
    const T = this.T, p = T.pointAt(6, 0), y = this.roadY(T.indexAtS(6)), w = T.wallOff + 1.5;
    const g = new THREE.Group(), steel = new THREE.MeshLambertMaterial({ color: LIN('#2B3138') });
    for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8.5, 0.8), steel); post.position.set(s * w, 4.25, 0); post.castShadow = true; g.add(post); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 0.8, 1.6, 1.0), steel); beam.position.y = 8.2; beam.castShadow = true; g.add(beam);
    const banner = F1.tex(1024, 96, (c, W, H) => { c.fillStyle = '#13233A'; c.fillRect(0, 0, W, H); c.font = '64px Bungee, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFE36B'; c.fillText('MATHCADE GRAND PRIX', W / 2, H / 2 + 4); });
    const bn = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, 1.4), new THREE.MeshBasicMaterial({ map: banner })); bn.position.set(0, 8.2, -0.51); bn.rotation.y = Math.PI; g.add(bn);
    const bn2 = bn.clone(); bn2.position.z = 0.51; bn2.rotation.y = 0; g.add(bn2);
    this.lightMats = [];
    for (let i = 0; i < 5; i++) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.7), steel); pod.position.set((i - 2) * 1.5, 6.4, -0.3); g.add(pod);
      const mat = new THREE.MeshBasicMaterial({ color: 0x3A1010 }); this.lightMats.push(mat);
      for (const yy of [6.9, 5.9]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.38, 14), mat); l.position.set((i - 2) * 1.5, yy, -0.66); l.rotation.y = Math.PI; g.add(l); }
    }
    g.position.set(p.x, y, p.y); g.rotation.y = Math.atan2(Math.cos(p.heading), Math.sin(p.heading));
    this.group.add(g); this.lit = -2;
  }
  /** n lights on (0-5); -1 = all out (race on). */
  setLights(n) {
    if (n === this.lit) return; this.lit = n;
    this.lightMats.forEach((m, i) => m.color.setHex(n > i ? 0xFF2A1A : 0x3A1010));
  }
};
