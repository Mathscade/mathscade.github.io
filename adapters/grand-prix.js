/* Mathcade Grand Prix <-> Mathcade online */
(function(){
  const App = window.F1App;
  if(!App || !window.F1 || !F1.RaceServer){ console.warn('Mathcade: Grand Prix did not load'); return; }
  const NAMES = { monza:'Monza', vegas:'Las Vegas', spa:'Spa' };   // keep the retired names: old scores use them in their variant text
  const trackName = s => NAMES[s.track.def.id] || NAMES[App.trackId] || s.track.def.name;
  const variant = s => `${trackName(s)} · ${s.laps} ${s.laps === 1 ? 'lap' : 'laps'}`;
  let name = MC.user ? MC.user.username : null;
  let cls = null;                     // class game: { best, races }

  // the student's car carries their username (the game's screens still say "You")
  const join = F1.LocalTransport.prototype.join;
  F1.LocalTransport.prototype.join = function(info){
    const mine = info && info.name === 'You';
    return join.call(this, Object.assign({}, info, name && mine ? { name } : {}, mine && LIVE.raceLive ? { sprite:LIVE.sprite } : {}));
  };

  /* ---------- live class race: every student on the same track, in one race ----------
     Each iPad sends its car 4 times a second; the teacher's screen sends back one snapshot of everyone
     4 times a second. Classmates are drawn as see-through "ghost" cars (no collisions, no items) about
     350 ms behind their newest update, interpolated on the classmate's own race clock so the motion is
     smooth. They are added to the race order, the position counter, the map and the results, and they
     replace the computer drivers. If the live link can't be made, the computer drivers race as before. */
  const LIVE = { conn:null, connP:null, failed:false, remotes:new Map(), race:0, raceLive:false, slot:0, roster:1, sprite:'car_red_1', pill:null, servers:new WeakSet() };
  const DELAY = 0.35, TICK = F1.CONFIG.TICK;
  const liveOk = () => !!(cls && LIVE.conn && !LIVE.failed);
  const isLive = srv => !!(srv && LIVE.servers.has(srv));
  const r2 = (v, k) => v == null || !isFinite(v) ? null : Math.round(v * k) / k;
  const nowS = () => performance.now() / 1000;
  const lerpA = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
  function myState(){
    const S = App.server, c = S && S.byId.get(App.meId); if(!c) return null;
    return { n:name, r:LIVE.race, tr:S.track.def.id, ph:S.phase, x:r2(c.x, 100), y:r2(c.y, 100), h:r2(c.h, 1000), pg:r2(c.prog, 10), lp:c.lapsDone,
             sp:r2(c.speed, 10), rt:r2(S.raceTime, 1000), fi:!!c.finished, ft:r2(c.finishTime, 100), c:c.sprite, k:c.stats.correct, q:c.stats.questions,
             bl:r2(c.bestLap, 100), pt:r2(c.pitStops.reduce((a, p) => a + p.time, 0), 10), ps:c.pit ? c.pit.phase : null };
  }
  function onSnap(snap){
    if(!snap || !Array.isArray(snap.p)) return;
    const t = nowS();
    for(const p of snap.p){
      if(!p || !p.n || p.n === name || typeof p.x !== 'number') continue;
      let R = LIVE.remotes.get(p.n); if(!R){ R = { buf:[], off:null, car:null }; LIVE.remotes.set(p.n, R); }
      const last = R.buf[R.buf.length - 1];
      if(R.meta && (R.meta.r !== p.r || R.meta.tr !== p.tr) || (last && p.rt < last.rt - 1)){ R.buf.length = 0; R.off = null; R.car = null; }   // a new race
      const smp = { rt:+p.rt || 0, x:p.x, y:p.y, h:+p.h || 0, pg:+p.pg || 0, sp:+p.sp || 0 }, prev = R.buf[R.buf.length - 1];
      if(prev && smp.rt <= prev.rt) Object.assign(prev, smp);          // same moment (on the grid, or the same update relayed twice)
      else { R.buf.push(smp); if(R.buf.length > 30) R.buf.shift(); }
      // map local time onto the classmate's race clock: follow the fastest deliveries, ignore late ones
      const o = smp.rt - t;
      R.off = R.off == null || Math.abs(o - R.off) > 1.5 ? o : R.off + (o - R.off) * (o > R.off ? 0.3 : 0.02);
      R.meta = p; R.seen = Date.now();
    }
    pill();
  }
  function sampleAt(R, rt){
    const b = R.buf; if(!b.length) return null;
    if(rt <= b[0].rt) return b[0];
    for(let i = b.length - 1; i > 0; i--){ const a = b[i - 1], c = b[i];
      if(rt >= a.rt && rt <= c.rt){ const k = (rt - a.rt) / Math.max(1e-3, c.rt - a.rt);
        return { x:a.x + (c.x - a.x) * k, y:a.y + (c.y - a.y) * k, h:lerpA(a.h, c.h, k), pg:a.pg + (c.pg - a.pg) * k, sp:a.sp + (c.sp - a.sp) * k }; } }
    const c = b[b.length - 1], a = b[b.length - 2];
    if(!a || R.meta.fi || R.meta.ps) return c;
    const k = Math.min(rt - c.rt, 0.3) / Math.max(1e-3, c.rt - a.rt);   // a late update: carry on for a moment along the last direction
    return { x:c.x + (c.x - a.x) * k, y:c.y + (c.y - a.y) * k, h:c.h, pg:c.pg + (c.pg - a.pg) * k, sp:c.sp };
  }
  function ghostCar(n, m){
    const sprite = F1.CAR_SPRITES.includes(m.c) ? m.c : 'car_black_1';
    return { id:'mc:' + n, name:n, remote:true, isBot:false, sprite, colour:F1.CAR_COLOURS[sprite.split('_')[1]], x:0, y:0, h:0, prevX:null, speed:0, health:100, critical:false,
             place:0, lapsDone:-1, s:0, prog:0, finished:false, finishTime:null, bestLap:null, oilHeld:false, boostT:0, slideT:0, ghostT:0, sliding:false, surface:'asphalt', streak:0,
             pit:null, pitStops:[], reaction:null, stats:{ questions:0, correct:0, wrong:0, damage:0, oilCollected:0, oilUsed:0, oilHits:0, collisions:0, cuts:0 } };
  }
  /* once per server tick: move every classmate's ghost car to where they were DELAY seconds ago */
  function updateGhosts(S){
    const T = S.track, t = nowS(), out = [];
    for(const [n, R] of LIVE.remotes){
      const m = R.meta;
      if(!m || m.r !== LIVE.race || m.tr !== T.def.id || Date.now() - R.seen > 12000 || !R.buf.length){ continue; }
      const p = sampleAt(R, t + R.off - DELAY); if(!p) continue;
      const c = R.car || (R.car = ghostCar(n, m)), first = c.prevX == null;
      c.prevX = first ? p.x : c.x; c.prevY = first ? p.y : c.y; c.prevH = first ? p.h : c.h;
      c.x = p.x; c.y = p.y; c.h = p.h; c.prog = p.pg; c.s = T.wrapS(p.pg); c.speed = p.sp;
      c.lapsDone = m.lp == null ? -1 : m.lp; c.finished = !!m.fi; c.finishTime = m.ft; c.bestLap = m.bl;
      c.stats.correct = m.k | 0; c.stats.questions = m.q | 0; c.stats.wrong = Math.max(0, (m.q | 0) - (m.k | 0));
      c.pitStops = m.pt ? [{ time:m.pt }] : [];
      out.push(c);
    }
    S._ghosts = out;
  }
  // the class race's own server: no computer drivers, your grid slot from the class list, ghosts in the race order
  const placeGrid = F1.RaceServer.prototype.placeGrid;
  F1.RaceServer.prototype.placeGrid = function(){
    const out = placeGrid.apply(this, arguments);
    if(LIVE.raceLive && this === App.server){
      LIVE.servers.add(this); this._ghosts = [];
      const me = this.byId.get(App.meId), g = this.track.grid[LIVE.slot % this.track.grid.length];
      if(me){
        Object.assign(me, { x:g.x, y:g.y, h:g.heading, vx:0, vy:0, gridSlot:LIVE.slot + 1 });
        const loc = this.track.locate(me.x, me.y, null);
        me.seg = loc.i; me.s = loc.s; me.lat = loc.lat; me.prog = loc.s - this.track.length; me.lapBase = -this.track.length; me.nextGate = this.track.gates.length;
        me.prevX = me.x; me.prevY = me.y; me.prevH = me.h;
      }
    }
    return out;
  };
  const step = F1.RaceServer.prototype.step;
  F1.RaceServer.prototype.step = function(dt){ const out = step.apply(this, arguments); if(isLive(this)) updateGhosts(this); return out; };
  const standings = F1.RaceServer.prototype.standings;
  F1.RaceServer.prototype.standings = function(){
    if(!isLive(this)) return standings.apply(this, arguments);
    const list = this.cars.concat(this._ghosts || []).sort((a, b) => {
      if(a.finished && b.finished) return a.finishTime - b.finishTime;
      if(a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.prog - a.prog;
    });
    list.forEach((c, i) => c.place = i + 1);
    return list;
  };
  const snapshot = F1.RaceServer.prototype.snapshot;
  F1.RaceServer.prototype.snapshot = function(){
    const out = snapshot.apply(this, arguments);
    if(isLive(this)) for(const c of out.cars) if(c.id.startsWith('mc:')) c.remote = true;
    return out;
  };
  // the race is over when you and every classmate in it have finished (or 30 s after you finish)
  const updateFinish = F1.RaceServer.prototype.updateFinish;
  F1.RaceServer.prototype.updateFinish = function(){
    if(!isLive(this)) return updateFinish.apply(this, arguments);
    if(!this.cars.every(c => c.finished)) return;
    const me = this.byId.get(App.meId), waiting = (this._ghosts || []).some(g => !g.finished);
    if(!waiting || !me || this.raceTime - me.finishTime > 30) this.endRace();
  };
  // stray oil slicks: the same ones at the same moments of the race on every iPad
  const itemsUpdate = F1.Items.prototype.update;
  F1.Items.prototype.update = function(now, cars, server){
    if(!cls || server !== App.server) return itemsUpdate.apply(this, arguments);
    const was = Math.random; Math.random = MC.seed('gp-oil|' + LIVE.race + '|' + Math.round(server.raceTime / TICK));
    try{ return itemsUpdate.apply(this, arguments); } finally{ Math.random = was; }
  };
  // classmates' cars are see-through: they don't collide
  const drawCar = F1.Renderer.prototype._drawCar;
  F1.Renderer.prototype._drawCar = function(c){ const out = drawCar.apply(this, arguments); if(c.remote){ const o = this.cars.get(c.id); if(o) o.mat.opacity = 0.62; } return out; };
  // "you start P5 of 1": count the class instead of the cars on this iPad
  const banner = F1.UI.banner;
  F1.UI.banner = function(title, sub){
    if(isLive(App.server) && typeof sub === 'string') sub = sub.replace(/you start P(\d+) of \d+/, (m, p) => `you start P${p} of ${Math.max(+p, LIVE.roster)}`);
    return banner.apply(this, [title, sub].concat([].slice.call(arguments, 2)));
  };
  const showLB = window.showLeaderboard;
  if(showLB) window.showLeaderboard = function(cfg){
    if(cfg && isLive(App.server)) cfg = Object.assign({}, cfg, { note:'Live class race: classmates still racing are shown with their laps so far. Your teacher\u2019s screen has the full class results.' });
    return showLB.apply(this, arguments.length > 1 ? [cfg].concat([].slice.call(arguments, 1)) : [cfg]);
  };
  // "Race again" in a live class game: no computer drivers join the lobby
  const toLobby = App.toLobby;
  App.toLobby = function(){
    const out = toLobby.apply(this, arguments);
    if(liveOk()){ clearInterval(this.joinTimer); this.lobby = this.lobby.filter(d => d.you); F1.UI.renderDrivers(this); this.updateStartBtn(); }
    return out;
  };
  const updateStartBtn = App.updateStartBtn;
  App.updateStartBtn = function(){
    if(!liveOk()) return updateStartBtn.apply(this, arguments);
    const b = $('#startRace'); b.disabled = !this.myReaction; b.textContent = this.myReaction ? 'Start the race' : 'Do the reaction test first';
  };
  // every class race: same scenery and race randomness on every iPad, numbered so ghosts only join the same race
  const startRace = App.startRace;
  App.startRace = function(){
    if(!cls) return startRace.apply(this, arguments);
    LIVE.race++; LIVE.raceLive = liveOk();
    if(LIVE.raceLive) this.lobby = this.lobby.filter(d => d.you);
    try{ return MC.withSeed('gp-race|' + LIVE.race, () => startRace.apply(this, arguments)); }
    finally{ LIVE.raceLive = false; pill(); }
  };
  function pill(){
    if(!MC.inSession() || !cls) return;
    if(!LIVE.pill){ LIVE.pill = document.createElement('div'); LIVE.pill.setAttribute('role','status'); LIVE.pill.className = 'mcgp-pill';
      LIVE.pill.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(16px + env(safe-area-inset-top,0px));z-index:30;font:800 13px Nunito,system-ui,sans-serif;color:#fff;background:rgba(19,35,58,.82);border-radius:999px;padding:5px 12px;pointer-events:none;white-space:nowrap';
      document.body.appendChild(LIVE.pill); }
    const S = App.server, n = isLive(S) ? (S._ghosts || []).length : 0, cv = document.getElementById('cv');
    LIVE.pill.hidden = !S;
    if(cv && cv.clientWidth) LIVE.pill.style.left = Math.round(cv.getBoundingClientRect().left + cv.clientWidth / 2) + 'px';   // the middle of the race view, not of the pit wall
    LIVE.pill.innerHTML = LIVE.failed ? 'Live race unavailable: racing computer drivers'
      : !LIVE.conn ? 'Connecting to the live race\u2026'
      : !isLive(S) ? 'Practice race'
      : ![...LIVE.remotes.values()].some(R => Date.now() - R.seen < 12000) && !n ? '<span style="color:#FFE36B">\u25CF</span> Waiting for your classmates\u2019 cars'
      : `<span style="color:#3CD48A">\u25CF</span> Live race: ${n} classmate${n === 1 ? '' : 's'} on track`;
  }
  async function connectLive(code){
    try{
      LIVE.conn = await Promise.race([MC.live.player(code, onSnap, () => pill()), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))]);
      setInterval(() => { const st = cls && LIVE.conn && isLive(App.server) ? myState() : null; if(st) LIVE.conn.send(st); }, 250);
      setInterval(pill, 1000);
    }catch(e){ console.warn('Live race unavailable', e); LIVE.failed = true; LIVE.conn = null; }
    pill();
  }
  // read-only peeks for tests: classmates this iPad knows about / draws, and a fingerprint of the race's generated content
  window.mcGpGhosts = () => { const S = App.server, on = new Set(isLive(S) ? (S._ghosts || []).map(c => c.name) : []);
    return [...LIVE.remotes.entries()].map(([n, R]) => ({ n, race:R.meta && R.meta.r, track:R.meta && R.meta.tr, shown:on.has(n), x:R.car ? Math.round(R.car.x) : null, y:R.car ? Math.round(R.car.y) : null,
      lap:R.meta && R.meta.lp, prog:R.car ? Math.round(R.car.prog) : null, place:R.car && on.has(n) ? R.car.place : null, sprite:R.car ? R.car.sprite : null })); };
  window.mcGpFingerprint = () => { const S = App.server; if(!S) return null;
    const rate = S.items.randomOilRate / 60 * TICK, oil = [];
    for(let k = 0; k < 60 * 600 && oil.length < 6 && rate > 0; k++){ const r = MC.seed('gp-oil|' + LIVE.race + '|' + k); if(r() < rate) oil.push([k, Math.round(r() * S.track.length)]); }
    return JSON.stringify({ track:S.track.def.id, laps:S.laps, race:LIVE.race, boxes:S.items.boxes.map(b => [Math.round(b.x), Math.round(b.y)]), seed:S.rnd(), oil }); };
  window.mcGpLive = () => ({ live:isLive(App.server), slot:LIVE.slot, roster:LIVE.roster, race:LIVE.race, failed:LIVE.failed, connected:!!LIVE.conn });
  const joinCode = MC.classCode && MC.classCode();
  if(joinCode && MC.live && MC.live.supported('grand-prix') && MC.configured()) LIVE.connP = connectLive(joinCode);

  // one result per race: when your car takes the flag, or when the race ends without you finishing
  const report = (server, car, finished) => {
    if(server._mcReported || server !== App.server) return;
    server._mcReported = true;
    const t = car.finishTime;
    if(cls){ cls.races++; cls.correct += car.stats.correct; cls.answered += car.stats.questions; if(finished) cls.best = cls.best == null ? t : Math.min(cls.best, t); }
    MC.result({ score:finished ? t : 0, correct:car.stats.correct, answered:car.stats.questions, seconds:finished ? t : server.raceTime,
                variant:variant(server), save:finished,
                details:{ track:server.track.def.id, laps:server.laps, place:car.place || null, cars:server.standings().length, live:isLive(server),
                          lapsDone:Math.max(0, car.lapsDone), bestLap:car.bestLap || null, pitStops:car.pitStops.length,
                          wrong:car.stats.wrong, maths:server.settings.difficulty, topic:server.settings.topic } });
  };
  const finishCar = F1.RaceServer.prototype.finishCar;
  F1.RaceServer.prototype.finishCar = function(car){
    const out = finishCar.apply(this, arguments);
    if(car && isLive(this)){   // your place counts classmates who finished before you
      const place = 1 + (this._ghosts || []).filter(g => g.finished && g.finishTime != null && g.finishTime <= car.finishTime).length;
      const ev = this.events.filter(e => e.type === 'finish' && e.carId === car.id).pop(); if(ev) ev.place = place;
      this.standings();
    }
    if(car && car.id === App.meId) report(this, car, true);
    return out;
  };
  const endRace = F1.RaceServer.prototype.endRace;
  F1.RaceServer.prototype.endRace = function(){
    const was = this.phase, out = endRace.apply(this, arguments);
    const me = this.byId.get(App.meId);
    if(was !== 'finished' && me && !me.finished && this.phase === 'finished' && was !== 'grid') report(this, me, false);
    return out;
  };

  // App.boot() is async (images, tracks); wait until the paddock is built
  const ready = fn => { if(!document.getElementById('loading') && App.tracks && App.tracks[F1.TRACK_ORDER[0]]) fn(); else setTimeout(() => ready(fn), 100); };

  MC.register({
    game:'grand-prix',
    keepLive:true,
    start(ctx){
      const s = ctx.settings || {};
      name = ctx.username || name;
      // your grid slot: your place in the class list (sorted by username), so nobody shares a slot
      const roster = MC.authed('mc_session_board', { p_code:ctx.code }).then(b => (b.players || []).map(p => p.username)).catch(() => []);
      const conn = LIVE.connP ? Promise.race([LIVE.connP, new Promise(r => setTimeout(r, 4000))]) : Promise.resolve();
      Promise.all([roster, conn]).then(([names]) => ready(() => {
        const S = App.settings;
        if(App.tracks[s.track]) App.trackId = s.track;   // a retired track (an old game code, or a teacher's remembered choice) falls back to the default circuit
        S.laps = Math.max(1, Math.min(3, Math.round(+s.laps || 1)));
        if(['easy','medium','hard'].includes(s.difficulty)) S.difficulty = s.difficulty;
        S.topic = s.topic && (s.topic === 'mixed' || F1.QuestionService.topics().some(t => t.id === s.topic)) ? s.topic : 'mixed';
        cls = { best:null, races:0, correct:0, answered:0 };
        const list = [...new Set(names.concat(name ? [name] : []))].sort();
        LIVE.slot = Math.max(0, list.indexOf(name)); LIVE.roster = list.length;
        LIVE.sprite = F1.CAR_SPRITES[LIVE.slot % F1.CAR_SPRITES.length];     // a different colour for each of the first five, then new body styles
        // the teacher's countdown replaces the lobby: give the student a neutral reaction time instead of the reaction test
        clearInterval(App.joinTimer);
        F1.UI.resetReaction(App);
        App.lobby = [{ you:true, name:'You' }];
        if(!liveOk()){   // no live link: computer drivers fill the grid, as in practice
          const names = MC.withSeed('gp-bots', () => F1.BOT_NAMES.slice().sort(() => Math.random() - 0.5)), max = Math.max(2, S.maxPlayers || 32);
          for(let i = 0; App.lobby.length < max; i++)
            App.lobby.push({ name:names[i % names.length], sprite:F1.CAR_SPRITES[(i * 7 + 3) % F1.CAR_SPRITES.length], reaction:0.2 + Math.pow(Math.random(), 1.3) * 0.45 });
        }
        App.myReaction = { time:0.32 };
        App.startRace();
      }));
    },
    live(){
      if(!cls) return {};
      const srv = App.server;
      let status = cls.races ? 'Finished' : 'On the grid', fin = cls.best != null;
      if(srv && App.net){
        const snap = App.net.state(), me = snap.cars.find(c => c.id === App.meId);
        if(me){
          if(me.finished) status = `Finished P${me.place}`;
          else if(snap.phase === 'racing') status = `Lap ${me.lap}/${snap.laps} · P${me.place}`;
          else if(snap.phase === 'finished') status = `DNF · ${me.lapsDone} ${me.lapsDone === 1 ? 'lap' : 'laps'}`;
          else status = 'On the grid';
          if(srv._mcReported) fin = true;
        }
        const car = srv.byId.get(App.meId);
        const cur = car && !srv._mcReported;     // this race's questions, until it has been reported
        return { score:cls.best, correct:cls.correct + (cur ? car.stats.correct : 0), answered:cls.answered + (cur ? car.stats.questions : 0), status, finished:fin };
      }
      return { score:cls.best, correct:cls.correct, answered:cls.answered, status, finished:fin };
    },
  });
  MC.onUser(u => { if(!cls) name = u ? u.username : null; });
})();
