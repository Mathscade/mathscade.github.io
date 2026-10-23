/* Hide & Seek <-> Mathcade online.
   Practice (no class code): the game runs on its own with computer players.
   Class game: one shared warehouse for the whole class. Each iPad moves its own character, keeps its own stamina and
   sends where it is ~5 times a second; the teacher's screen (adapters/hideseek-referee.js) splits the class into
   Red and Blue, checks tags and keeps the score. Every iPad works out which team is hiding from the start time, so
   the teams swap together every minute. Classmates are drawn 300 ms behind the newest snapshot, smoothed. */
(function(){
  const Z = window.mcHide; if(!Z) return;
  const { players, Game, CONFIG } = Z;
  const JOIN = (window.MC && MC.classCode && MC.classCode()) || null;
  const DELAY = 300, SEND_MS = 200;
  let name = MC.user ? MC.user.username : null, inClass = false, conn = null, offset = null, snapOff = null, lastG = null, placed = false, reported = false;
  const remotes = new Map();          // name -> { buf:[{t,x,y,vx,vy,f,d}], look, seen }
  let tagReq = null, tagT = 0, wasCaught = false;

  const lookFrom = s => { if(typeof s !== 'string' || !window.Brick) return null; const [base, hat, shoes] = s.split('|'); return Brick.normalize({ base, hat, shoes }); };
  const hostNow = () => Date.now() - (offset || 0);

  /* ---------- what this iPad sends ---------- */
  function myState(){
    const me = Z.me; if(!me || !placed) return null;
    return { n:name, x:Math.round(me.x), y:Math.round(me.y), vx:Math.round(me.vx || 0), vy:Math.round(me.vy || 0), f:me.face || 1,
             d:me.dir == null ? null : Math.round(me.dir * 100) / 100, l:me.level || 0, b:window.Brick && MC.user ? Brick.lookKey(Brick.lookOf(MC.user)) : '', r:1,
             tg:tagReq && Date.now() < tagT ? tagReq : null };
  }
  function send(){ const s = myState(); if(conn && s) conn.send(s); }

  /* ---------- what the teacher's screen sends back ---------- */
  function onSnap(snap){
    if(!snap) return;
    const now = Date.now(), so = now - snap.t; snapOff = snapOff == null ? so : snapOff + (so - snapOff) * 0.1;
    if(snap.g && snap.g.now){ const off = now - snap.g.now; offset = offset == null ? off : offset + (off - offset) * 0.1; }
    for(const p of snap.p || []){
      if(!p || !p.n || p.n === name) continue;
      let R = remotes.get(p.n); if(!R){ R = { buf:[] }; remotes.set(p.n, R); }
      R.buf.push({ t:snap.t, x:p.x, y:p.y, vx:p.vx, vy:p.vy, f:p.f, d:p.d, l:p.l || 0 }); if(R.buf.length > 20) R.buf.shift();
      R.look = p.b; R.seen = now;
    }
    if(snap.g) applyG(snap.g);
  }
  function applyG(g){
    lastG = g; if(!inClass || !Z.me) return;
    Game.dur = Math.max(1, (g.end - g.s) / 1000); Game.first = g.f;
    for(const n in g.tm){
      if(n === name){ Z.me.team = g.tm[n]; continue; }
      let p = players.get(n); if(!p){ p = Z.newPlayer(n, g.tm[n], {}); const R = remotes.get(n); if(R && R.buf.length){ const b = R.buf[R.buf.length - 1]; p.x = b.x; p.y = b.y; } }
      p.team = g.tm[n];
    }
    for(const n of [...players.keys()]) if(n !== name && !(n in g.tm)) players.delete(n);
    if(!placed && g.tm[name]){ placeMe(g); placed = true; Game.state = 'play'; Game.round = -1; }
    // catches: who is out, who is just back, the score and my own numbers
    for(const p of players.values()){ if(p.me) continue; const c = (g.c && g.c[p.name]) || 0, im = (g.im && g.im[p.name]) || 0;
      const was = p.caught > 0; p.caught = c > g.now ? 1 : 0; p.immune = im > g.now ? (im - g.now) / 1000 : 0;
      if(p.caught && !was && placed && window.mcHidePop) mcHidePop(p); }
    const st = g.st && g.st[name] || [0, 0];
    if(st[0] > Game.stats.catches){ Game.stats.catches = st[0]; }
    Game.score = { R:g.sc.R, B:g.sc.B }; Z.UI.counts();
    if(g.e && !reported){ reported = true; Game.left = 0; Game.mode = 'class-over'; Z.finish({ sc:g.sc, w:g.w }); report(g); }
  }
  /* everyone starts spread round the warehouse: the same spot list on every iPad, one spot each */
  function placeMe(g){
    const all = Object.keys(g.tm).sort(), i = Math.max(0, all.indexOf(name));
    const spots = Z.startSpots(all.length, Z.rng(11));
    Object.assign(Z.me, spots[i] || spots[0]); Z.me.team = g.tm[name];
  }

  /* ---------- every frame: classmates' positions, the round, being caught, tags, the clock ---------- */
  function posAt(R, t){
    const b = R.buf; if(!b.length) return null; if(t <= b[0].t) return b[0];
    for(let i = b.length - 1; i > 0; i--){ const a = b[i - 1], c = b[i]; if(t >= a.t && t <= c.t){ const k = (t - a.t) / Math.max(1, c.t - a.t); return { x:a.x + (c.x - a.x) * k, y:a.y + (c.y - a.y) * k, vx:c.vx, vy:c.vy, f:c.f, d:c.d, l:c.l }; } }
    return b[b.length - 1];
  }
  window.HSNet = {
    step(dt){
      if(!inClass || !lastG || !placed) return;
      const g = lastG, hn = hostNow();
      Game.left = Math.max(0, (g.end - hn) / 1000);
      const r = Math.max(0, Math.floor((hn - g.s) / g.rl));
      if(r !== Game.round && hn < g.end) Z.newRound(r, Game.round < 0);
      const t = Date.now() - (snapOff || 0) - MC.live.delay(DELAY, conn), now = Date.now();
      for(const [n, R] of remotes){
        const p = players.get(n); if(!p) continue;
        if(now - R.seen > 12000){ p.x = -999; continue; }
        const q = posAt(R, t); if(!q) continue;
        p.x = q.x; p.y = q.y; p.vx = q.vx; p.vy = q.vy; p.face = q.f; p.dir = q.d; p.level = q.l || 0;
        if(window.Brick && R.look && (!p.look || Brick.lookKey(p.look) !== R.look)) p.look = lookFrom(R.look);
      }
      // me: out for 10 s after being caught, then back somewhere else
      const me = Z.me, until = (g.c && g.c[name]) || 0;
      if(until > g.now){ if(!wasCaught){ wasCaught = true; Game.stats.caught++; } me.caught = Math.max(0.01, (until - hn) / 1000); me.vx = me.vy = 0; }
      else if(wasCaught){ wasCaught = false; Z.comeBack(me); }
      else me.caught = 0;
      me.immune = (g.im && g.im[name] > hn) ? (g.im[name] - hn) / 1000 : 0;
      // a seeker touching a hider asks the teacher's screen to count the catch
      const hide = Z.hidingTeam(Math.max(0, Game.round));
      if(me.team !== hide && !(me.caught > 0)){
        for(const p of players.values()){ if(p.me || p.team !== hide || p.caught > 0 || p.immune > 0 || (p.level || 0) !== (me.level || 0)) continue;
          if(Math.hypot(p.x - me.x, p.y - me.y) < CONFIG.TAG_R + 8){ if(tagReq !== p.name || Date.now() > tagT){ tagReq = p.name; tagT = Date.now() + 1200; send(); } break; } }
      }
    },
  };

  /* ---------- the score ---------- */
  function points(){ const st = lastG && lastG.st && lastG.st[name] || [0, 0]; const win = lastG && lastG.e && lastG.w && Z.me && Z.me.team === lastG.w;
    return st[0] * CONFIG.POINTS_CATCH + (win ? CONFIG.POINTS_TEAM : 0); }
  function report(g){
    const st = g.st && g.st[name] || [0, 0], me = Z.me;
    MC.result({ score:points(), correct:Game.stats.correct, answered:Game.stats.answered, seconds:Math.round(Game.dur), variant:Math.round(Game.dur / 60) + ' min',
      details:{ team:me && me.team, won:!!(g.w && me && me.team === g.w), catches:st[0], caught:st[1] } });
  }

  async function connect(){
    try{
      conn = await MC.live.player(JOIN, onSnap, () => {});
      setInterval(send, SEND_MS);
    }catch(e){ console.warn('Hide & Seek live link unavailable', e); }
  }

  if(window.MC && MC.register) MC.register({
    game:'hideseek',
    keepLive:true,
    start(ctx){
      inClass = true; name = ctx.username || name || 'You';
      const s = ctx.settings || {};
      if(['easy','medium','hard'].includes(s.difficulty)) window.mcHideSetDiff && mcHideSetDiff(s.difficulty, s.topic);
      Game.mode = 'class';
      players.clear(); const me = Z.newPlayer(name, 'R', { me:true, look:window.Brick && MC.user ? Brick.lookOf(MC.user) : null });
      const z = Z.zone('bay'); me.x = (z.x + z.w / 2) * CONFIG.T; me.y = (z.y + z.h / 2) * CONFIG.T;
      document.getElementById('setup').classList.add('hidden'); document.getElementById('hubback').style.display = 'none';
      document.getElementById('again').style.display = 'none';
      Z.begin(Math.max(60, Math.round(ctx.remainingSeconds || (+s.minutes || 6) * 60)));
      Game.state = 'wait';
      if(lastG) applyG(lastG);
      if(!conn && JOIN) connect();
    },
    live(){
      if(!inClass) return {};
      const me = Z.me;
      return { score:points(), correct:Game.stats.correct, answered:Game.stats.answered,
               status:me && placed ? (Z.seeking(me) ? 'Seeking' : 'Hiding') + (me.caught > 0 ? ' · caught' : '') : '', finished:reported };
    },
    onEnded(){ inClass = false; },
  });
  MC.onUser && MC.onUser(u => { if(u && !inClass) name = u.username; });
})();
