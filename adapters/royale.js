/* Battle Tank Royale <-> Mathcade online
   Per battle: knockouts × 50 + players beaten × 10 + 200 for a win. Variant = tanks in the battle.

   Solo play (from the games page): the game as it is, against practice tanks.

   Class game: ONE live battle for the whole class, every student for themselves.
   - The arena has exactly one lane per student (the roster of the battle); no computer tanks.
   - Each iPad is in charge of its own tank: it sends where the tank is, its heading and turret, fuel, shells,
     whether it is still in, who knocked it out, and the shells it fired (4 times a second, MC.live).
   - The teacher's screen relays everyone's tanks back as one snapshot (4 times a second) and runs the referee
     (adapters/royale-referee.js): roster and lane order, phase times on the server clock, knockouts, the trophy
     claim and the winner, then the next battle after a short break.
   - Shells: the shooter announces each shot (where, which way, when); every iPad flies it. Only the iPad of the
     tank it hits decides the hit (checking where it was when the shooter saw it), so knockouts and credit agree.
   - Camera: the supply phase starts zoomed right out with every student's name; each correct answer moves the
     camera a step closer to the student's own lane; at GO it is the follow view, the lane pointing up the screen.
   Class score = the sum of the student's battle points. */
(function(){
  const $ = id => document.getElementById(id);
  const JOIN = (new URLSearchParams(location.search).get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let battle = { correct:0, answered:0, start:performance.now(), reported:false };
  const total = { points:0, correct:0, answered:0, battles:0 };
  let inClass = false, attached = false, lastLine = '';

  // count maths answers for this battle (the game's answer() has no counters)
  const origAnswer = answer;
  answer = function(i){
    if(!(qLocked || !Q || phase === 'countdown' || !you().alive)){ battle.answered++; if(i === Q.correctIndex) battle.correct++; }
    return origAnswer.apply(this, arguments);
  };

  /* ===================== live class battle ===================== */
  const DELAY = 400, SEND_MS = 250, TAU2 = Math.PI * 2;
  const NET = { conn:null, connecting:false, failed:false, g:null, lastP:null, snapAt:0, battle:0, endedB:0, myName:null, spectator:false,
                idx:-1, roster:[], byName:new Map(), koSeen:new Set(), shots:[], shotId:0, myKO:'', allowRC:false, allowRestart:false, sendT:0, uiT:0 };
  const active = () => inClass && attached;
  const serverNow = () => Date.now() + ((MC.session && MC.session.offset) || 0);
  const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  // positions are shared relative to the arena centre, in the frame where lane i of the roster is laneAngle(i)
  function toShared(x, y, out){ const c = Math.cos(-ROT), s = Math.sin(-ROT), dx = x - CX, dy = y - CY; out[0] = dx * c - dy * s; out[1] = dx * s + dy * c; return out; }
  function toLocal(x, y, out){ const c = Math.cos(ROT), s = Math.sin(ROT); out[0] = CX + x * c - y * s; out[1] = CY + x * s + y * c; return out; }
  const P2 = [0, 0], TMP = { x:0, y:0, a:0, turret:0 };

  // small fixed rings of timed positions (no allocations while playing)
  function ring(n){ return { n:0, h:0, size:n, t:new Float64Array(n), x:new Float32Array(n), y:new Float32Array(n), a:new Float32Array(n), u:new Float32Array(n) }; }
  function push(R, t, x, y, a, u){ const i = R.h; R.t[i] = t; R.x[i] = x; R.y[i] = y; R.a[i] = a; R.u[i] = u; R.h = (i + 1) % R.size; if(R.n < R.size) R.n++; }
  const angLerp = (a, b, k) => a + ((((b - a) % TAU2) + TAU2 * 1.5) % TAU2 - Math.PI) * k;
  function sample(R, T, out){
    if(!R.n) return false;
    const at = k => (R.h - 1 - k + R.size * 2) % R.size;      // k = 0 is the newest
    let i0 = at(0);
    if(T >= R.t[i0]){                                           // newer than anything we have: carry on a little
      if(R.n > 1){ const i1 = at(1), span = R.t[i0] - R.t[i1], e = Math.min(250, T - R.t[i0]);
        if(span > 0 && span < 1500){ const k = e / span; out.x = R.x[i0] + (R.x[i0] - R.x[i1]) * k; out.y = R.y[i0] + (R.y[i0] - R.y[i1]) * k; out.a = R.a[i0]; out.turret = R.u[i0]; return true; } }
      out.x = R.x[i0]; out.y = R.y[i0]; out.a = R.a[i0]; out.turret = R.u[i0]; return true;
    }
    for(let k = 1; k < R.n; k++){
      const i = at(k);
      if(R.t[i] <= T){ const span = R.t[i0] - R.t[i], f = span > 0 ? (T - R.t[i]) / span : 1;
        out.x = R.x[i] + (R.x[i0] - R.x[i]) * f; out.y = R.y[i] + (R.y[i0] - R.y[i]) * f;
        out.a = angLerp(R.a[i], R.a[i0], f); out.turret = angLerp(R.u[i], R.u[i0], f); return true; }
      i0 = i;
    }
    out.x = R.x[i0]; out.y = R.y[i0]; out.a = R.a[i0]; out.turret = R.u[i0]; return true;   // older than everything
  }
  const HIST = ring(64);       // where this player's own tank was (for checking hits the way the shooter saw them)
  function myPosAt(T, out){ const me = you(); if(!sample(HIST, T, out)){ out.x = me.x; out.y = me.y; } return out; }

  /* ---------- messages ---------- */
  function sendState(){
    if(!NET.conn || !active() || !NET.myName) return;
    const st = { n:NET.myName, b:NET.battle, ts:Math.round(serverNow()) }, me = you();
    if(!NET.battle || NET.spectator || !me || me.spectator) st.sp = 1;
    else {
      toShared(me.x, me.y, P2); st.x = Math.round(P2[0]); st.y = Math.round(P2[1]); st.a = r2(me.a - ROT); st.u = r2(me.turret - ROT);
      st.al = me.alive ? 1 : 0; if(!me.alive) st.by = NET.myKO || ''; st.f = r1(me.fuel); st.s = me.shells;
      const now = serverNow(); if(NET.shots.length && now - NET.shots[0][4] > 2000) NET.shots = NET.shots.filter(s => now - s[4] < 2000);
      if(NET.shots.length) st.z = NET.shots;       // recent shots ride along until everyone has surely seen them
    }
    NET.conn.send(st);
  }
  function onSnap(snap){
    if(!snap) return;
    NET.snapAt = Date.now();
    if(snap.g) NET.g = snap.g;
    if(Array.isArray(snap.p)) NET.lastP = snap.p;
    if(!active()) return;
    handleG();
    if(NET.battle && Array.isArray(snap.p)) applyStates(snap.p);
  }
  function handleG(){
    const g = NET.g; if(!g || !g.b || !Array.isArray(g.r)) return;
    if(g.b !== NET.battle) startBattle(g);
    let changed = false;
    for(const k of g.ko || []){
      if(NET.koSeen.has(k[0])) continue; NET.koSeen.add(k[0]); changed = true;
      const t = NET.byName.get(k[0]); if(!t || !t.alive) continue;
      if(t.you) eliminate(t, NET.byName.get(k[1]) || null);   // the referee counted this iPad out (it went quiet)
      else netKO(t);
    }
    if(changed){ for(const t of tanks) t.kills = 0; for(const k of g.ko || []){ const by = NET.byName.get(k[1]); if(by) by.kills++; } }
    if(g.e && g.w != null && NET.endedB !== g.b) finishBattle(g);
  }
  function applyStates(list){
    for(const st of list){
      if(!st || st.n === NET.myName || st.b !== NET.battle || st.sp) continue;
      const t = NET.byName.get(st.n); if(!t || t.you || !t.R) continue;
      if(st.ts > t.lastTs){
        t.lastTs = st.ts; toLocal(+st.x || 0, +st.y || 0, P2);
        push(t.R, st.ts, P2[0], P2[1], (+st.a || 0) + ROT, (+st.u || 0) + ROT);
      }
      if(Array.isArray(st.z)) for(const sh of st.z) if(sh[0] > t.lastShot){ t.lastShot = sh[0]; spawnShot(t, sh); }
    }
  }
  function netKO(t){
    t.alive = false; t.diedAt = Math.round((1 - (Math.hypot(t.x - CX, t.y - CY) - innerR) / LANE_LEN) * 100);
    booms.push({ x:t.x, y:t.y, t:0, big:true }); booms.push({ x:t.x + 12, y:t.y - 10, t:-0.12, big:true });
    $('alive').textContent = aliveCount();
    if(claim && claim.tank === t) claim = null;
  }

  /* ---------- shells ---------- */
  function bulletHitsWorld(b){ return walls.some(s => segDist(b.x, b.y, s) < WALL_T / 2) || obstacles.some(o => Math.hypot(b.x - o.x, b.y - o.y) < o.r) || Math.hypot(b.x - CX, b.y - CY) > outerR; }
  function hitsMe(b, T){
    const me = you(); if(!me.alive || me.spectator || phase !== 'play' || b.from === me) return false;
    myPosAt(T - b.L, TMP); return Math.hypot(TMP.x - b.x, TMP.y - b.y) < 20;
  }
  function spawnShot(t, sh){
    const [, sx, sy, sa, st, L] = sh;
    let age = (serverNow() - st) / 1000; if(age > 1.1 || !t.alive && age > 0.6) return; age = Math.max(0, age);
    toLocal(+sx, +sy, P2);
    const b = { x:P2[0], y:P2[1], a:(+sa || 0) + ROT, life:1.1, from:t, trail:[], L:Math.max(0, Math.min(800, +L || DELAY)) };
    if(age < 0.15) booms.push({ x:b.x + Math.cos(b.a) * 8, y:b.y + Math.sin(b.a) * 8, t:0, flash:b.a });
    // catch the shell up to now, checking the walls and this player's tank on the way
    const h = 6 / 520, cs = Math.cos(b.a) * 6, sn = Math.sin(b.a) * 6;
    for(let tt = 0; tt < age && !b.dead; tt += h){
      b.x += cs; b.y += sn;
      if(bulletHitsWorld(b)){ b.dead = true; booms.push({ x:b.x, y:b.y, t:0 }); }
      else if(hitsMe(b, st + tt * 1000)){ b.dead = true; booms.push({ x:b.x, y:b.y, t:0 }); eliminate(you(), t); }
    }
    b.life -= age;
    if(!b.dead && b.life > 0) bullets.push(b);
  }
  const origBulletTarget = bulletTarget;
  bulletTarget = function(b){
    if(!active()) return origBulletTarget.apply(this, arguments);
    const now = serverNow();
    for(let i = 0; i < tanks.length; i++){
      const o = tanks[i]; if(o === b.from || !o.alive || o.spectator) continue;
      if(o.you){ if(b.L != null && hitsMe(b, now)) return o; continue; }
      if(Math.hypot(o.x - b.x, o.y - b.y) < 20) return o;        // a classmate's tank: just the explosion here, their iPad decides
    }
    return undefined;
  };
  const origFire = fire;
  fire = function(t){
    const n = bullets.length, out = origFire.apply(this, arguments);
    if(active() && t && t.you && !t.spectator && bullets.length > n){
      const b = bullets[bullets.length - 1]; toShared(b.x, b.y, P2);
      NET.shots.push([++NET.shotId, Math.round(P2[0]), Math.round(P2[1]), r2(b.a - ROT), Math.round(serverNow()), DELAY]);
      sendState();
    }
    return out;
  };

  /* ---------- the game's own rules, in a class battle ---------- */
  const origEliminate = eliminate;
  eliminate = function(t, by){
    if(!active()) return origEliminate.apply(this, arguments);
    if(!t || !t.you || t.spectator || !t.alive) return;            // only this iPad's own tank is knocked out here
    NET.myKO = (by && by.name) || '';
    const out = origEliminate.call(this, t, by);
    sendState();
    return out;
  };
  const origRoundComplete = roundComplete;
  roundComplete = function(){ if(active() && !NET.allowRC) return; return origRoundComplete.apply(this, arguments); };
  const origMakeTanks = makeTanks;
  makeTanks = function(){
    if(!active() || !NET.allowRestart) return origMakeTanks.apply(this, arguments);
    tanks = []; NET.byName = new Map();
    const r = NET.roster, n = r.length, m = Math.max(0, NET.idx);
    if(NET.spectator) tanks.push({ you:true, spectator:true, alive:false, lane:0, x:CX, y:CY, a:0, turret:0, fuel:0, shells:0, col:'blue', kills:0 });
    for(let j = 0; j < n; j++){
      const c = (j + m) % n, me = !NET.spectator && j === 0, p = lanePoint(j, 70, 0), inward = laneAngle(j) + Math.PI;
      const t = { name:r[c], lane:j, you:me, remote:!me, col:me ? 'blue' : COLOURS[c % 4], x:p.x, y:p.y, a:inward, turret:inward, alive:true,
                  fuel:START_FUEL, shells:START_SHELLS, kills:0, cd:0, pause:0, look:0, flash:0, speed:0 };
      if(!me){ t.R = ring(16); t.lastTs = 0; t.lastShot = 0; t.stale = true; }
      tanks.push(t); NET.byName.set(t.name, t);
    }
  };
  const origBotStep = botStep;
  botStep = function(t){ if(t.remote) return; return origBotStep.apply(this, arguments); };   // classmates drive themselves
  const origDrawTank = drawTank;
  drawTank = function(t){ if(t.stale){ ctx.globalAlpha = 0.45; origDrawTank(t); ctx.globalAlpha = 1; return; } return origDrawTank(t); };

  // a new battle starts: reset the per-battle counters; in a class game only the shared battle can restart
  const origRestart = restart;
  restart = function(n){
    if(active() && !NET.allowRestart) return;
    battle = { correct:0, answered:0, start:performance.now(), reported:false };
    return origRestart.call(this, n);
  };

  function startBattle(g){
    NET.battle = g.b; NET.endedB = 0; NET.koSeen = new Set(); NET.shots = []; NET.shotId = 0; NET.myKO = '';
    NET.roster = g.r.slice(); NET.idx = NET.roster.indexOf(NET.myName); NET.spectator = NET.idx < 0;
    const n = Math.max(1, NET.roster.length);
    ROT = -Math.max(0, NET.idx) * TAU / n;
    NET.allowRestart = true; try{ restart(n); } finally { NET.allowRestart = false; }
    HIST.n = 0; HIST.h = 0;
    SETUP_OPEN = false; last = 0;
    $('setup').classList.add('hidden');
    if(NET.spectator){ $('supply').classList.remove('show'); $('qtab').classList.remove('show'); battle.reported = true; }
    else {
      // back after a reload: carry on from where this tank was
      const mine = (NET.lastP || []).find(p => p && p.n === NET.myName && p.b === g.b && !p.sp && p.x != null);
      if(mine){ const me = you(); toLocal(mine.x, mine.y, P2); me.x = P2[0]; me.y = P2[1]; me.a = (+mine.a || 0) + ROT; me.turret = (+mine.u || 0) + ROT;
        if(mine.f != null) me.fuel = +mine.f; if(mine.s != null) me.shells = +mine.s; updateSupplies(); }
      if(g.e) battle.reported = true;                         // it had already finished: nothing to report from here
    }
    const t = camTarget(); cam = { ...t };
    uiTick();
  }
  function finishBattle(g){
    NET.endedB = g.b;
    const W = g.w ? NET.byName.get(g.w) || null : null;
    if(!NET.spectator && !over){
      if(W && W.you) endGame(true, null, g.how === 'trophy' ? 'trophy' : 'last');
      else if(W && g.how === 'trophy') endGame(false, W, 'trophy');
      else endGame(false, W, 'none');
    }
    reportBattle(g);
    claim = null; contested = false;
    NET.allowRC = true; try{ roundComplete(W, g.how === 'trophy' ? 'trophy' : 'last'); } finally { NET.allowRC = false; }
    uiTick();
  }
  function reportBattle(g){
    if(battle.reported || NET.spectator) return; battle.reported = true;
    const me = NET.myName, ko = g.ko || [], n = g.r.length;
    let kills = 0, myKO = -1; ko.forEach((k, i) => { if(k[1] === me) kills++; if(k[0] === me) myKO = i; });
    const won = g.w === me, beaten = won ? n - 1 : myKO >= 0 ? myKO : ko.length, placement = won ? 1 : myKO >= 0 ? n - myKO : 2;
    const pts = kills * 50 + Math.max(0, beaten) * 10 + (won ? 200 : 0);
    total.points += pts; total.correct += battle.correct; total.answered += battle.answered; total.battles++; saveTotal();
    lastLine = `+${pts} class points this battle · ${total.points} in total`;
    const o = $('oText'); if(o && !o.querySelector('.mc-royale-pts')) o.insertAdjacentHTML('beforeend', `<br><b class="mc-royale-pts">${lastLine}</b>`);
    const p = MC.result({ score:pts, correct:battle.correct, answered:battle.answered, seconds:(performance.now() - battle.start) / 1000, variant:n + ' players',
                          details:{ knockouts:kills, beaten:Math.max(0, beaten), placement, won, how:won ? g.how : myKO >= 0 ? 'eliminated' : g.how, battle:g.b, live:true } });
    putTotalBack(p);
  }
  // the save sets this battle's points as the class score; put the running total straight back
  function putTotalBack(p){
    if(attached && p && p.then) p.then(() => {
      const S = MC.session; if(!S || S.status === 'ended' || !attached) return;
      const st = liveState();
      MC.authed('mc_session_update', { p_code:S.code, p_score:st.score, p_correct:st.correct, p_answered:st.answered, p_status_text:st.status, p_finished:false }).catch(() => {});
    });
  }
  // the running total survives a reload of the page (iPads reload tabs)
  const totalKey = () => 'mc_royale_total_' + JOIN + '_' + (NET.myName || '');
  function saveTotal(){ try{ sessionStorage.setItem(totalKey(), JSON.stringify(total)); }catch(e){} }
  function loadTotal(){ try{ const v = JSON.parse(sessionStorage.getItem(totalKey())); if(v && typeof v.points === 'number') Object.assign(total, v); }catch(e){} }

  // supply timer and countdown follow the server clock, so every iPad changes phase together
  const origStep = step;
  step = function(dt){
    if(active() && NET.battle && NET.g && NET.g.b === NET.battle){
      const now = serverNow(), g = NET.g;
      if(phase === 'supply') phaseT = (g.go - COUNTDOWN * 1000 - now) / 1000 + dt;
      else if(phase === 'countdown') phaseT = (g.go - now) / 1000 + dt;
    }
    origStep(dt);
    if(active() && NET.battle) netFrame();
  };
  function netFrame(){
    const now = serverNow(), me = you();
    if(me.alive && !me.spectator) push(HIST, now, me.x, me.y, me.a, me.turret);
    if(NET.spectator && mode === 'drive') setMode('over');
    const T = now - MC.live.delay(DELAY, NET.conn);   // further behind when snapshots come less often (big classes)
    for(let i = 0; i < tanks.length; i++){
      const t = tanks[i]; if(!t.remote) continue;
      t.stale = !t.lastTs || now - t.lastTs > 5000;
      if(t.alive && sample(t.R, T, TMP)){ t.x = TMP.x; t.y = TMP.y; t.a = TMP.a; t.turret = TMP.turret; }
    }
  }
  // the trophy claim comes from the referee
  function netClaim(){
    const g = NET.g; if(!g || g.b !== NET.battle || g.e){ claim = null; contested = false; return; }
    contested = !!g.cx;
    const t = g.c && NET.byName.get(g.c[0]);
    if(t && t.alive){
      if(!claim || claim.tank !== t){ claim = { tank:t, t:0 }; if(t.you) banner('Hold the trophy for 8 seconds!'); }
      claim.t = Math.min(CLAIM_SECS, g.c[1] + (contested ? 0 : Math.max(0, Math.min(0.5, (serverNow() - g.now) / 1000))));
    } else claim = null;
  }

  /* ---------- camera: zoomed right out at the start, a step closer to your lane with each correct answer ---------- */
  const origCamTarget = camTarget;
  camTarget = function(){
    const o = origCamTarget();
    if(!active() || !NET.battle || mode !== 'over') return o;
    // whole arena with a margin for the ring of names round it, in the space the supply panel leaves free
    // (beside it in landscape, above it in portrait)
    const sup = phase === 'supply' && $('supply').classList.contains('show');
    const side = sup && vw > vh ? Math.min(470, vw - 24) + 24 : 0, top = 96;
    const bottom = sup && vw <= vh && panelTop > top + 160 ? vh - panelTop + 8 : 64;
    const fx = -side / 2, fy = (top - bottom) / 2;                // middle of the free space, from the middle of the screen
    o.z = Math.min(vw - 16 - side, vh - top - bottom) / (2 * outerR + 80) * (N > 24 ? 0.8 : 0.86); o.x = CX - fx / o.z; o.y = CY - fy / o.z;
    if(phase !== 'supply' || NET.spectator) return o;
    const me = you(), k = Math.min(0.92, 1 - Math.pow(0.86, battle.correct));   // ~half way after 5 correct answers
    if(k <= 0 || !me) return o;
    const zd = Math.max(0.55, Math.min(1.1, Math.min(vw, vh) / 700)), z = o.z * Math.pow(zd / o.z, k);
    // where your tank sits on the screen moves from its place in the whole-arena view to just below the middle of the free space
    const sx = ((me.x - o.x) * o.z) * (1 - k) + fx * k, sy = ((me.y - o.y) * o.z) * (1 - k) + (fy + (vh - top - bottom) * 0.15) * k;
    return { x:me.x - sx / z, y:me.y - sy / z, z };
  };

  /* ---------- names over the tanks (each label is drawn once, then reused) ---------- */
  const LABELS = new Map();
  function label(name, mine){
    const key = (mine ? '1' : '0') + name; let L = LABELS.get(key); if(L) return L;
    const d = Math.min(2, devicePixelRatio || 1), fs = 13, txt = name.length > 14 ? name.slice(0, 13) + '…' : name;
    const c = document.createElement('canvas'), g = c.getContext('2d'), font = `900 ${fs * d}px Nunito,ui-rounded,system-ui,sans-serif`;
    g.font = font; const w = Math.ceil(g.measureText(txt).width + 10 * d), h = Math.ceil((fs + 8) * d);
    c.width = w; c.height = h; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 4 * d; g.strokeStyle = 'rgba(18,26,34,.9)'; g.fillStyle = mine ? '#FFD45A' : '#fff';
    g.strokeText(txt, w / 2, h / 2); g.fillText(txt, w / 2, h / 2);
    L = { c, w:w / d, h:h / d }; if(LABELS.size > 200) LABELS.clear(); LABELS.set(key, L); return L;
  }
  function drawNames(){
    if(!active() || !NET.battle) return;
    // zoomed right out the names sit just outside each tank, pointing away from the trophy, so they fan out in a ring
    // (alternate lanes a step further out); close up they sit above the tanks
    const z = cam.z, hw = vw / 2 / z + 80, hh = vh / 2 / z + 80, far = z < 0.4;
    for(let i = tanks.length - 1; i >= 0; i--){                 // your own name (tanks[0]) last, on top
      const t = tanks[i]; if(!t.alive || !t.name) continue;
      if(t.you && z > 0.5) continue;                              // close up, your tank already says YOU
      if(Math.abs(t.x - cam.x) > hw || Math.abs(t.y - cam.y) > hh) continue;
      const L = label(t.name, t.you), w = L.w / z, h = L.h / z;
      if(t.stale) ctx.globalAlpha = 0.5;
      if(far){
        const dx = t.x - CX, dy = t.y - CY, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
        const off = 22 + 3 / z + (Math.abs(ux) * w + Math.abs(uy) * h) / 2 + (N > 12 && t.lane % 2 ? Math.abs(uy) * (h + 2 / z) : 0);
        ctx.drawImage(L.c, t.x + ux * off - w / 2, t.y + uy * off - h / 2, w, h);
      } else ctx.drawImage(L.c, t.x - w / 2, t.y - 24 - h - 2 / z, w, h);
      if(t.stale) ctx.globalAlpha = 1;
    }
  }

  /* ---------- messages on screen ---------- */
  function waitBox(html){
    let el = $('mcRoyWait');
    if(!html){ if(el) el.remove(); return; }
    if(!el){ el = document.createElement('div'); el.id = 'mcRoyWait'; el.className = 'mc-ui'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;inset:0;z-index:58;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,14,24,.6);font-family:Nunito,ui-rounded,system-ui,sans-serif';
      document.body.appendChild(el); }
    if(el.dataset.h !== html){ el.dataset.h = html;
      el.innerHTML = `<div style="max-width:440px;background:#1B2232;color:#fff;border:3px solid #22303A;border-radius:22px;padding:22px 24px;text-align:center;box-shadow:0 10px 0 rgba(0,0,0,.35)">${html}</div>`; }
  }
  function pill(text){
    let el = $('mcRoyPill');
    if(!text){ if(el) el.style.display = 'none'; return; }
    if(!el){ el = document.createElement('div'); el.id = 'mcRoyPill'; el.className = 'mc-ui'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top,0px));z-index:70;font:900 15px Nunito,ui-rounded,system-ui,sans-serif;color:#fff;background:rgba(19,30,48,.9);border:2px solid #FFC23D;border-radius:999px;padding:7px 16px;pointer-events:none;white-space:nowrap';
      document.body.appendChild(el); }
    el.style.display = ''; if(el.textContent !== text) el.textContent = text;
  }
  const H2 = 'style="margin:0 0 8px;font-family:\'Lilita One\',system-ui,sans-serif;font-weight:400;font-size:1.6rem;color:#FFC23D"';
  let panelTop = 0;
  function uiTick(){
    if(!active()) { waitBox(null); pill(null); return; }
    const sp = $('supply'); panelTop = sp && sp.classList.contains('show') ? sp.getBoundingClientRect().top : 0;
    if(!NET.battle){
      waitBox(NET.failed ? `<h2 ${H2}>Waiting for your teacher’s screen…</h2><p style="margin:0;font-weight:800">The live battle can’t connect from this iPad right now. It keeps trying by itself: keep this page open.</p>`
        : !NET.conn ? `<h2 ${H2}>Connecting to the class battle…</h2>`
        : `<h2 ${H2}>Waiting for your teacher’s screen…</h2><p style="margin:0;font-weight:800">The battle starts when your teacher’s Mathcade screen is open. Keep this page open.</p>`);
      pill(null); return;
    }
    waitBox(null);
    const g = NET.g, now = serverNow();
    if(Date.now() - NET.snapAt > 6000) pill('Lost touch with your teacher’s screen: reconnecting…');
    else if(g && g.b === NET.battle && g.e && now < g.nx) pill(`Next battle in ${Math.max(1, Math.ceil((g.nx - now) / 1000))} s`);
    else if(NET.spectator) pill('You joined during this battle: watching. You’re in the next one!');
    else pill(null);
  }

  async function connect(){
    if(NET.conn || NET.connecting) return; NET.connecting = true; uiTick();
    let late = false;
    const pr = MC.live.player(JOIN, onSnap, () => {});
    pr.then(c => { if(late) c.close(); }, () => {});
    try{
      NET.conn = await Promise.race([pr, new Promise((_, rej) => setTimeout(() => { late = true; rej(new Error('timeout')); }, 10000))]);
      NET.failed = false;
      if(!NET.sendT) NET.sendT = setInterval(sendState, SEND_MS);
    }catch(e){ console.warn('Live battle unavailable', e); NET.failed = true; NET.conn = null; setTimeout(connect, 8000); }
    NET.connecting = false; uiTick();
  }
  window.mcRoyaleNet = () => ({ battle:NET.battle, spectator:NET.spectator, roster:NET.roster.slice(), me:NET.myName, connected:!!NET.conn, failed:NET.failed,
    g:NET.g ? { b:NET.g.b, w:NET.g.w, how:NET.g.how, e:NET.g.e, nx:NET.g.nx, go:NET.g.go, ko:NET.g.ko } : null, now:serverNow() });
  window.mcRoyaleFeed = snap => onSnap(snap);   // tests: play a snapshot as if it came from the teacher's screen
  if(JOIN && MC.live && MC.live.supported && MC.live.supported('royale') && MC.configured()) connect();

  /* ---------- reporting ---------- */
  function liveState(){
    const me = you(), k = (me && me.kills) || 0;
    if(active()){
      const inBattle = NET.battle && NET.endedB !== NET.battle && !NET.spectator;
      return { score:total.points, correct:total.correct + (inBattle ? battle.correct : 0), answered:total.answered + (inBattle ? battle.answered : 0),
               status:!NET.battle ? 'Waiting for the battle' : NET.spectator ? `Watching battle ${NET.battle}`
                 : inBattle ? `Battle ${NET.battle} · ${k} KO${k === 1 ? '' : 's'}${me.alive ? '' : ' · out'}`
                 : `${total.battles} battle${total.battles === 1 ? '' : 's'} · ${total.points} pts`, finished:false };
    }
    const inBattle = !over, nb = total.battles + (inBattle ? 1 : 0);
    return { score:total.points, correct:total.correct + (inBattle ? battle.correct : 0), answered:total.answered + (inBattle ? battle.answered : 0),
             status:inBattle ? `Battle ${nb} · ${k} KO${k === 1 ? '' : 's'}` : `${total.battles} battle${total.battles === 1 ? '' : 's'} · ${total.points} pts`, finished:false };
  }

  // the battle is over for this student (knocked out, trophy lost, or won)
  const origEndGame = endGame;
  endGame = function(won, by, how){
    const first = !over;
    if(active()){
      if(how === 'none' && !won){ const out = origEndGame.call(this, false, null, 'eliminated');
        if(first && you().alive){ $('oTitle').textContent = 'Battle over'; $('oText').textContent = 'No tank claimed the trophy this time.'; } return out; }
      const out = origEndGame.apply(this, arguments);
      if(first && !won && how !== 'trophy' && by && by.name) $('oText').textContent = `Knocked out by ${by.name}. ` + $('oText').textContent + ' Keep watching: the next battle starts by itself.';
      return out;
    }
    const out = origEndGame.apply(this, arguments);
    if(first && !battle.reported){
      battle.reported = true;
      const me = you(), kills = me.kills || 0, alive = aliveCount();
      const beaten = won ? N - 1 : me.alive ? N - alive : N - alive - 1;     // tanks knocked out before you
      const placement = won ? 1 : me.alive ? 2 : alive + 1;
      const pts = kills * 50 + Math.max(0, beaten) * 10 + (won ? 200 : 0);
      MC.result({ score:pts, correct:battle.correct, answered:battle.answered, seconds:(performance.now() - battle.start) / 1000,
                  variant:N + ' players', details:{ knockouts:kills, beaten:Math.max(0, beaten), placement, won:!!won, how:how || (won ? 'last' : 'eliminated') } });
    }
    return out;
  };

  // end-of-battle board: usernames instead of "You"; in a class battle no "Play again" (the next battle starts by itself)
  const origLB = window.showLeaderboard;
  window.showLeaderboard = function(cfg){
    const name = (active() && NET.myName) || (MC.user && MC.user.username);
    if(name && cfg){
      (cfg.entries || []).forEach(e => { if(e && e.you) e.name = name; });
      if(cfg.subtitle) cfg.subtitle = cfg.subtitle.replace(/^You /, name + ' ');
    }
    if(active() && cfg){
      cfg.actions = (cfg.actions || []).filter(a => !/again/i.test(a.label || ''));
      cfg.note = (lastLine ? lastLine + ' (knockouts × 50 + tanks beaten × 10 + 200 for a win). ' : '') + 'The next battle starts by itself.';
    }
    return origLB.apply(this, arguments);
  };

  MC.register({
    game:'royale',
    keepLive:true,
    start(ctx){
      inClass = true; attached = true;
      NET.myName = ctx.username || (MC.user && MC.user.username) || NET.myName;
      loadTotal();
      const s = ctx.settings || {};
      if(['easy','medium','hard'].includes(s.difficulty)){
        MATHS_DIFF = s.difficulty;
        document.querySelectorAll('#mdiff button').forEach(b => { const on = b.dataset.v === s.difficulty; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      }
      const ts = $('setupTopic'), live = $('topic');
      if(live && !ts.options.length) ts.innerHTML = live.innerHTML;
      ts.value = s.topic && [...ts.options].some(o => o.value === s.topic) ? s.topic : 'mixed';
      topicId = ts.value; if(live){ live.value = ts.value; }
      try{ renderTiers(); }catch(e){}
      // one lane per student: no tank-count menu, no preview skip, no solo "Play again"
      const c = $('count'); if(c){ c.disabled = true; const chip = c.closest('.chip'); if(chip) chip.style.display = 'none'; }
      ['skip', 'again'].forEach(id => { const el = $(id); if(el) el.style.display = 'none'; });
      $('setup').classList.add('hidden');            // the shared battle starts when the referee's roster arrives
      document.querySelectorAll('.lb-ov').forEach(x => x.remove()); $('over').classList.remove('show'); $('supply').classList.remove('show');
      setMode('over');
      if(!NET.battle){ tanks = tanks.slice(0, 1); $('alive').textContent = '\u2013'; }   // no practice tanks behind the waiting card
      NET_CLAIM = netClaim; FRAME_HOOK = drawNames;
      if(!NET.uiT) NET.uiT = setInterval(uiTick, 250);
      if(!NET.conn && !NET.connecting && JOIN) connect();
      handleG();
      if(NET.battle && NET.lastP) applyStates(NET.lastP);
      uiTick();
    },
    live:liveState,
    onEnded(){
      // the class game is over: battles from now on are ordinary solo battles
      attached = false; inClass = false;
      MC.leaveSession();
      NET_CLAIM = null; FRAME_HOOK = null; ROT = 0;
      clearInterval(NET.sendT); NET.sendT = 0; clearInterval(NET.uiT); NET.uiT = 0;
      if(NET.conn) try{ NET.conn.close(); }catch(e){}
      NET.conn = null; waitBox(null); pill(null);
      const c = $('count'); if(c){ c.disabled = false; const chip = c.closest('.chip'); if(chip) chip.style.display = ''; }
      ['skip', 'again'].forEach(id => { const el = $(id); if(el) el.style.display = ''; });
    },
  });
})();
