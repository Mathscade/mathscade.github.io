/* =====================================================================
   RACE SERVER: the single source of truth for a race.
   Clients only send INPUT (throttle/brake/steer), ITEM, RESET and ANSWER
   messages. The server owns positions, laps, checkpoints, collisions,
   damage, items, maths answers and results, so a client can't teleport,
   skip checkpoints, fake laps, invent items or fake answers.
   Today it runs in the browser (LocalTransport in net.js) with AI drivers
   filling the grid. The same class can run on a realtime backend unchanged.
   Phases: grid -> countdown -> racing -> finished
   Every lap has two pit stops: one half way round and one at the end of
   the lap. The car is driven into its garage, the driver answers the pit
   stop questions (each wrong answer adds a time penalty), then the car is
   driven out. Maths only happens in the pits.
   ===================================================================== */
window.F1 = window.F1 || {};

F1.CAR_SPRITES = (() => { const out = []; for (const m of [1, 2, 3, 4, 5]) for (const c of ['red', 'blue', 'green', 'yellow', 'black']) out.push(`car_${c}_${m}`); return out; })();
F1.CAR_COLOURS = { red: '#E0362C', blue: '#2F86D6', green: '#2EB86A', yellow: '#F2C51A', black: '#4A5258' };

F1.RaceServer = class RaceServer {
  constructor(trackId, settings) {
    this.settings = settings;
    this.track = new F1.Track(F1.TRACKS[trackId]);
    this.laps = settings.laps;
    this.questions = new F1.QuestionService(settings);
    this.items = new F1.Items(this.track, settings);
    this.collisionK = F1.CONFIG.INTENSITY[settings.collision || 'normal'];
    this.damageK = F1.CONFIG.INTENSITY[settings.damage || 'normal'];
    this.cars = []; this.bots = []; this.byId = new Map();
    this.phase = 'grid'; this.time = 0; this.raceTime = 0; this.countdown = 0;
    this.events = []; this.hitCooldown = new Map(); this.winnerTime = null; this.finishOrder = [];
    this.rnd = F1.seededRandom((Math.random() * 1e9) | 0);
  }

  // ---------- players ----------
  addPlayer({ id, name, sprite, isBot }) {
    if (this.cars.length >= Math.min(F1.CONFIG.MAX_PLAYERS, this.settings.maxPlayers || 32)) return null;
    const car = {
      id, name, isBot: !!isBot, sprite, colour: F1.CAR_COLOURS[sprite.split('_')[1]],
      x: 0, y: 0, h: 0, vx: 0, vy: 0, spin: 0, speed: 0, latSpeed: 0,
      input: { throttle: 0, brake: 0, steer: 0, item: false },
      seg: 0, s: 0, lat: 0, prog: 0, lapBase: 0, lapsDone: -1, nextGate: 0, lapStart: 0, lapTimes: [], bestLap: null, sectorStart: 0, sectors: [],
      surface: 'asphalt', offTrack: false, offStartProg: 0, offTravel: 0, offStart: null, penaltyT: 0, warnings: 0, stuckT: 0, wrongWayT: 0, wrongWay: false,
      health: 100, critical: false, ghostT: 0, slideT: 0, boostT: 0, slipT: 0, streak: 0, oilHeld: false,
      q: null, qWait: 0.5, lastResult: null, pit: null, pitStops: [], finished: false, finishTime: null, place: 0, retired: false,
      stats: { questions: 0, correct: 0, wrong: 0, damage: 0, oilCollected: 0, oilUsed: 0, oilHits: 0, collisions: 0, wallHits: 0, cuts: 0 },
      lastResetT: -10,
    };
    this.cars.push(car); this.byId.set(id, car);
    if (isBot) this.bots.push(new F1.Bot(car, this.rnd));
    return car;
  }

  // ---------- grid: ordered by the lobby reaction test (fastest on pole), no two cars on the same slot ----------
  placeGrid() {
    const tie = new Map(this.cars.map(c => [c, this.rnd()]));
    const order = this.cars.slice().sort((a, b) => ((a.reaction ?? 98) - (b.reaction ?? 98)) || tie.get(a) - tie.get(b));
    order.forEach((car, i) => {
      const g = this.track.grid[i];
      Object.assign(car, { x: g.x, y: g.y, h: g.heading, vx: 0, vy: 0, gridSlot: i + 1 });
      const loc = this.track.locate(car.x, car.y, null);
      car.seg = loc.i; car.s = loc.s; car.lat = loc.lat;
      car.prog = loc.s - this.track.length;          // grid is just behind the line: progress starts slightly negative
      car.lapBase = -this.track.length; car.nextGate = this.track.gates.length;
      car.prevX = car.x; car.prevY = car.y; car.prevH = car.h;
    });
    this.phase = 'grid';
  }

  startCountdown() { this.phase = 'countdown'; this.countdown = 3.0; this.emit('countdown', null, { n: 3 }); }

  emit(type, car, data) { this.events.push(Object.assign({ type, carId: car ? car.id : null, t: this.time }, data || {})); }

  // ---------- messages from clients ----------
  input(id, inp) {
    const car = this.byId.get(id); if (!car) return;
    car.input.throttle = Math.max(0, Math.min(1, +inp.throttle || 0));
    car.input.brake = Math.max(0, Math.min(1, +inp.brake || 0));
    car.input.steer = Math.max(-1, Math.min(1, +inp.steer || 0));
    if (inp.item) car.input.item = true;
  }

  answer(id, qid, index) {
    const car = this.byId.get(id); if (!car || !car.q || car.q.id !== qid) return null;
    const q = car.q, M = F1.CONFIG.MATHS;
    const right = index === q.correct, quick = this.time - q.asked <= M.fastAnswer;
    car.stats.questions++; right ? car.stats.correct++ : car.stats.wrong++;
    let reward = '';
    const p = car.pit, P = F1.CONFIG.PIT;
    if (p) {
      p.jobs++;
      if (right) { p.right++; car.streak++; reward = `Job ${p.jobs} of ${P.questions} done`; }
      else { p.wrong++; car.streak = 0; p.hold = P.wrongPenalty; reward = `+${P.wrongPenalty} s penalty`; }
      p.wait = P.nextQuestion;
    }
    car.lastResult = { qid, right, correct: q.correct, picked: index, kind: q.kind, reward, quick, at: this.time };
    car.q = null;
    this.emit('answer', car, { right, kind: q.kind });
    return car.lastResult;
  }

  useItem(id) { const car = this.byId.get(id); if (car) car.input.item = true; }

  resetCar(car, why) {
    if (this.time - car.lastResetT < 2.5 && why === 'manual') return;
    car.lastResetT = this.time;
    const back = car.offStart && why === 'cut' ? car.offStart : null;
    const s = back ? back.s : car.s;
    const p = this.track.pointAt(s, 0);
    Object.assign(car, { x: p.x, y: p.y, h: p.heading, vx: 0, vy: 0, spin: 0, slideT: 0, ghostT: F1.CONFIG.COLLISION.ghostAfterReset, offTrack: false, offStart: null, stuckT: 0, wrongWayT: 0, wrongWay: false });
    if (back) car.prog = back.prog;
    const loc = this.track.locate(car.x, car.y, car.seg); car.seg = loc.i; car.s = loc.s; car.lat = 0;
    this.emit('reset', car, { why });
  }

  // ---------- events raised by systems ----------
  onItemBox(car, box) {
    this.emit('itembox', car, { x: box.x, y: box.y });
    if (car.oilHeld || car.pit) return;   // already holding one: the box is just knocked out
    car.oilHeld = true; car.stats.oilCollected++; this.emit('gotoil', car);
  }
  onOilHit(car, oil) {
    const I = F1.CONFIG.ITEMS;
    car.slideT = I.oilSlideTime; car.spin += (Math.random() < 0.5 ? -1 : 1) * I.oilSpin;
    car.vx *= 1 - I.oilSpeedLoss; car.vy *= 1 - I.oilSpeedLoss;
    const owner = oil.owner != null ? this.byId.get(oil.owner) : null;
    if (owner && owner !== car) owner.stats.oilHits++;
    this.emit('oilhit', car, { owner: owner ? owner.id : null, ownerName: owner ? owner.name : null, victimName: car.name, x: oil.x, y: oil.y });
  }

  ask(car, kind) { const q = this.questions.make(kind); q.asked = this.time; car.q = q; if (kind !== 'boost') this.emit('question', car, { kind }); }

  // ---------- the simulation tick ----------
  step(dt) {
    this.time += dt;
    const T = this.track, C = F1.CONFIG;
    for (const c of this.cars) { c.prevX = c.x; c.prevY = c.y; c.prevH = c.h; }

    if (this.phase === 'countdown') {
      const before = Math.ceil(this.countdown); this.countdown -= dt; const after = Math.ceil(this.countdown);
      if (after !== before && after > 0) this.emit('countdown', null, { n: after });
      if (this.countdown <= 0) { this.phase = 'racing'; this.raceTime = 0; this.emit('go'); for (const c of this.cars) { c.lapStart = 0; c.sectorStart = 0; } }
      for (const b of this.bots) b.think(this, dt);
      for (const c of this.cars) { c.vx = c.vy = 0; c.input.item = false; }
      return;
    }
    if (this.phase !== 'racing' && this.phase !== 'cooldown') return;
    this.raceTime += dt;

    for (const b of this.bots) b.think(this, dt);

    for (const car of this.cars) {
      // timers
      car.boostT = Math.max(0, car.boostT - dt); car.slideT = Math.max(0, car.slideT - dt); car.ghostT = Math.max(0, car.ghostT - dt);
      car.penaltyT = Math.max(0, car.penaltyT - dt); car.slipT = Math.max(0, car.slipT - dt);

      // in the pit lane the car is driven for you; the maths happens in the garage
      if (car.pit) { this.pitStep(car, dt); continue; }

      // items
      if (car.input.item) {
        car.input.item = false;
        if (car.oilHeld && !car.finished) {
          car.oilHeld = false; car.stats.oilUsed++;
          this.items.dropOil(car.x - Math.cos(car.h) * 5, car.y - Math.sin(car.h) * 5, car.id, this.time);
          this.emit('oildrop', car);
        }
      }

      // move
      const grade = T.grade[car.seg] || 0;
      F1.Physics.step(car, dt, T, grade);

      // stay inside the circuit
      let loc = T.locate(car.x, car.y, car.seg);
      const impact = F1.Collision.walls(car, T, loc, this.collisionK);
      if (impact > 0) {
        loc = T.locate(car.x, car.y, loc.i);
        if (impact > C.DAMAGE.wallFree) {
          car.stats.wallHits++;
          const crit = F1.Damage.apply(car, (impact - C.DAMAGE.wallFree) * C.DAMAGE.wallPerMs * this.damageK, true);
          this.emit('wall', car, { impact, x: car.x, y: car.y });
          if (crit) this.emit('critical', car);
        }
      }
      this.trackProgress(car, loc, dt);
      this.checkPitEntry(car);
    }
    const onTrack = this.cars.filter(c => !c.pit);

    // car to car
    F1.Collision.cars(onTrack, (A, B, closing, sev, key, x, y) => {
      if (closing < C.DAMAGE.carFree) return;                      // rubbing panels: no damage, not counted
      const last = this.hitCooldown.get(key) || -9; if (this.time - last < 0.6) return;
      this.hitCooldown.set(key, this.time);
      A.stats.collisions++; B.stats.collisions++;
      const dmg = Math.max(0, closing - C.DAMAGE.carFree) * C.DAMAGE.carPerMs * this.damageK;
      for (const c of [A, B]) if (F1.Damage.apply(c, dmg, true)) this.emit('critical', c);
      this.emit('crash', A, { other: B.id, sev, x, y, closing });
    }, this.time, this.collisionK);

    // slipstream: tucked in behind another car on a straight
    for (const a of onTrack) {
      if (a.speed < 40) continue;
      for (const b of onTrack) {
        if (a === b) continue;
        let gap = b.s - a.s; if (gap < -T.length / 2) gap += T.length;
        if (gap > 3 && gap < C.ITEMS.slipstreamRange && Math.abs(b.lat - a.lat) < 2.5) { a.slipT = 0.4; break; }
      }
    }

    this.items.update(this.time, onTrack, this, dt);
    this.updateFinish();
  }

  /** Lap distance, checkpoint gates, sectors, laps, track limits and wrong-way detection. */
  trackProgress(car, loc, dt) {
    const T = this.track, C = F1.CONFIG, L = T.length;
    let ds = loc.s - car.s; if (ds < -L / 2) ds += L; if (ds > L / 2) ds -= L;
    car.seg = loc.i; car.s = loc.s; car.lat = loc.lat;
    car.prog += ds;
    car.surface = F1.Physics.surfaceAt(T, loc.lat);

    // checkpoint gates in order; the line itself is the last gate
    while (car.nextGate < T.gates.length && car.prog >= car.lapBase + T.gates[car.nextGate]) {
      if (car.nextGate === T.sectorGate[0] || car.nextGate === T.sectorGate[1]) { car.sectors.push(this.raceTime - car.sectorStart); car.sectorStart = this.raceTime; }
      car.nextGate++;
    }
    if (car.prog >= car.lapBase + L) {
      if (car.nextGate >= T.gates.length) {
        const lapTime = this.raceTime - car.lapStart;
        car.lapsDone++; car.lapBase += L; car.nextGate = 0;
        if (car.lapsDone >= 1) { car.lapTimes.push(lapTime); if (!car.bestLap || lapTime < car.bestLap) car.bestLap = lapTime; this.emit('lap', car, { lap: car.lapsDone, time: lapTime }); }
        car.lapStart = this.raceTime; car.sectorStart = this.raceTime; car.sectors = [];
        if (car.lapsDone >= this.laps && !car.finished) this.finishCar(car);
      } else { car.lapBase += L; this.emit('invalidlap', car); }   // can't happen without skipping gates, but never count it
    }

    if (car.pit) return;
    // track limits: gaining ground while off the asphalt is a corner cut
    const off = Math.abs(loc.lat) > T.hw + 1.5;
    if (off && !car.offTrack) { car.offTrack = true; car.offStartProg = car.prog; car.offTravel = 0; car.offStart = { s: car.s, prog: car.prog }; }
    if (car.offTrack) {
      car.offTravel += Math.hypot(car.vx, car.vy) * dt;
      if (!off) {
        car.offTrack = false;
        const gain = (car.prog - car.offStartProg) - car.offTravel;
        if (gain > C.TRACK_LIMITS.cutTolerance && !car.finished) {
          car.stats.cuts++; car.warnings++;
          if (gain > C.TRACK_LIMITS.resetGain) { this.resetCar(car, 'cut'); this.emit('cut', car, { reset: true }); }
          else { car.penaltyT = C.TRACK_LIMITS.penaltyTime; this.emit('cut', car, { reset: false }); }
        }
        car.offStart = null;
      } else if (Math.abs(car.speed) < 2) { car.stuckT += dt; if (car.stuckT > C.TRACK_LIMITS.stuckTime) { car.stuckT = 0; this.resetCar(car, 'stuck'); } }
      else car.stuckT = 0;
    }

    // wrong way
    const along = car.vx * loc.dirx + car.vy * loc.diry;
    if (along < -3) car.wrongWayT += dt; else car.wrongWayT = Math.max(0, car.wrongWayT - dt * 2);
    const ww = car.wrongWayT > 1.2; if (ww !== car.wrongWay) { car.wrongWay = ww; if (ww) this.emit('wrongway', car); }
  }

  finishCar(car) {
    car.finished = true; car.finishTime = this.raceTime; this.finishOrder.push(car.id); car.q = null;
    if (this.winnerTime == null) { this.winnerTime = this.raceTime; this.emit('winner', car); }
    this.emit('finish', car, { place: this.finishOrder.length, time: this.raceTime });
  }

  /** The race ends when every car has done all its laps and pit stops (or when the teacher ends it). */
  updateFinish() { if (this.cars.every(c => c.finished)) this.endRace(); }

  // ---------- pit stops ----------
  checkPitEntry(car) {
    const T = this.track;
    if (this.phase !== 'racing' || car.finished || car.lapsDone < 0) return;
    car.pitLap = car.pitLap || {};
    for (const P of T.pits) {
      if (car.nextGate < P.gate || car.pitLap[P.k] === car.lapsDone) continue;
      const into = car.prog - car.lapBase - P.entryS;
      if (into < 0 || into > P.endS - P.entryS - 30) continue;   // every car must stop: even one reset past the entry is pulled in
      car.pitLap[P.k] = car.lapsDone;
      this.enterPit(car, P, into);
      return;
    }
  }

  enterPit(car, P, into) {
    car.pit = { k: P.k, kind: P.kind, phase: 'in', s: P.entryS + into, lat0: car.lat, v: Math.max(0, car.speed), slot: this.cars.indexOf(car),
      jobs: 0, right: 0, wrong: 0, hold: 0, wait: 0.4, inAt: this.raceTime, boxAt: null };
    car.q = null; car.boostT = 0; car.slideT = 0; car.spin = 0; car.input.item = false;
    this.emit('pitin', car, { kind: P.kind });
  }

  pitStep(car, dt) {
    const T = this.track, PL = T.pits[car.pit.k], P = F1.CONFIG.PIT, p = car.pit, L = T.length;
    const box = PL.slotS(p.slot);
    // queue in the fast lane: never closer than 9 m to the car in front (cars turning into their box don't block)
    let lead = null;
    if (p.phase !== 'box') for (const o of this.cars) {
      const q = o.pit; if (!q || o === car || q.k !== p.k || q.phase === 'box' || (q.phase === 'in' && PL.slotS(q.slot) - q.s < 12)) continue;
      const gap = q.s - p.s; if (gap > 0 && (!lead || gap < lead.gap)) lead = { gap, q };
    }
    if (p.phase === 'in') {
      const dist = box - p.s; let vMax = Math.min(P.laneSpeed, Math.sqrt(2 * 6 * Math.max(0, dist)) + 0.4);
      if (lead && dist > 12) vMax = Math.min(vMax, Math.max(0, lead.q.v + (lead.gap - 9) * 1.5));
      p.v = p.v > vMax ? Math.max(vMax, p.v - 26 * dt) : Math.min(vMax, p.v + 8 * dt);
      p.s = Math.min(box, p.s + p.v * dt);
      if (box - p.s < 0.05) { p.s = box; p.v = 0; p.phase = 'box'; p.boxAt = this.raceTime; this.emit('pitbox', car); }
    } else if (p.phase === 'box') {
      p.hold = Math.max(0, p.hold - dt);
      if (!car.q && p.hold <= 0) {
        p.wait -= dt;
        if (p.jobs < P.questions) { if (p.wait <= 0) this.ask(car, 'pit'); }
        else if (p.wait <= 0) {
          F1.Damage.repair(car, 100);
          const stop = { lap: car.lapsDone + 1, kind: p.kind, right: p.right, wrong: p.wrong, time: this.raceTime - p.boxAt };
          car.pitStops.push(stop); p.phase = 'out'; this.emit('pitdone', car, stop);
        }
      }
    } else {
      let vMax = p.s > PL.exitS ? P.laneSpeed + 8 : P.laneSpeed;
      if (lead) vMax = Math.min(vMax, Math.max(0, lead.q.v + (lead.gap - 9) * 1.5));
      p.v = p.v > vMax ? Math.max(vMax, p.v - 26 * dt) : Math.min(vMax, p.v + 9 * dt);
      p.s += p.v * dt;
    }
    // sideways in the lane: drive in the fast lane, pull across into the box to stop
    const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }, side = PL.side;
    const into = p.phase === 'box' ? 1 : p.phase === 'in' ? sm(1 - (box - p.s) / 18) : sm(1 - (p.s - box) / 18);
    const off = -side * 1.6 + (side * 2.2 + side * 1.6) * into;
    // position on the pit path (blended in from where the car really was at the entry)
    let pos = T.pitAt(p.s, PL); pos = { x: pos.x - Math.sin(pos.heading) * off, y: pos.y + Math.cos(pos.heading) * off, heading: pos.heading };
    const t = (p.s - PL.entryS) / 40;   // merge onto the pit road within 40 m
    if (t < 1) { const a = T.pointAt(p.s, p.lat0), w = t <= 0 ? 0 : t * t * (3 - 2 * t); pos = { x: a.x + (pos.x - a.x) * w, y: a.y + (pos.y - a.y) * w, heading: pos.heading }; }
    const h = p.v > 0.3 || p.phase !== 'box' ? Math.atan2(pos.y - car.y, pos.x - car.x) : car.h;
    car.h = isFinite(h) && Math.hypot(pos.x - car.x, pos.y - car.y) > 0.01 ? h : car.h;
    car.x = pos.x; car.y = pos.y; car.speed = p.v; car.vx = Math.cos(car.h) * p.v; car.vy = Math.sin(car.h) * p.v; car.latSpeed = 0;
    const sw = T.wrapS(p.s), i = T.indexAtS(sw);
    this.trackProgress(car, { i, s: sw, lat: 0, dirx: Math.cos(car.h), diry: Math.sin(car.h) }, dt);
    car.lat = PL.laneLat;
    // out on track again
    if (p.phase === 'out' && p.s >= PL.endS) {
      const q = T.pointAt(PL.endS, PL.edgeLat), loc = T.locate(q.x, q.y, i);
      Object.assign(car, { x: q.x, y: q.y, h: q.heading, vx: Math.cos(q.heading) * p.v, vy: Math.sin(q.heading) * p.v, seg: loc.i, s: loc.s, lat: loc.lat, ghostT: 1.5, offTrack: false, offStart: null, stuckT: 0, wrongWayT: 0, wrongWay: false });
      const last = car.pitStops[car.pitStops.length - 1];
      if (last && last.wrong === 0) car.boostT = P.perfectBoost; else if (last && last.right >= 8) car.boostT = P.goodBoost;
      car.pit = null; this.emit('pitexit', car, { boost: car.boostT });
    }
  }

  endRace() { if (this.phase === 'finished') return; this.phase = 'finished'; this.emit('raceover'); }

  /** Race order: finishers by finishing time, then everyone else by distance covered. */
  standings() {
    const list = this.cars.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.prog - a.prog;
    });
    list.forEach((c, i) => c.place = i + 1);
    return list;
  }

  /** Public state for clients. The right answers to questions are never included. */
  snapshot(forId) {
    const st = this.standings();
    return {
      phase: this.phase, time: this.time, raceTime: this.raceTime, countdown: this.countdown, laps: this.laps,
      cars: st.map(c => ({ id: c.id, name: c.name, sprite: c.sprite, colour: c.colour, isBot: c.isBot, x: c.x, y: c.y, h: c.h, px: c.prevX, py: c.prevY, ph: c.prevH,
        speed: c.speed, health: c.health, critical: c.critical, place: c.place, lapsDone: Math.max(0, c.lapsDone), lap: Math.min(this.laps, Math.max(1, c.lapsDone + 1)), s: c.s, prog: c.prog,
        finished: c.finished, finishTime: c.finishTime, bestLap: c.bestLap, oilHeld: c.oilHeld, boostT: c.boostT, slideT: c.slideT, ghostT: c.ghostT, sliding: c.sliding, surface: c.surface, streak: c.streak,
        pit: c.pit ? { k: c.pit.k, kind: c.pit.kind, phase: c.pit.phase, jobs: c.pit.jobs, slot: c.pit.slot } : null, stops: c.pitStops.length })),
      stopsPerLap: this.track.stopsPerLap,
      oils: this.items.oils.map(o => ({ id: o.id, x: o.x, y: o.y, rot: o.rot, owner: o.owner })),
      boxes: this.items.boxes.map(b => ({ id: b.id, x: b.x, y: b.y, ready: b.readyAt <= this.time })),
      me: forId != null ? this.privateView(this.byId.get(forId)) : null,
    };
  }

  privateView(c) {
    if (!c) return null;
    return { id: c.id, question: F1.QuestionService.publicView(c.q), lastResult: c.lastResult, lapTimes: c.lapTimes, sectors: c.sectors, penaltyT: c.penaltyT, wrongWay: c.wrongWay, offTrack: c.offTrack,
      warnings: c.warnings, stats: c.stats, lapStart: c.lapStart, nextGate: c.nextGate,
      pit: c.pit ? { k: c.pit.k, kind: c.pit.kind, phase: c.pit.phase, jobs: c.pit.jobs, right: c.pit.right, wrong: c.pit.wrong, hold: c.pit.hold, boxAt: c.pit.boxAt } : null, pitStops: c.pitStops };
  }
};
