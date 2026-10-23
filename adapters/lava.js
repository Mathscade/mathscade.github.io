/* Leap, Ladder, Lava (maths-lava-climb) <-> Mathcade online */
(function(){
  const LAVA = { easy:'Slow lava', medium:'Medium lava', hard:'Fast lava' };
  const variant = () => LAVA[Game.diff] || 'Medium lava';
  let name = MC.user ? MC.user.username : null;          // shown instead of "You"
  let cls = null;                                         // class game: { rounds, done, best, correct, answered, counted }

  // Brick: the player wears the account's equipped look (brick.js)
  const B = window.Brick && typeof BrickPlayer !== 'undefined' ? BrickPlayer : null;
  if(B) B.setLook(MC.user ? Brick.lookOf(MC.user) : null);
  // class games skip the client's own profile refresh: fetch it so the equipped look is the latest one
  if(B && MC.token() && new URLSearchParams(location.search).get('join') && MC.refreshMe) MC.refreshMe();
  const raceStart = Race.start;
  Race.start = function(n, diff){ const out = raceStart.call(this, name || n, diff); if(LIVE.on){ this.rivals = []; syncRivals(); } return out; };

  /* ---------- one tower for the whole class ----------
     buildLevel() already uses its own generator seeded by the round number (no Math.random), so every
     student climbs the same tower in round n. Wrapping it in MC.withSeed keeps that true even if the
     generator ever picks up a Math.random call. */
  const buildLevelOrig = buildLevel;
  buildLevel = function(){ return MC.withSeed('lava-r' + Match.round, () => buildLevelOrig.apply(this, arguments)); };

  /* ---------- live climb: classmates' climbers on the same tower ----------
     Each iPad sends its climber 3 times a second; the teacher's screen sends back one snapshot of
     everyone 4 times a second. Climbers are drawn 350 ms behind the newest snapshot, smoothed between
     updates. Classmates replace the computer climbers (Alex, Sam, Jordan). */
  const LIVE = { on:false, conn:null, remotes:new Map(), offset:null, pill:null, failed:false };
  const DELAY = 350;
  const lookFrom = s => { if(typeof s !== 'string') return null; const [base, hat, shoes, skin, fx] = s.split('|'); return Brick.normalize({ base, hat, shoes, skin, fx }); };
  const anim = () => (Player.hurt || Player.burnT > 0) ? 'h' : Player.climbing ? 'c' : !Player.grounded ? 'j' : Math.abs(Player.vx) > 280 ? 'r' : Math.abs(Player.vx) > 30 ? 'w' : 'i';
  const myState = () => { const me = Race.me || {}; return { n:name, x:Math.round(Player.x), y:Math.round(Player.y), f:Player.face, a:anim(),
    h:Math.round((me.maxHeight || 0) * 10) / 10, fi:!!me.finished, ft:me.finishTime == null ? null : Math.round(me.finishTime * 100) / 100, o:!!me.out,
    r:Match.round, b:B ? Brick.lookKey(B.current()) : undefined,
    w:WAVES.wave, l:me.lives, bst:me.out ? WAVES.myBoosts : 0,
    rd:WAVES.ready || 0 }; };   // rd: the wave whose checkpoint question I have finished (I am waiting for the class)   // waves: wave number, lives, and (once eliminated) lava boosts sent to the class
  function onSnap(snap){
    if(!snap || !Array.isArray(snap.p)) return;
    const now = Date.now(), off = now - snap.t;
    LIVE.offset = LIVE.offset == null ? off : LIVE.offset + (off - LIVE.offset) * 0.1;
    for(const p of snap.p){
      if(!p || !p.n || p.n === name) continue;
      let R = LIVE.remotes.get(p.n); if(!R){ R = { buf:[], rival:null }; LIVE.remotes.set(p.n, R); }
      const last = R.buf[R.buf.length - 1];
      if(last && (last.r !== p.r || Math.abs(p.y - last.y) > T * 40)) R.buf.length = 0;   // new climb or a checkpoint rescue: don't slide across the tower
      R.buf.push({ t:snap.t, x:p.x, y:p.y, f:p.f, a:p.a, r:p.r }); if(R.buf.length > 24) R.buf.shift();
      R.meta = p; R.seen = now;
    }
    LIVE.lastSnap = now;
    /* class sync: release the next wave when every classmate still alive in this climb has finished this checkpoint's question.
       Every iPad decides from the same snapshot, and the countdown ends at the snapshot's time + 3 s (teacher clock),
       so the lava starts together on every screen. */
    if(WAVES.on && WAVES.phase === 'wait'){
      const k = WAVES.ready, fresh = now - 8000;
      const waitingFor = [];
      for(const [n, R] of LIVE.remotes){ const m = R.meta; if(!m || R.seen < fresh || m.r !== Match.round || m.o || m.fi) continue; if((+m.rd || 0) < k) waitingFor.push(n); }
      WAVES.waitingFor = waitingFor;
      if(!waitingFor.length){ const goLocal = snap.t + 3000 + LIVE.offset; WAVES.release((goLocal - now) / 1000); }
    }
    // waves: every correct answer by an eliminated classmate (this climb) makes my lava faster (CONFIG.WAVES.BOOST_PCT each, capped)
    if(WAVES.on){ let n = 0; for(const p of snap.p){ if(p && p.n && p.n !== name && p.o && p.r === Match.round) n += Math.max(0, +p.bst || 0); } WAVES.setBoosts(n); }
    pill();
  }
  function remotesNow(){ const now = Date.now(); return [...LIVE.remotes.entries()].filter(([n, R]) => now - R.seen < 12000 && R.meta && R.meta.r === Match.round); }
  function colOf(R){ const gl = B && lookFrom(R.meta.b); try{ if(gl) return Brick.CATALOGUE.item(gl.base).main; }catch(e){} return '#5F5A66'; }
  function syncRivals(){
    if(!LIVE.on || !Race.me) return;
    Race.rivals = remotesNow().map(([n, R]) => {
      const r = R.rival || (R.rival = { ...Race.newPlayer(n), remote:true });
      r.col = colOf(R); r.maxHeight = r.height = +R.meta.h || 0; r.finished = !!R.meta.fi; r.finishTime = R.meta.ft; r.out = !!R.meta.o; return r; });
  }
  function posAt(R, hostT){
    const b = R.buf; if(!b.length) return null;
    if(hostT <= b[0].t) return b[0];
    for(let i = b.length - 1; i > 0; i--){ const a = b[i - 1], c = b[i];
      if(hostT >= a.t && hostT <= c.t){ const k = (hostT - a.t) / Math.max(1, c.t - a.t); return { x:a.x + (c.x - a.x) * k, y:a.y + (c.y - a.y) * k, f:c.f, a:c.a }; } }
    return b[b.length - 1];
  }
  /* a classmate's Brick sprite: rasterised once per look and zoom; effects are kept small, and switched off in big classes */
  function ghostSprite(R, many){
    const L = lookFrom(R.meta.b); if(!L) return null;
    const d = Math.round(Math.min(2, Math.max(1, Camera.z * (dpr || 1))) * 4) / 4, k = Brick.lookKey(L) + '@' + d + (many ? ':nofx' : '');
    if(R.sprKey !== k){ R.sprKey = k; Brick.sprite(L, { height:BRICK_H, dpr:d, maxParticles:many ? 0 : 6, fx:!many }).then(s => { if(R.sprKey === k) R.spr = s; }).catch(() => {}); }
    return R.spr || null;
  }
  const label = (n, x, y) => { ctx.font = "900 17px Nunito,system-ui,sans-serif"; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,30,50,.75)'; ctx.fillStyle = '#fff';
    ctx.strokeText(n, x, y); ctx.fillText(n, x, y); };
  function drawRemotes(t){
    const hostT = Date.now() - (LIVE.offset || 0) - MC.live.delay(DELAY, LIVE.conn), z = Camera.z, list = remotesNow(), many = list.length > 12;
    for(const [n, R] of list){
      const p = posAt(R, hostT); if(!p) continue;
      if(p.y < Camera.y - 200 || p.y > Camera.y + vh / z + 200 || p.x < Camera.x - 200 || p.x > Camera.x + vw / z + 200) continue;
      const cx = p.x + Player.w / 2, gs = B ? ghostSprite(R, many) : null;
      if(gs){
        const vy = R.lastY == null ? 0 : (p.y - R.lastY) * 60; R.lastY = p.y;
        const state = p.a === 'h' ? 'hurt' : p.a === 'j' ? 'jump' : p.a === 'r' ? 'run' : p.a === 'w' || p.a === 'c' ? 'walk' : 'idle';
        gs.draw(ctx, cx, p.y + Player.h + 1, { t:t + n.length * 0.37, state, facing:p.a === 'c' ? 0 : p.f < 0 ? -1 : 1, vy, alpha:0.62, since:1 });
        label(n, cx, p.y - 42);   // above the tallest hats
        continue;
      }
      ctx.globalAlpha = 0.6; drawSprite('character_green' + (p.a === 'h' ? '_hit' : p.a === 'j' ? '_jump' : '_idle'), cx, p.y + Player.h + 2, 100, p.f < 0); ctx.globalAlpha = 1;
      label(n, cx, p.y - 18);
    }
  }
  const drawPlayerOrig = drawPlayer;
  drawPlayer = function(t){ if(LIVE.on) drawRemotes(t); return drawPlayerOrig.apply(this, arguments); };
  const raceStep = Race.step;
  Race.step = function(dt){
    if(!LIVE.on) return raceStep.call(this, dt);
    this.rivals = []; raceStep.call(this, dt);      // updates the player's own height; no computer climbers
    syncRivals();
  };
  const resultsShow = Results.show;
  Results.show = function(){
    if(!LIVE.on) return resultsShow.apply(this, arguments);
    syncRivals(); Race.t = Math.max(Race.t, 900);   // classmates still climbing are ranked by their height so far (no simulated finish)
    const out = resultsShow.apply(this, arguments);
    document.querySelectorAll('.lb-ov').forEach(ov => { const w = document.createTreeWalker(ov, NodeFilter.SHOW_TEXT); let x;
      while((x = w.nextNode())) if(/Practice racers/.test(x.nodeValue)) x.nodeValue = 'Finishers are ranked by time, then everyone else by height. Live class climb: classmates still climbing are shown at their height so far.'; });
    return out;
  };
  function pill(){
    if(!MC.inSession()) return;
    if(!LIVE.pill){ LIVE.pill = document.createElement('div'); LIVE.pill.setAttribute('role','status'); LIVE.pill.id = 'mcLivePill';
      LIVE.pill.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(70px + env(safe-area-inset-top,0px));z-index:8;font:800 13px Nunito,system-ui,sans-serif;color:#fff;background:rgba(19,35,58,.82);border-radius:999px;padding:5px 12px;pointer-events:none;white-space:nowrap';
      document.body.appendChild(LIVE.pill); }
    const n = remotesNow().length;
    LIVE.pill.innerHTML = LIVE.failed ? 'Live view unavailable: climbing with computer players'
      : !LIVE.conn ? 'Connecting to the live climb…'
      : LIVE.offset == null ? '<span style="color:#FFE36B">●</span> Waiting for your teacher’s screen'
      : `<span style="color:#3CD48A">●</span> Live climb: ${n} classmate${n === 1 ? '' : 's'} on this tower`;
  }
  async function connectLive(code){
    pill();
    try{
      LIVE.conn = await Promise.race([MC.live.player(code, onSnap, () => pill()), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))]);
      setInterval(() => { if(LIVE.on && Race.me && ['lives','countdown','play','question','wave','out','done'].includes(Game.state)) LIVE.conn.send(myState()); }, 333);
      setInterval(() => { pill(); if(LIVE.on && Race.me && Game.state !== 'play' && Game.state !== 'question') syncRivals(); }, 1000);   // keep the HUD list fresh before the climb starts too
      if(cls && !LIVE.on){ LIVE.on = true; WAVES.syncWait = true; if(Race.me){ Race.rivals = []; syncRivals(); } }   // connected after the climb began
    }catch(e){ console.warn('Live climb unavailable', e); LIVE.failed = true; LIVE.conn = null; }
    pill();
  }
  // read-only peeks for tests: who is shown (and drawn), and a fingerprint of the tower being climbed
  window.mcLavaLive = () => ({ on:LIVE.on, boosts:WAVES.boosts, lavaMult:WAVES.lavaMult(), sent:myState() });   // read-only peek for tests
  window.mcLavaGhosts = () => [...LIVE.remotes.entries()].map(([n, R]) => ({ n, r:R.meta && R.meta.r, look:R.meta && R.meta.b || null, drawn:R.spr ? Brick.lookKey(R.spr.look) : null }));
  window.mcLavaFingerprint = () => { const s = JSON.stringify([Array.from(Level.grid), Level.plats.map(p => [p.x0, p.x1, p.y, p.kind]), Level.movers.map(m => [m.x0, m.y0, m.w, m.axis, m.range, m.speed, m.phase]),
      Level.fallers.map(f => [f.x0, f.y0, f.w]), Level.springs.map(s => [s.x, s.y]), Level.saws.map(s => [s.x0, s.x1, s.y, s.speed]), Level.ladders.map(l => [l.x, l.y0, l.y1]), [...Level.ice].sort((a, b) => a - b)]);
    let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16) + ':' + s.length; };
  const joinCode = new URLSearchParams(location.search).get('join');
  if(joinCode && MC.live && MC.live.supported('lava') && MC.configured()) connectLive(joinCode.toUpperCase().replace(/[^A-Z0-9]/g, ''));

  // report every climb when it ends (escaped or out of lives)
  const end = Game.end;
  Game.end = function(how){
    if(this.state === 'done') return end.apply(this, arguments);
    const out = end.apply(this, arguments);
    const me = Race.me, ok = how === 'finish' && me.finished;
    if(cls){ cls.done++; if(ok) cls.best = cls.best == null ? me.finishTime : Math.min(cls.best, me.finishTime);
             cls.correct += me.questionsCorrect; cls.answered += me.questionsAnswered; cls.counted = me; }
    MC.result({ score:ok ? me.finishTime : 0, correct:me.questionsCorrect, answered:me.questionsAnswered,
                seconds:Game.t, variant:variant(), save:ok,
                details:{ how, round:Match.round, rounds:Match.rounds, height:Math.round(me.maxHeight), deaths:me.deaths, burns:me.burns,
                          lives:me.startLives, maths:QuestionDatabase.difficulty, place:me.elimPlace || Race.order().indexOf(me) + 1,
                          wave:WAVES.on ? WAVES.wave : undefined, boostsSent:WAVES.on ? WAVES.myBoosts : undefined } });
    return out;
  };

  // the setup screen is built after the images load; wait for it before auto-starting
  const ready = fn => { if($('#topic') && $('#topic').options.length) fn(); else setTimeout(() => ready(fn), 100); };
  const seg = (id, v) => $(id).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.d === v));
  const pick = (v, d) => ['easy','medium','hard'].includes(v) ? v : d;

  MC.register({
    game:'lava',
    keepLive:true,
    start(ctx){
      const s = ctx.settings || {};
      name = ctx.username || name;
      ready(() => {
        Game.diff = pick(s.lava, 'medium'); seg('#diff', Game.diff);
        QuestionDatabase.difficulty = pick(s.difficulty, 'medium'); seg('#qdiff', QuestionDatabase.difficulty);
        const topic = s.topic && [...$('#topic').options].some(o => o.value === s.topic) ? s.topic : 'mixed';
        QuestionDatabase.topic = topic; $('#topic').value = topic;
        const n = Math.max(1, Math.min(20, Math.round(+s.rounds || 3)));
        cls = { rounds:n, done:0, best:null, correct:0, answered:0, counted:null };
        try{ showBest(); }catch(e){}
        AudioManager.unlock();
        $('#start').classList.add('hidden');
        LIVE.on = !!LIVE.conn && !LIVE.failed;
        WAVES.on = true;                                   // class game: the waves elimination race (3 lives, wave breaks at checkpoints, eliminated = lava boosts)
        WAVES.syncWait = LIVE.on;                          // with the live link: everyone waits at each checkpoint until the whole class is ready
        WAVES.syncAlive = () => LIVE.lastSnap && Date.now() - LIVE.lastSnap < 5000;
        Match.reset(n); Game.start();
      });
    },
    live(){
      if(!cls) return {};
      const me = Race.me || {}, n = cls.rounds, done = cls.done >= n;
      const now = Race.me && Race.me !== cls.counted;      // questions in the climb being played now
      const lastClimb = cls.done + 1 >= n;
      let status = done ? `${n}/${n} climbs done` : n > 1 ? `Climb ${Math.min(n, cls.done + 1)}/${n}` : '';
      if(!done && now){
        const part = me.out ? 'Eliminated' : me.finished ? `Finished ${fmt(me.finishTime)}` : WAVES.phase === 'wait' ? `Waiting at wave ${WAVES.wave} · ${me.lives} ${me.lives === 1 ? 'life' : 'lives'}` : `Wave ${WAVES.wave} · ${me.lives} ${me.lives === 1 ? 'life' : 'lives'}`;
        status = status ? `${status} · ${part}` : part; }
      return { score:cls.best, correct:cls.correct + (now ? me.questionsCorrect : 0), answered:cls.answered + (now ? me.questionsAnswered : 0),
               status, finished:done || !!(now && me.out && lastClimb) };
    },
  });
  MC.onUser(u => { if(u && !cls) name = u.username; if(!u && !cls) name = null; if(B) B.setLook(u ? Brick.lookOf(u) : null); });
})();
