/* Dig Deep <-> Mathcade online (base class version, 21 Oct 2026).
   Practice (no class code): the game runs on its own; the result is saved when time is up.
   Class game: everyone digs the same map (the class code is the map seed) with the teacher's time, topic and
   difficulty. Each iPad keeps its own rocks, backpack and bank; classmates walk round the same world (their Brick,
   colour, hat and pickaxe), sent ~5 times a second through the teacher's screen and drawn 300 ms behind, smoothed.
   The score is the money banked (unbanked ore doesn't count). Mining money never becomes coins: coins come from
   right answers, like every Mathcade game. Not yet: shared rocks (two students can mine the same rock) and
   rejoining with banked money (planned with the game server, HANDOVER A7.2). */
(function(){
  const D = window.DigDeep; if(!D) return;
  const JOIN = (window.MC && MC.classCode && MC.classCode()) || null;
  const DELAY = 300, SEND_MS = 200;
  let inClass = false, saved = false, conn = null, snapOff = null, name = MC.user ? MC.user.username : null, started = 0;
  const remotes = new Map();   // name -> { buf:[{t,x,y,f,w,s,k}], look, seen }
  const $ = s => document.querySelector(s);

  /* the student's Brick: colour from their locker, and their hat (site/brick/hat/*.svg, the same 240 grid) */
  const hats = new Map();
  function hatImg(id){ if(!id) return null; let im = hats.get(id); if(!im){ im = new Image(); im.src = ((window.Brick && Brick.root) || 'brick/') + 'hat/' + id + '.svg'; hats.set(id, im); } return im; }
  function lookFrom(L){
    if(!window.Brick || !L) return null; L = Brick.normalize(L);
    const b = (Brick.CATALOGUE.bases || []).find(x => x.id === L.base) || {};
    return { main:b.main || '#F26B3A', shadow:b.shadow || '#C4481D', hat:hatImg(L.hat), key:Brick.lookKey(L) };
  }
  function lookFromKey(k){ if(typeof k !== 'string' || !window.Brick) return null; const [base, hat, shoes] = k.split('|'); return lookFrom({ base, hat, shoes }); }
  function myLook(){ return window.Brick && MC.user ? lookFrom(Brick.lookOf(MC.user)) : null; }

  /* ---------- the result: banked money ---------- */
  D.hooks.onEnd = function(r){
    if(saved) return; saved = true;
    const secs = Math.round((performance.now() - started) / 1000);
    MC.result({ score:Math.round(r.banked), correct:r.correct, answered:r.answered, seconds:secs, variant:Math.max(1, Math.round(secs / 60)) + ' min',
                details:{ totals:r.details.totals, items:D.player && D.player.items, pickaxe:D.player && D.player.pickaxeTier } });
    if(inClass){ inClass = false; MC.leaveSession && MC.leaveSession(); }
  };
  D.hooks.onStart = function(){ started = performance.now(); if(!inClass) saved = false; };

  /* ---------- classmates ---------- */
  function myState(){
    const p = D.pos; if(!p || D.phase === 'title') return null;
    return { n:name, x:Math.round(p.x * 100) / 100, y:Math.round(p.y * 100) / 100, f:p.facing || 1, w:p.walking ? 1 : 0, s:p.swingT != null ? 1 : 0,
             k:D.player ? D.player.pickaxeTier : 0, b:(myLook() || {}).key || '', m:D.player ? Math.round(D.player.banked) : 0 };
  }
  function send(){ const s = myState(); if(conn && s) conn.send(s); }
  function onSnap(snap){
    if(!snap) return;
    const now = Date.now(), so = now - snap.t; snapOff = snapOff == null ? so : snapOff + (so - snapOff) * 0.1;
    for(const p of snap.p || []){
      if(!p || !p.n || p.n === name || typeof p.x !== 'number') continue;
      let R = remotes.get(p.n); if(!R){ R = { buf:[] }; remotes.set(p.n, R); }
      R.buf.push({ t:snap.t, x:p.x, y:p.y, f:p.f, w:p.w, s:p.s, k:p.k }); if(R.buf.length > 20) R.buf.shift();
      if(p.b && p.b !== R.lookKey){ R.lookKey = p.b; R.look = lookFromKey(p.b); }
      R.seen = now;
    }
  }
  function posAt(R, t){
    const b = R.buf; if(!b.length) return null; if(t <= b[0].t) return b[0];
    for(let i = b.length - 1; i > 0; i--){ const a = b[i - 1], c = b[i]; if(t >= a.t && t <= c.t){ const k = (t - a.t) / Math.max(1, c.t - a.t); return { x:a.x + (c.x - a.x) * k, y:a.y + (c.y - a.y) * k, f:c.f, w:c.w, s:c.s, k:c.k }; } }
    return b[b.length - 1];
  }
  function stepOthers(){
    if(!conn){ requestAnimationFrame(stepOthers); return; }
    const t = Date.now() - (snapOff || 0) - DELAY, now = Date.now();
    for(const [n, R] of remotes){
      if(now - R.seen > 12000){ D.others.delete(n); continue; }
      const q = posAt(R, t); if(!q) continue;
      let o = D.others.get(n); if(!o){ o = { name:n, swingT:null }; D.others.set(n, o); }
      o.x = q.x; o.y = q.y; o.facing = q.f; o.walking = !!q.w; o.tier = q.k || 0;
      o.swingT = q.s ? ((now / 1000 / ((D.cfg.player && D.cfg.player.swingSeconds) || 0.3)) % 1) : null;
      if(R.look){ o.main = R.look.main; o.shadow = R.look.shadow; o.hat = R.look.hat; }
    }
    requestAnimationFrame(stepOthers);
  }
  async function connect(){
    try{ conn = await MC.live.player(JOIN, onSnap, () => {}); setInterval(send, SEND_MS); requestAnimationFrame(stepOthers); }
    catch(e){ console.warn('Dig Deep live link unavailable', e); }
  }

  if(window.MC && MC.register) MC.register({
    game:'mining',
    keepLive:true,
    start(ctx){
      inClass = true; saved = false; name = ctx.username || name || 'You';
      const s = ctx.settings || {}, S = D.settings;
      S.seed = JOIN || S.seed; S.name = name;
      S.topics = [s.topic || 'mixed']; if(['easy','medium','hard'].includes(s.difficulty)) S.difficulty = s.difficulty;
      S.minutes = Math.max(1, +s.minutes || 10); S.seconds = Math.max(30, Math.round(ctx.remainingSeconds || S.minutes * 60));
      S.look = myLook();
      $('#title').classList.add('hidden'); $('#againbtn').style.display = 'none'; $('#hubback').style.display = 'none'; $('#overhub').style.display = 'none';
      const go = () => { D.start(); if(MC.classBoard) MC.classBoard({ score:() => D.player ? D.player.banked : null, lower:false,
        fmt:v => '$' + Math.round(v).toLocaleString('en-AU'), label:'Class leaderboard', pos:{ top:'96px', right:'12px' } }); };
      if(D.world) go(); else addEventListener('load', go);   // (the page builds the map on load)
      if(!conn && JOIN) connect();
    },
    live(){
      const p = D.player;
      return { score:p ? Math.round(p.banked) : 0, correct:D.log ? D.log.summary().correct : 0,
               answered:D.log ? D.log.summary().answered : 0, status:p ? '$' + Math.round(p.banked).toLocaleString('en-AU') + ' banked' : '', finished:D.phase === 'over' };
    },
    onEnded(){ if(D.phase !== 'over' && D.phase !== 'title' && D.endRound) D.endRound(); inClass = false; },
  });
  MC.onUser && MC.onUser(u => { if(u && !inClass){ name = u.username; D.settings.name = u.username; D.settings.look = myLook(); } });
})();
