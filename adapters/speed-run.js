/* Speed Run (maths-dash) <-> Mathcade online */
(function(){
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const variant = () => cap(QuestionDatabase.difficulty || 'medium') + ' maths';
  let name = MC.user ? MC.user.username : null;          // shown instead of "You"
  let cls = null;                                         // class game: { rounds, done, best }

  /* one course for the whole class: the course is hand-built, but the bees' starting phase comes from
     Math.random, so in a class game it is seeded per race and every student meets the same bees */
  const buildLevelOrig = buildLevel;
  buildLevel = function(){ const out = MC.withSeed('speed-run-r' + Match.round, () => buildLevelOrig.apply(this, arguments)); for(const b of Level.bees) b.t0 = b.t; return out; };
  // read-only fingerprint of the course being raced (tests compare it across students)
  window.mcSpeedRunFingerprint = () => { const r = v => Math.round(v * 1000) / 1000;
    const s = JSON.stringify([Array.from(Level.grid), Level.theme, Level.finishX, Level.movers.map(m => [m.x0, m.y0, m.w, m.axis, m.range, m.speed]), Level.fallers.map(f => [f.x0, f.y0, f.w]),
      Level.snails.map(s => [s.min, s.max, s.y]), Level.blobs.map(b => [b.min, b.max, b.y]), Level.bees.map(b => [b.cx, b.cy, b.rx, b.ry, b.speed, r(b.t0)]),
      Level.fishes.map(f => [f.x, f.surface]), Level.coins.map(c => [c.x, c.y, c.kind]), Level.checkpoints.map(c => [c.x, c.y])]);
    let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16) + ':' + s.length; };

  // the player's name in the race, HUD and leaderboards
  const raceStart = Race.start;
  Race.start = function(n){ const out = raceStart.call(this, name || n); if(LIVE.on){ this.rivals = []; syncRivals(); } return out; };

  /* ---------- live race: classmates' runners on the same course ----------
     Each iPad sends its runner 3 times a second; the teacher's screen sends back one
     snapshot of everyone 4 times a second. Runners are drawn 350 ms behind the newest
     snapshot so their movement can be smoothed between updates. */
  const LIVE = { on:false, conn:null, remotes:new Map(), offset:null, pill:null, failed:false };
  const DELAY = 350, COLS_BY_CHAR = { green:'#3CB563', pink:'#F06BB3', purple:'#9A4FE0', yellow:'#E8B820', beige:'#C9A27A' };
  // Brick: the player wears the account's equipped look (brick.js); classmates' ghosts wear theirs
  const B = window.Brick && typeof BrickPlayer !== 'undefined' ? BrickPlayer : null;
  if(B) B.setLook(MC.user ? Brick.lookOf(MC.user) : null);
  // class games skip the client's own profile refresh: fetch it so the equipped look is the latest one
  if(B && MC.token() && new URLSearchParams(location.search).get('join') && MC.refreshMe) MC.refreshMe();
  const lookFrom = s => { if(typeof s !== 'string') return null; const [base, hat, shoes, skin, fx] = s.split('|'); return Brick.normalize({ base, hat, shoes, skin, fx }); };
  const anim = () => Player.hurt ? 'h' : !Player.grounded ? 'j' : Math.abs(Player.vx) > 30 ? 'w' : 'i';
  const myState = () => { const me = Race.me || {}; return { n:name, c:Game.char, x:Math.round(Player.x), y:Math.round(Player.y), f:Player.face, a:anim(),
    pr:Math.round((me.progress || 0) * 1000) / 1000, fi:!!me.finished, ft:me.finishTime == null ? null : Math.round(me.finishTime * 100) / 100, r:Match.round, b:B ? Brick.lookKey(B.current()) : undefined,
    cc:me.collectibles || 0, qc:me.questionsCorrect || 0 }; };     // cc = gold coins collected, qc = maths right: classmates show "coins earned" = cc + qc
  function onSnap(snap){
    if(!snap || !Array.isArray(snap.p)) return;
    const now = Date.now(), off = now - snap.t;
    LIVE.offset = LIVE.offset == null ? off : LIVE.offset + (off - LIVE.offset) * 0.1;
    for(const p of snap.p){
      if(!p || p.n === name) continue;
      let R = LIVE.remotes.get(p.n); if(!R){ R = { buf:[], rival:null }; LIVE.remotes.set(p.n, R); }
      const last = R.buf[R.buf.length - 1];
      if(last && (last.r !== p.r || p.x < last.x - 3000)) R.buf.length = 0;          // new race: don't slide across the course
      R.buf.push({ t:snap.t, x:p.x, y:p.y, f:p.f, a:p.a, r:p.r }); if(R.buf.length > 24) R.buf.shift();
      R.meta = p; R.seen = now;
    }
    pill();
  }
  function remotesNow(){ const now = Date.now(); return [...LIVE.remotes.entries()].filter(([n, R]) => now - R.seen < 12000 && R.meta && R.meta.r === Match.round); }
  function syncRivals(){
    if(!LIVE.on || !Race.me) return;
    Race.rivals = remotesNow().map(([n, R]) => {
      const r = R.rival || (R.rival = { ...Race.newPlayer(n), remote:true });
      const gl = B && lookFrom(R.meta.b); r.col = gl ? Brick.CATALOGUE.item(gl.base).main : COLS_BY_CHAR[R.meta.c] || '#5F5A66'; r.progress = R.meta.pr || 0; r.finished = !!R.meta.fi; r.finishTime = R.meta.ft;
      r.coinsEarned = R.meta.cc == null && R.meta.qc == null ? null : (R.meta.cc | 0) + (R.meta.qc | 0); return r; });
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
  function drawRemotes(t){
    const hostT = Date.now() - (LIVE.offset || 0) - DELAY, z = Camera.z, list = remotesNow(), many = list.length > 12;
    for(const [n, R] of list){
      const p = posAt(R, hostT); if(!p) continue;
      if(p.x < Camera.x - 200 || p.x > Camera.x + vw / z + 200) continue;
      const gs = B ? ghostSprite(R, many) : null;
      if(gs){
        const vy = R.lastY == null ? 0 : (p.y - R.lastY) * 60; R.lastY = p.y;
        const state = p.a === 'h' ? 'hurt' : p.a === 'j' ? 'jump' : p.a === 'w' ? 'run' : 'idle';
        gs.draw(ctx, p.x + Player.w / 2, p.y + Player.h + 1, { t:t + n.length * 0.37, state, facing:p.f < 0 ? -1 : 1, vy, alpha:0.72, since:1 });
        ctx.font = "900 17px Nunito,system-ui,sans-serif"; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,30,50,.75)'; ctx.fillStyle = '#fff';
        ctx.strokeText(n, p.x + Player.w / 2, p.y - 42); ctx.fillText(n, p.x + Player.w / 2, p.y - 42);   // above the tallest hats
        continue;
      }
      const c = COLS_BY_CHAR[R.meta.c] ? R.meta.c : 'green';
      const suf = p.a === 'h' ? '_hit' : p.a === 'j' ? '_jump' : p.a === 'w' ? (Math.floor(t * 6 + n.length) % 2 ? '_walk_a' : '_walk_b') : '_idle';
      ctx.globalAlpha = 0.85; drawSprite('character_' + c + suf, p.x + Player.w / 2, p.y + Player.h + 2, 100, p.f < 0); ctx.globalAlpha = 1;
      ctx.font = "900 17px Nunito,system-ui,sans-serif"; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,30,50,.75)'; ctx.fillStyle = '#fff';
      ctx.strokeText(n, p.x + Player.w / 2, p.y - 18); ctx.fillText(n, p.x + Player.w / 2, p.y - 18);
    }
  }
  const drawPlayerOrig = drawPlayer;
  drawPlayer = function(t){ if(LIVE.on) drawRemotes(t); return drawPlayerOrig.apply(this, arguments); };
  const raceStep = Race.step;
  Race.step = function(dt){
    if(!LIVE.on) return raceStep.call(this, dt);
    this.t += dt; const me = this.me; me.x = Player.x; me.y = Player.y; me.velocityX = Player.vx; me.velocityY = Player.vy;
    if(!me.finished) me.progress = Math.max(0, Math.min(1, Player.x / Level.finishX));
    syncRivals();
  };
  const resultsShow = Results.show;
  Results.show = function(){ if(LIVE.on) Race.rivals = Race.rivals.filter(r => r.finished); return resultsShow.apply(this, arguments); };
  function pill(){
    if(!MC.inSession()) return;
    // the connection pill is only for the wait before the race: once racing, the HUD stays clean
    if(LIVE.pill) LIVE.pill.hidden = Game.state !== 'menu';
    if(Game.state !== 'menu') return;
    if(!LIVE.pill){ LIVE.pill = document.createElement('div'); LIVE.pill.setAttribute('role','status');
      LIVE.pill.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(68px + env(safe-area-inset-top,0px));z-index:50;font:800 13px Nunito,system-ui,sans-serif;color:#fff;background:rgba(19,35,58,.82);border-radius:999px;padding:5px 12px;pointer-events:none';
      document.body.appendChild(LIVE.pill); }
    const n = remotesNow().length;
    LIVE.pill.innerHTML = LIVE.failed ? 'Live view unavailable: racing computer players'
      : !LIVE.conn ? 'Connecting to the live race\u2026'
      : LIVE.offset == null ? '<span style="color:#FFE36B">\u25CF</span> Waiting for your teacher\u2019s screen'
      : `<span style="color:#3CD48A">\u25CF</span> Live race: ${n} classmate${n === 1 ? '' : 's'} on this course`;
  }
  async function connectLive(code){
    pill();
    try{
      LIVE.conn = await Promise.race([MC.live.player(code, onSnap, () => pill()), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))]);
      setInterval(() => { if(LIVE.on && Race.me && ['countdown','play','question','done'].includes(Game.state)) LIVE.conn.send(myState()); }, 333);
      setInterval(pill, 1000);
      if(cls && !LIVE.on){ LIVE.on = true; if(Race.me){ Race.rivals = []; syncRivals(); } }   // connected after the race began
    }catch(e){ console.warn('Live race unavailable', e); LIVE.failed = true; LIVE.conn = null; }
    pill();
  }
  // read-only peek at the live race for tests: who is shown, with which look, and the look actually drawn
  window.mcSpeedRunGhosts = () => [...LIVE.remotes.entries()].map(([n, R]) => ({ n, look:R.meta && R.meta.b || null, drawn:R.spr ? Brick.lookKey(R.spr.look) : null }));
  const joinCode = new URLSearchParams(location.search).get('join');
  if(joinCode && MC.live && MC.live.supported('speed-run') && MC.configured()) connectLive(joinCode.toUpperCase().replace(/[^A-Z0-9]/g, ''));

  // report every finished race the moment the player crosses the line
  const finish = Game.finish;
  Game.finish = function(){
    const out = finish.apply(this, arguments);
    const me = Race.me, t = me.finishTime;
    if(cls){ cls.done++; cls.best = cls.best == null ? t : Math.min(cls.best, t); cls.correct += me.questionsCorrect; cls.answered += me.questionsAnswered; cls.counted = me; }
    // gold coins picked up in the race become real Mathcade coins (the server adds them to the correct-answer coins, capped at 60 per race)
    const picked = Math.max(0, me.collectibles | 0);
    MC.result({ score:t, correct:me.questionsCorrect, answered:me.questionsAnswered, seconds:t, variant:variant(), bonusCoins:picked,
                details:{ round:Match.round, rounds:Match.rounds, deaths:me.deaths, hazards:me.hazardsHit, coins:picked, coinsCollected:picked,
                          place:Race.order().indexOf(me) + 1 } });
    return out;
  };

  // the game builds its setup screen after its images load; wait for that before auto-starting
  const ready = fn => { if($('#topic') && $('#topic').options.length) fn(); else setTimeout(() => ready(fn), 100); };

  MC.register({
    game:'speed-run',
    keepLive:true,
    start(ctx){
      const s = ctx.settings || {};
      name = ctx.username || name;
      ready(() => {
        const d = ['easy','medium','hard'].includes(s.difficulty) ? s.difficulty : 'medium';
        QuestionDatabase.difficulty = d;
        $('#diff').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.d === d));
        const topic = s.topic && [...$('#topic').options].some(o => o.value === s.topic) ? s.topic : 'mixed';
        QuestionDatabase.topic = topic; $('#topic').value = topic;
        const n = Math.max(1, Math.min(20, Math.round(+s.rounds || 3)));
        cls = { rounds:n, done:0, best:null, correct:0, answered:0, counted:null };
        try{ showBest(); }catch(e){}
        AudioManager.unlock();
        $('#start').classList.add('hidden');
        LIVE.on = !!LIVE.conn && !LIVE.failed;
        Game.classMode = true;                        // leaner class-race HUD (no Games button, no name pill)
        Match.reset(n); Game.start(); pill();
      });
    },
    live(){
      const me = Race.me || {};
      if(!cls) return {};
      const n = cls.rounds, done = cls.done >= n;
      const now = Race.me && Race.me !== cls.counted;      // questions in the race being run now
      return { score:cls.best, correct:cls.correct + (now ? me.questionsCorrect : 0), answered:cls.answered + (now ? me.questionsAnswered : 0),
               status: done ? `${n}/${n} races done` : `Race ${Math.min(n, cls.done + 1)}/${n}`, finished:done };
    },
  });
  MC.onUser(u => { if(u && !cls) name = u.username; if(!u && !cls) name = null; if(B) B.setLook(u ? Brick.lookOf(u) : null); });
})();
