/* =====================================================================
   AUDIO: small synthesised sounds (no files to download).
   Engine note follows your speed; beeps for the start, thuds for crashes,
   chimes for items and answers. Starts only after a click, as browsers require.
   ===================================================================== */
window.F1 = window.F1 || {};
F1.Audio = {
  ctx: null, on: true, engine: null,
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx, o1 = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; o2.detune.value = -1200; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(c.destination); o1.start(); o2.start();
    this.engine = { o1, o2, f, g };
  },
  setEngine(speed, throttle, active) {
    if (!this.engine) return;
    const t = this.ctx.currentTime, gear = Math.min(7, Math.floor(speed / 13)), within = (speed - gear * 13) / 13;
    const f = 70 + gear * 12 + within * 120 + (throttle ? 15 : 0);
    this.engine.o1.frequency.setTargetAtTime(f, t, 0.04); this.engine.o2.frequency.setTargetAtTime(f, t, 0.04);
    this.engine.f.frequency.setTargetAtTime(500 + speed * 18, t, 0.05);
    this.engine.g.gain.setTargetAtTime(this.on && active ? 0.035 + throttle * 0.03 : 0, t, 0.08);
  },
  tone(freq, dur = 0.15, type = 'square', vol = 0.12, slide = 0) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur = 0.25, vol = 0.25, lp = 900) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = vol;
    s.buffer = b; s.connect(f).connect(g).connect(c.destination); s.start();
  },
  play(name) {
    switch (name) {
      case 'count': this.tone(440, 0.22, 'square', 0.14); break;
      case 'go': this.tone(880, 0.5, 'square', 0.16); break;
      case 'crash': this.noise(0.3, 0.35, 700); break;
      case 'bump': this.noise(0.12, 0.18, 1200); break;
      case 'right': this.tone(660, 0.1, 'triangle', 0.16); setTimeout(() => this.tone(990, 0.16, 'triangle', 0.16), 90); break;
      case 'wrong': this.tone(220, 0.25, 'sawtooth', 0.1, -80); break;
      case 'item': this.tone(1046, 0.08, 'triangle', 0.14); setTimeout(() => this.tone(1318, 0.12, 'triangle', 0.14), 70); break;
      case 'oil': this.noise(0.4, 0.2, 400); break;
      case 'boost': this.tone(300, 0.35, 'sawtooth', 0.08, 500); break;
      case 'lap': this.tone(784, 0.12, 'triangle', 0.14); setTimeout(() => this.tone(1046, 0.2, 'triangle', 0.14), 110); break;
      case 'warn': this.tone(330, 0.18, 'square', 0.1); setTimeout(() => this.tone(330, 0.18, 'square', 0.1), 220); break;
      case 'finish': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, 'triangle', 0.15), i * 120)); break;
    }
  },
};
