/* Outbreak (the zombie game; files still called zombie-lab) <-> Mathcade online.
   Practice (no class code): the game runs on its own with computer players.
   Class game: one shared lab for the whole class. Each iPad moves its own character and sends where it is
   ~5 times a second; the teacher's screen (adapters/zombie-referee.js) splits the class into Scientists and
   Zombies, checks tags, runs the maths races and says who has changed side. Classmates are drawn 300 ms
   behind the newest snapshot, smoothed between updates. */
(function(){
  const Z = window.mcZombie; if(!Z) return;
  const { players, Game, Duel, CONFIG } = Z;
  const JOIN = (window.MC && MC.classCode && MC.classCode()) || null;
  const DELAY = 300, SEND_MS = 200;
  let name = MC.user ? MC.user.username : null, inClass = false, conn = null, offset = null, snapOff = null, lastG = null, placed = false, reported = false;
  const remotes = new Map();          // name -> { buf:[{t,x,y,vx,vy,f}], look, seen }
  const doneRes = new Set();          // race results already shown
  let myDq = null, tagReq = null, tagT = 0;

  const lookFrom = s => { if(typeof s !== 'string' || !window.Brick) return null; const [base, hat, shoes] = s.split('|'); return Brick.normalize({ base, hat, shoes }); };
  const hostNow = () => Date.now() - (offset || 0);

  /* ---------- what this iPad sends ---------- */
  function myState(){
    const me = Z.me; if(!me) return null;
    return { n:name, x:Math.round(me.x), y:Math.round(me.y), vx:Math.round(me.vx || 0), vy:Math.round(me.vy || 0), f:me.face || 1,
             b:window.Brick && MC.user ? Brick.lookKey(Brick.lookOf(MC.user)) : '', r:1,
             tg:tagReq && Date.now() < tagT ? tagReq : null, dq:myDq };
  }
  const localProgress = Z.Net.progress;   // practice games keep their own races
  Z.Net.progress = (id, n, ms) => { if(!inClass) return localProgress(id, n, ms); myDq = [id, n, Math.round(ms)]; send(); };
  function send(){ const s = myState(); if(conn && s) conn.send(s); }

  /* ---------- what the teacher's screen sends back ---------- */
  function onSnap(snap){
    if(!snap) return;
    const now = Date.now(), so = now - snap.t; snapOff = snapOff == null ? so : snapOff + (so - snapOff) * 0.1;
    if(snap.g && snap.g.now){ const off = now - snap.g.now; offset = offset == null ? off : offset + (off - offset) * 0.1; }
    for(const p of snap.p || []){
      if(!p || !p.n || p.n === name) continue;
      let R = remotes.get(p.n); if(!R){ R = { buf:[] }; remotes.set(p.n, R); }
      R.buf.push({ t:snap.t, x:p.x, y:p.y, vx:p.vx, vy:p.vy, f:p.f }); if(R.buf.length > 20) R.buf.shift();
      R.look = p.b; R.seen = now;
    }
    if(snap.g) applyG(snap.g);
  }
  function applyG(g){
    lastG = g; if(!inClass || !Z.me) return;
    // timer, release, teams
    Game.dur = Math.max(1, (g.end - g.s) / 1000); Game.release = Math.max(0, (g.rel - g.s) / 1000);
    for(const n in g.tm){
      if(n === name){ if(Z.me.team !== g.tm[n]){ const was = Z.me.team; Z.me.team = g.tm[n]; if(was && placed) Z.toast(g.tm[n] === 'Z' ? 'You are a ZOMBIE now! Hunt the scientists.' : 'Cured! You are a SCIENTIST again. Hide!', 3); } continue; }
      let p = players.get(n); if(!p){ p = Z.newPlayer(n, g.tm[n], {}); const R = remotes.get(n); if(R && R.buf.length){ const b = R.buf[R.buf.length - 1]; p.x = b.x; p.y = b.y; } }
      p.team = g.tm[n];
    }
    for(const n of [...players.keys()]) if(n !== name && !(n in g.tm)) players.delete(n);
    if(!placed && g.tm[name]){ placeMe(g); placed = true; Game.state = 'play'; Z.UI.role(); }
    // races
    const mine = (g.d || []).find(d => d[1] === name || d[2] === name);
    for(const p of players.values()){ const d = (g.d || []).find(x => x[1] === p.name || x[2] === p.name); p.duel = d ? d[0] : null; p.immune = (g.im && g.im[p.name] && g.im[p.name] > g.now) ? (g.im[p.name] - g.now) / 1000 : 0; }
    if(mine){
      const role = mine[1] === name ? 'Z' : 'S', them = role === 'Z' ? mine[2] : mine[1];
      if(Duel.id !== mine[0] && !doneRes.has(mine[0])){ myDq = [mine[0], 0, 0]; Duel.start(mine[0], them, role); tagReq = null; }
      Duel.setTheirs(role === 'Z' ? mine[4] : mine[3]);
    }
    for(const r of g.res || []){
      if(doneRes.has(r[0])) continue; doneRes.add(r[0]);
      if(r[1] === name || r[2] === name){ if(Duel.id === r[0]) Duel.finish(r[3]); }
      else if(placed && r[3] !== 'escaped') Z.toast(r[3] === 'infected' ? `🧟 ${r[2]} was infected by ${r[1]}` : `💉 ${r[2]} cured ${r[1]}`);
    }
    Z.UI.counts();
    if(g.e && !reported){ reported = true; Game.left = 0; Game.mode = 'class-over'; Z.finish(); report(g); }
  }
  /* scientists start in the Atrium, zombies in Quarantine: the same spot list on every iPad, one spot each */
  function placeMe(g){
    const team = g.tm[name], mates = Object.keys(g.tm).filter(n => g.tm[n] === team).sort(), i = Math.max(0, mates.indexOf(name));
    const spots = Z.spawnSpots(team === 'Z' ? 'quar' : 'atrium', mates.length, Z.rng(7));
    Object.assign(Z.me, spots[i] || spots[0]); Z.me.team = team;
    Z.toast(team === 'Z' ? 'You are a ZOMBIE! You are let out in 10 seconds…' : 'You are a SCIENTIST! Hide: the zombies get out in 10 seconds…', 4);
  }

  /* ---------- every frame: classmates' positions, tags, the clock ---------- */
  function posAt(R, t){
    const b = R.buf; if(!b.length) return null; if(t <= b[0].t) return b[0];
    for(let i = b.length - 1; i > 0; i--){ const a = b[i - 1], c = b[i]; if(t >= a.t && t <= c.t){ const k = (t - a.t) / Math.max(1, c.t - a.t); return { x:a.x + (c.x - a.x) * k, y:a.y + (c.y - a.y) * k, vx:c.vx, vy:c.vy, f:c.f }; } }
    return b[b.length - 1];
  }
  window.ZNet = {
    step(dt){
      if(!inClass) return;
      if(lastG){ Game.left = Math.max(0, (lastG.end - hostNow()) / 1000); const sinceStart = (hostNow() - lastG.s) / 1000; Game.left = Math.min(Game.left, Game.dur - Math.max(0, sinceStart)); }
      const t = Date.now() - (snapOff || 0) - DELAY, now = Date.now();   // in the teacher's screen's clock (snapshot times)
      for(const [n, R] of remotes){
        const p = players.get(n); if(!p) continue;
        if(now - R.seen > 12000){ p.x = -999; continue; }
        const q = posAt(R, t); if(!q) continue;
        p.x = q.x; p.y = q.y; p.vx = q.vx; p.vy = q.vy; p.face = q.f;
        if(window.Brick && R.look && (!p.look || Brick.lookKey(p.look) !== R.look)) p.look = lookFrom(R.look);
      }
      // a zombie touching a free scientist asks the teacher's screen to start a race
      const me = Z.me;
      if(me && me.team === 'Z' && !me.duel && !(me.immune > 0) && !Duel.open && Game.left < Game.dur - Game.release){
        for(const p of players.values()){ if(p.me || p.team !== 'S' || p.duel || p.immune > 0) continue;
          if(Math.hypot(p.x - me.x, p.y - me.y) < CONFIG.TAG_R + 8){ if(tagReq !== p.name){ tagReq = p.name; tagT = Date.now() + 1200; send(); } break; } }
      }
    },
  };

  /* ---------- the score ---------- */
  function points(){ const st = lastG && lastG.st && lastG.st[name] || [0, 0, 0]; const win = lastG && lastG.e && lastG.w && Z.me && Z.me.team === lastG.w;
    return st[0] * CONFIG.POINTS_WIN + (win ? CONFIG.POINTS_TEAM : 0); }
  function report(g){
    const st = g.st && g.st[name] || [0, 0, 0], me = Z.me;
    MC.result({ score:points(), correct:Game.stats.correct, answered:Game.stats.answered, seconds:Math.round(Game.dur), variant:Math.round(Game.dur / 60) + ' min',
      details:{ team:me && me.team, won:!!(g.w && me && me.team === g.w), races:st[0], infections:st[1], cures:st[2] } });
  }

  async function connect(){
    try{
      conn = await MC.live.player(JOIN, onSnap, () => {});
      setInterval(send, SEND_MS);
    }catch(e){ console.warn('Outbreak live link unavailable', e); Z.toast('Can’t reach your teacher’s screen. Check the internet and reload.', 8); }
  }

  if(window.MC && MC.register) MC.register({
    game:'zombie',
    keepLive:true,
    start(ctx){
      inClass = true; name = ctx.username || name || 'You';
      const s = ctx.settings || {};
      if(['easy','medium','hard'].includes(s.difficulty)) window.mcZombieSetDiff && mcZombieSetDiff(s.difficulty, s.topic);
      Game.mode = 'class'; Game.state = 'wait';
      players.clear(); const me = Z.newPlayer(name, 'S', { me:true, look:window.Brick && MC.user ? Brick.lookOf(MC.user) : null });
      me.x = (Z.room('atrium').x + 6) * CONFIG.T; me.y = (Z.room('atrium').y + 3.5) * CONFIG.T;
      document.getElementById('setup').classList.add('hidden'); document.getElementById('hubback').style.display = 'none';
      document.getElementById('again').style.display = 'none';
      Z.toast('Waiting for the teacher’s screen to pick the teams…', 6);
      Z.begin(Math.max(60, Math.round(ctx.remainingSeconds || (+s.minutes || 5) * 60)));
      Game.state = lastG && lastG.tm && lastG.tm[name] ? 'play' : 'wait';
      if(lastG) applyG(lastG);
      if(!conn && JOIN) connect();
    },
    live(){
      if(!inClass) return {};
      const me = Z.me, st = lastG && lastG.st && lastG.st[name] || [0, 0, 0];
      return { score:points(), correct:Game.stats.correct, answered:Game.stats.answered,
               status:me ? (me.team === 'Z' ? 'Zombie' : 'Scientist') + (me.duel ? ' · maths race' : '') : '', finished:reported };
    },
    onEnded(){ inClass = false; Duel.close(); },
  });
  MC.onUser && MC.onUser(u => { if(u && !inClass) name = u.username; });
})();
