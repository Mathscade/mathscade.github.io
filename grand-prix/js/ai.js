/* =====================================================================
   AI DRIVERS: practice racers that fill the grid until a live class joins.
   Each bot has its own pace, racing line, maths accuracy and thinking time,
   so the field spreads out naturally and maths still decides a lot.
   Bots use exactly the same inputs as a student: throttle, brake, steer,
   item and maths answers. They get no extra speed or grip.
   ===================================================================== */
window.F1 = window.F1 || {};

F1.BOT_NAMES = ['Ava', 'Leo', 'Mia', 'Noah', 'Zara', 'Kai', 'Isla', 'Jack', 'Ruby', 'Eli', 'Chloe', 'Max', 'Lily', 'Sam', 'Grace', 'Theo',
  'Ella', 'Finn', 'Maya', 'Oscar', 'Aria', 'Hugo', 'Ivy', 'Ned', 'Willow', 'Arlo', 'Sienna', 'Reid', 'Matilda', 'Jai', 'Harper', 'Toby'];

F1.Bot = class Bot {
  constructor(car, rnd) {
    this.car = car;
    this.pace = 0.68 + rnd() * 0.17;            // share of the ideal speed profile they drive at (a typical student is about 0.76)
    this.lineBias = (rnd() - 0.5) * 0.6;          // preferred side of the track
    this.accuracy = 0.55 + rnd() * 0.35;          // maths
    this.thinkMin = 2.2 + rnd() * 2; this.thinkMax = this.thinkMin + 2 + rnd() * 4;
    this.wobble = 0.02 + rnd() * 0.05;
    this.dodge = 0; this.dodgeT = 0; this.qTimer = null; this.oilDelay = 0; this.stuckT = 0;
  }

  think(server, dt) {
    const car = this.car, track = server.track, C = F1.CONFIG;
    const inp = car.input; inp.item = false;
    if (car.pit) { this.maths(server, dt); return; }   // in the pits the car drives itself; just answer
    if (car.finished) { inp.throttle = 0.4; inp.brake = 0; }

    // where to aim: a point ahead on our line, pulled to the inside of the coming bend
    const v = Math.max(0, car.speed);
    let kmax = 0; { const i0 = track.indexAtS(car.s); for (let n = 0; n < 10; n++) kmax = Math.max(kmax, Math.abs(track.k[(i0 + n) % track.n])); }
    const look = Math.min(9 + v * 0.55, 4 + 0.8 / Math.max(kmax, 1e-3));   // look less far ahead in tight bends so we don't clip the inside wall
    const ahead = track.wrapS(car.s + look);
    const kIdx = track.indexAtS(ahead + 20);
    const k = track.k[kIdx];
    let lat = this.lineBias * track.hw * 0.5 + Math.sign(k) * Math.min(1, Math.abs(k) * 70) * track.hw * (track.hw < 6 ? 0.25 : 0.45);   // + lat is the right side, the inside of a right-hander
    if (this.dodgeT > 0) { this.dodgeT -= dt; lat += this.dodge; }
    // a car alongside: keep our own lane instead of turning in on top of it
    for (const o of server.cars) {
      if (o === car || o.retired || o.pit) continue;
      let g = o.s - car.s; if (g < -track.length / 2) g += track.length; if (g > track.length / 2) g -= track.length;
      const dl = o.lat - car.lat;
      if (Math.abs(g) < 7 && Math.abs(dl) < 4.5) lat = car.lat - Math.sign(dl || 1) * 1.5 + (lat - car.lat) * 0.2;
    }
    lat = Math.max(-track.hw * 0.8, Math.min(track.hw * 0.8, lat));
    // steer along the track's own direction a little ahead, plus a correction towards our chosen lane.
    // (aiming straight at a point round the bend would cut the corner into the inside wall)
    const pi = track.indexAtS(car.s + 3 + v * 0.22);
    const latErr = lat - car.lat;
    const want = track.head[pi] + Math.atan2(latErr, 9 + v * 0.35);
    let d = want - car.h; d = Math.atan2(Math.sin(d), Math.cos(d));
    inp.steer = Math.max(-1, Math.min(1, d * 3.2 + (Math.random() - 0.5) * this.wobble));

    // how fast: the slowest speed we must reach over the next stretch, allowing for braking distance
    let vt = Infinity; const brake = C.CAR.brake * 0.72;
    const base = track.indexAtS(car.s), step = 3;
    for (let n = 0; n < 60; n += step) {
      const i = (base + n) % track.n, dist = n * (track.length / track.n);
      const care = track.def.runoff < 3 ? (track.vIdeal[i] < 30 ? 0.86 : 0.93) : 1;   // street circuits: no run-off, so leave a margin
      vt = Math.min(vt, Math.sqrt(Math.pow(track.vIdeal[i] * this.pace * care, 2) + 2 * brake * dist));
    }
    vt = Math.min(vt, F1.Physics.topSpeed(car, car.surface));
    if (car.finished) vt = Math.min(vt, 30);
    // traffic: look for a car in our lane ahead; pull out to pass, or hold station behind it
    let follow = null;
    for (const o of server.cars) {
      if (o === car || o.retired || o.pit) continue;
      let gap = o.s - car.s; if (gap < -track.length / 2) gap += track.length;
      if (gap > 1 && gap < 30 + v * 0.8 && Math.abs(o.lat - car.lat) < 3.8) { if (!follow || gap < follow.gap) follow = { o, gap }; }
    }
    if (follow) {
      const o = follow.o;
      if (this.dodgeT <= 0 && o.speed < car.speed + 2) {
        const gapTo = x => { let g = x.s - car.s; if (g < -track.length / 2) g += track.length; if (g > track.length / 2) g -= track.length; return g; };
        const room = side => Math.abs(car.lat + side * 4) < track.hw * 0.85 && !server.cars.some(x => x !== car && x !== o && Math.abs(gapTo(x)) < 12 && Math.sign(x.lat - car.lat) === side && Math.abs(x.lat - car.lat) < 5);
        const pref = o.lat > car.lat ? -1 : 1, side = room(pref) ? pref : (room(-pref) ? -pref : 0);
        if (side) { this.dodge = side * 4; this.dodgeT = 1.6; }
      }
      // never closer than we could stop: match the car ahead's speed with room to spare
      vt = Math.min(vt, Math.sqrt(Math.max(0, o.speed) ** 2 + 2 * C.CAR.brake * 0.55 * Math.max(0, follow.gap - 9)) + 0.5);
    }

    inp.throttle = v < vt - 0.5 ? 1 : 0;
    inp.brake = v > vt + 2.5 ? Math.min(1, (v - vt) / 8) : 0;

    // oil: drop it when someone is close behind
    if (car.oilHeld) {
      this.oilDelay -= dt;
      if (this.oilDelay <= 0) {
        const behind = server.cars.some(o => { if (o === car) return false; let g = car.s - o.s; if (g < 0) g += track.length; return g > 4 && g < 30; });
        if (behind) { inp.item = true; this.oilDelay = 2; } else this.oilDelay = 0.5;
      }
    }

    // spun round and facing the wrong way: reset like a student pressing R
    if (car.wrongWay && server.phase === 'racing') { server.resetCar(car, 'manual'); car.wrongWayT = 0; car.wrongWay = false; }
    // stuck against something: reset like a student would
    if (server.phase === 'racing' && Math.abs(car.speed) < 1.5 && !car.finished) { this.stuckT += dt; if (this.stuckT > 3) { server.resetCar(car, 'stuck'); this.stuckT = 0; } }
    else this.stuckT = 0;

  }

  /** Pit stop maths: answer after a human-ish pause. */
  maths(server, dt) {
    const car = this.car, q = car.q;
    if (!q) { this.qTimer = null; return; }
    if (this.qTimer == null || this.qFor !== q.id) { this.qFor = q.id; this.qTimer = this.thinkMin + Math.random() * (this.thinkMax - this.thinkMin); }
    this.qTimer -= dt;
    if (this.qTimer <= 0) {
      const right = Math.random() < this.accuracy;
      const pick = right ? q.correct : (q.correct + 1 + Math.floor(Math.random() * (q.options.length - 1))) % q.options.length;
      server.answer(car.id, q.id, pick);
      this.qTimer = null;
    }
  }
};
