/* Total Outbreak <-> Mathcade online.
   Practice (no class code): the game runs on its own with computer players.
   Class game: one shared lab for the whole class. Each iPad moves its own character and sends where it is
   ~5 times a second; the teacher's screen (adapters/outbreak-referee.js) picks the zombie, checks tags, runs the
   maths races and says who has been infected. Classmates are drawn 300 ms
   behind the newest snapshot, smoothed between updates. */
(function(){
  const Z = window.mcOutbreak; if(!Z) return;
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
    return { n:name, x:Math.round(me.x), y:Math.round(me.y), vx:Math.round(me.vx || 0), vy:Math.round(me.vy || 0), f:me.face || 1, tc:me.team === 'H' && me.torch ? 1 : 0,
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
      R.buf.push({ t:snap.t, x:p.x, y:p.y, vx:p.vx, vy:p.vy, f:p.f, tc:p.tc }); if(R.buf.length > 20) R.buf.shift();
      R.look = p.b; R.seen = now;
    }
    if(snap.g) applyG(snap.g);
  }
  function applyG(g){
    lastG = g; if(!inClass || !Z.me) return;
    // timer, release, teams
    Game.dur = Math.max(1, (g.end - g.s) / 1000); Game.release = Math.max(0, (g.rel - g.s) / 1000);
    for(const n in g.tm){
      if(n === name){ if(Z.me.team !== g.tm[n]){ if(g.tm[n] === 'Z' && placed) Z.infect(Z.me, null); else Z.me.team = g.tm[n]; } continue; }
      let p = players.get(n); if(!p){ p = Z.newPlayer(n, g.tm[n], {}); const R = remotes.get(n); if(R && R.buf.length){ const b = R.buf[R.buf.length - 1]; p.x = b.x; p.y = b.y; } }
      if(p.team !== g.tm[n]){ p.team = g.tm[n]; if(p.team === 'Z') p.torch = false; }
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
      else if(placed) Z.toast(r[3] === 'infected' ? `🧟 ${r[2]} was infected by ${r[1]}` : `🏃 ${r[2]} got away from ${r[1]}`);
    }
    Z.UI.counts();
    if(g.e && !reported){ reported = true; Game.left = 0; Game.mode = 'class-over'; Z.finish(); report(g); }
  }
  /* humans start spread over the campus, the zombie in the gym: the same spot list on every iPad, one spot each */
  function placeMe(g){
    const team = g.tm[name], mates = Object.keys(g.tm).filter(n => g.tm[n] === team).sort(), i = Math.max(0, mates.indexOf(name));
    const spots = team === 'Z' ? Z.zombieSpots(mates.length, Z.rng(7)) : Z.humanSpots(mates.length, Z.rng(7));
    Object.assign(Z.me, spots[i] || spots[0]); Z.me.team = team; Z.UI.role();
    if(team === 'Z'){ Z.Panel.hide(); Z.Torch.set(false); } else Z.Panel.show();
    Z.toast(team === 'Z' ? 'You are THE ZOMBIE! You are let out in 10 seconds…' : 'Run and hide! The zombie is out in 10 seconds…', 4);
  }

  /* ---------- every frame: classmates' positions, tags, the clock ---------- */
  function posAt(R, t){
    const b = R.buf; if(!b.length) return null; if(t <= b[0].t) return b[0];
    for(let i = b.length - 1; i > 0; i--){ const a = b[i - 1], c = b[i]; if(t >= a.t && t <= c.t){ const k = (t - a.t) / Math.max(1, c.t - a.t); return { x:a.x + (c.x - a.x) * k, y:a.y + (c.y - a.y) * k, vx:c.vx, vy:c.vy, f:c.f, tc:c.tc }; } }
    return b[b.length - 1];
  }
  window.ONet = {
    step(dt){
      if(!inClass) return;
      if(lastG){ Game.left = Math.max(0, (lastG.end - hostNow()) / 1000); const sinceStart = (hostNow() - lastG.s) / 1000; Game.left = Math.min(Game.left, Game.dur - Math.max(0, sinceStart)); }
      const t = Date.now() - (snapOff || 0) - DELAY, now = Date.now();   // in the teacher's screen's clock (snapshot times)
      for(const [n, R] of remotes){
        const p = players.get(n); if(!p) continue;
        if(now - R.seen > 12000){ p.x = -999; continue; }
        const q = posAt(R, t); if(!q) continue;
        p.x = q.x; p.y = q.y; p.vx = q.vx; p.vy = q.vy; p.face = q.f; p.torch = p.team === 'H' && !!q.tc;
        if(window.Brick && R.look && (!p.look || Brick.lookKey(p.look) !== R.look)) p.look = lookFrom(R.look);
      }
      // a zombie touching a free scientist asks the teacher's screen to start a race
      const me = Z.me;
      if(me && me.team === 'Z' && !me.duel && !(me.immune > 0) && !Duel.open && Game.left < Game.dur - Game.release){
        for(const p of players.values()){ if(p.me || p.team !== 'H' || p.duel || p.immune > 0) continue;
          if(Math.hypot(p.x - me.x, p.y - me.y) < CONFIG.TAG_R + 8){ if(tagReq !== p.name){ tagReq = p.name; tagT = Date.now() + 1200; send(); } break; } }
      }
    },
  };

  /* ---------- the score ---------- */
  /* the score is 1 for surviving the night (the leaderboard adds these up: "times survived"), 0 if infected;
     survivors also get a coin bonus */
  const survived = () => !!(lastG && lastG.e && Z.me && Z.me.team === 'H');
  function report(g){
    const st = g.st && g.st[name] || [0, 0, 0], me = Z.me, s = survived();
    MC.result({ score:s ? 1 : 0, correct:Game.stats.correct, answered:Game.stats.answered, seconds:Math.round(Game.dur), variant:'',
      bonusCoins:s ? CONFIG.SURVIVE_COINS : 0, details:{ survived:s, infectedAt:Game.stats.infectedAt, races:st[0], infections:st[1] } });
  }

  async function connect(){
    try{
      conn = await MC.live.player(JOIN, onSnap, () => {});
      setInterval(send, SEND_MS);
    }catch(e){ console.warn('Total Outbreak live link unavailable', e); Z.toast('Can’t reach your teacher’s screen. Check the internet and reload.', 8); }
  }

  if(window.MC && MC.register) MC.register({
    game:'outbreak',
    keepLive:true,
    start(ctx){
      inClass = true; name = ctx.username || name || 'You';
      const s = ctx.settings || {};
      if(['easy','medium','hard'].includes(s.difficulty)) window.mcOutbreakSetDiff && mcOutbreakSetDiff(s.difficulty, s.topic);
      Game.mode = 'class'; Game.state = 'wait';
      players.clear(); const me = Z.newPlayer(name, 'H', { me:true, look:window.Brick && MC.user ? Brick.lookOf(MC.user) : null });
      me.x = (Z.room('lobby').x + 5) * CONFIG.T; me.y = (Z.room('lobby').y + 7) * CONFIG.T;
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
      const me = Z.me;
      return { score:survived() ? 1 : 0, correct:Game.stats.correct, answered:Game.stats.answered,
               status:me ? (me.team === 'Z' ? 'Zombie' : 'Human') + (me.duel ? ' · maths race' : '') : '', finished:reported };
    },
    onEnded(){ inClass = false; Duel.close(); },
  });
  MC.onUser && MC.onUser(u => { if(u && !inClass) name = u.username; });
})();
