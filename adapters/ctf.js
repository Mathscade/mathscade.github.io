/* Battle Tank Capture the Flag <-> Mathcade online
   Solo play (from the games page): the game as it is, against the practice tanks.
   Score = your flag captures × 100 + enemy tanks you destroyed × 25. Variant = round length in minutes.

   Class game: ONE live match for the whole class on the same map, no computer tanks.
   - When the game starts the teacher's screen (adapters/ctf-referee.js) splits everyone at random into two
     even teams, Blue and Red; late joiners go into the smaller team. Teams stay for the whole class game.
   - Each iPad is in charge of its own tank: where it is, heading and turret, whether it has been destroyed and
     by whom (it counts its own deaths), its spawn shield, the shells it fired, and whether it is touching a flag.
     It sends that 4 times a second (MC.live); the teacher's screen sends everyone back one snapshot 4 times a second.
   - Shells: the shooter announces each shot; every iPad flies it; only the iPad of the tank it hits decides the
     hit (checking where it was when the shooter saw it). No friendly fire. Destroyed tanks respawn after 5 s.
   - Flags: the referee decides pickups, carrying, captures, drops and returns, the score and the end of a round
     (3 captures, or the class game's time is up). A new round starts by itself while time is left.
   Class score = captures × 100 + enemy tanks destroyed × 25 + own flags returned × 25, added up over rounds. */
(function(){
  const $ = id => document.getElementById(id);
  const JOIN = (new URLSearchParams(location.search).get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const stats = { correct:0, answered:0 };
  let inClass = false, attached = false, saved = false;

  // count maths answers (the game's answer() has no counters of its own)
  const origAnswer = answer;
  answer = function(i){
    if(!(qLocked || !Q || allFull())){ stats.answered++; if(i === Q.correctIndex) stats.correct++; }
    return origAnswer.apply(this, arguments);
  };

  const me = () => you() || {};
  const points = () => (me().captures || 0) * 100 + (totalKills || 0) * 25;
  const played = () => Math.max(0, ROUND.SECS - roundLeft);
  const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);

  /* ===================== live class match ===================== */
  const DELAY = 400, SEND_MS = 250, TAU2 = Math.PI * 2, SIDE = { B:'grass', R:'sand' }, TEAM = { grass:'Blue', sand:'Red' };
  const NET = { conn:null, connecting:false, failed:false, g:null, lastP:null, snapAt:0, round:0, endedR:0, myName:null, team:null,
                byName:new Map(), shots:[], shotId:0, dn:0, by:'', pk:null, rt:null, evSeen:-1, myK:0, allowEnd:false, sendT:0, uiT:0,
                rc:{ correct:0, answered:0, start:performance.now() }, reportedR:0, minutes:5 };
  const total = { points:0, correct:0, answered:0, rounds:0, kills:0, caps:0 };
  const active = () => inClass && attached;
  const serverNow = () => Date.now() + ((MC.session && MC.session.offset) || 0);
  const r2 = v => Math.round(v * 100) / 100;
  const TMP = { x:0, y:0, a:0, turret:0 };
  function ring(n){ return { n:0, h:0, size:n, t:new Float64Array(n), x:new Float32Array(n), y:new Float32Array(n), a:new Float32Array(n), u:new Float32Array(n) }; }
  function push(R, t, x, y, a, u){ const i = R.h; R.t[i] = t; R.x[i] = x; R.y[i] = y; R.a[i] = a; R.u[i] = u; R.h = (i + 1) % R.size; if(R.n < R.size) R.n++; }
  const angLerp = (a, b, k) => a + ((((b - a) % TAU2) + TAU2 * 1.5) % TAU2 - Math.PI) * k;
  function sample(R, T, out){
    if(!R.n) return false;
    const at = k => (R.h - 1 - k + R.size * 2) % R.size;
    let i0 = at(0);
    if(T >= R.t[i0]){
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
    out.x = R.x[i0]; out.y = R.y[i0]; out.a = R.a[i0]; out.turret = R.u[i0]; return true;
  }
  const HIST = ring(64);
  function myPosAt(T, out){ const m = you(); if(!sample(HIST, T, out)){ out.x = m.x; out.y = m.y; } return out; }

  // what survives a reload of the page: the running total and this tank's death count
  const keepKey = () => 'mc_ctf_keep_' + JOIN + '_' + (NET.myName || '');
  function saveKeep(){ try{ sessionStorage.setItem(keepKey(), JSON.stringify({ total, dn:NET.dn, reportedR:NET.reportedR })); }catch(e){} }
  function loadKeep(){ try{ const v = JSON.parse(sessionStorage.getItem(keepKey())); if(v && v.total){ Object.assign(total, v.total); NET.dn = v.dn | 0; NET.reportedR = v.reportedR | 0; } }catch(e){} }

  /* ---------- messages ---------- */
  function sendState(){
    if(!NET.conn || !active() || !NET.myName) return;
    const t = you(), st = { n:NET.myName, r:NET.round, ts:Math.round(serverNow()) };
    if(NET.round && NET.team && t){
      st.x = Math.round(t.x); st.y = Math.round(t.y); st.a = r2(t.a); st.u = r2(t.turret); st.d = t.dead ? 1 : 0;
      st.sh = t.shield > 0 ? Math.ceil(t.shield) : 0; st.dn = NET.dn; if(NET.by) st.by = NET.by;
      if(NET.pk != null) st.pk = NET.pk; if(NET.rt != null) st.rt = NET.rt;
      const now = serverNow(); if(NET.shots.length && now - NET.shots[0][4] > 2000) NET.shots = NET.shots.filter(s => now - s[4] < 2000);
      if(NET.shots.length) st.z = NET.shots;
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
    if(NET.round && Array.isArray(snap.p)) applyStates(snap.p);
  }
  function addRemote(n, side){
    const t = { name:n, side, remote:true, x:-999, y:-999, a:0, turret:0, flash:0, shield:0, dead:true, respawn:1e9, kills:0, captures:0, R:ring(16), lastTs:0, lastShot:0, stale:true, seen:false };
    tanks.push(t); NET.byName.set(n, t); return t;
  }
  function handleG(){
    const g = NET.g; if(!g || !g.r || !g.tm) return;
    const team = g.tm[NET.myName];
    if(!team) return;                                         // the teacher's screen is putting us in a team
    if(NET.team !== team || NET.round !== g.r) startRound(g);
    // classmates who joined late
    let added = false;
    for(const n in g.tm) if(n !== NET.myName && !NET.byName.has(n)){ addRemote(n, SIDE[g.tm[n]]); added = true; }
    if(added) labelSides(g);
    // score, flags and everyone's knockouts / captures this round
    if(score.grass !== g.sc[0] || score.sand !== g.sc[1]){ score.grass = g.sc[0]; score.sand = g.sc[1]; renderScore(); }
    for(const t of tanks){ const s = g.st && g.st[t.name || NET.myName]; t.captures = s ? s[0] : 0; t.kills = s ? s[1] : 0; t.returns = s ? s[2] : 0; }
    const mine = (g.st && g.st[NET.myName]) || [0, 0, 0];
    if(mine[1] > NET.myK){                                      // the referee credited this tank with knockouts
      const d = mine[1] - NET.myK; NET.myK = mine[1]; kills += d; totalKills += d; renderUpgrades();
      const tl = document.querySelector('.tally'); $('tally').textContent = totalKills; tl.classList.remove('bump'); void tl.offsetWidth; tl.classList.add('bump');
      showPop('+1 enemy tank destroyed', 'killpop');
    }
    events(g);
    if(g.e && NET.endedR !== g.r) finishRound(g);
  }
  function applyStates(list){
    for(const st of list){
      if(!st || st.n === NET.myName || st.r !== NET.round || st.x == null) continue;
      const t = NET.byName.get(st.n); if(!t) continue;
      if(st.ts > t.lastTs){
        const dead = !!st.d;
        if(t.wasDead && !dead){ t.R.n = 0; t.R.h = 0; }          // respawned: jump to the spawn point, don't slide there
        t.wasDead = dead; t.dead = dead; t.shield = +st.sh || 0; t.lastTs = st.ts; t.seen = true;
        push(t.R, st.ts, +st.x, +st.y, +st.a || 0, +st.u || 0);
        if(!t.R.n || t.x < -100){ t.x = +st.x; t.y = +st.y; }
      }
      if(Array.isArray(st.z)) for(const sh of st.z) if(sh[0] > t.lastShot){ t.lastShot = sh[0]; spawnShot(t, sh); }
    }
  }
  const flagCol = i => FLAGOBJS[i] && FLAGOBJS[i].team === 'grass' ? 'blue' : 'red';
  function events(g){
    const ev = g.ev || []; if(!ev.length) return;
    if(NET.evSeen < 0){ NET.evSeen = ev[ev.length - 1][0]; return; }     // don't replay what happened before we arrived
    for(const [id, type, name, fi] of ev){
      if(id <= NET.evSeen) continue; NET.evSeen = id;
      const who = name === NET.myName ? 'You' : name, col = fi >= 0 ? flagCol(fi) : '';
      if(type === 'take') flagMsg(who === 'You' ? `You have the ${col} flag! Drive it back to your base` : `${who} took the ${col} flag`);
      else if(type === 'cap') flagMsg(`${who} captured the ${col} flag! Blue ${g.sc[0]} – ${g.sc[1]} Red`);
      else if(type === 'drop') flagMsg(`The ${col} flag was dropped. It returns in ${DROP_SECS} s`);
      else if(type === 'ret') flagMsg(`${who} returned the ${col} flag`);
      else if(type === 'home') flagMsg(`The ${col} flag returned to its corner`);
    }
  }
  // neighbouring spawn spots: when zoomed out, alternate names above and below the tanks
  function labelSides(g){ for(const team of ['B', 'R']) Object.keys(g.tm).filter(n => g.tm[n] === team).sort().forEach((n, i) => { const t = NET.byName.get(n); if(t) t.below = i % 2 === 1; }); }
  function startRound(g){
    const first = !NET.round;
    NET.round = g.r; NET.team = g.tm[NET.myName]; NET.endedR = 0; NET.shots = []; NET.shotId = 0; NET.myK = 0; NET.pk = NET.rt = null;
    NET.rc = { correct:0, answered:0, start:performance.now() };
    const side = SIDE[NET.team];
    const t = you(); tanks.length = 0; NET.byName = new Map();
    // spawn spot: your place in your team (each base has 20 spots; beyond that the least crowded one)
    const mates = Object.keys(g.tm).filter(n => g.tm[n] === NET.team).sort(), slot = spawnSlots(side)[Math.max(0, mates.indexOf(NET.myName)) % 20];
    Object.assign(t, { side, x:slot.x, y:slot.y, hx:slot.x, hy:slot.y, a:side === 'grass' ? 0 : Math.PI, turret:side === 'grass' ? 0 : Math.PI, you:true, dead:false,
                       respawn:0, shield:SHIELD_SECS, warned:false, flag:null, name:NET.myName, flash:0, captures:0, kills:0, path:null });
    tanks.push(t); NET.byName.set(NET.myName, t);
    for(const n in g.tm) if(n !== NET.myName) addRemote(n, SIDE[g.tm[n]]);
    labelSides(g);
    // carry on after a reload: put this tank back where the teacher's screen last saw it
    const mineS = (NET.lastP || []).find(p => p && p.n === NET.myName && p.r === g.r && p.x != null);
    if(mineS && !g.e){ t.x = mineS.x; t.y = mineS.y; t.a = +mineS.a || t.a; t.turret = +mineS.u || t.turret; t.shield = 0; }
    for(const f of FLAGOBJS){ f.carrier = null; f.x = f.hx; f.y = f.hy; f.dropT = 0; }
    score.grass = g.sc[0]; score.sand = g.sc[1]; renderScore();
    bullets.length = 0; booms.length = 0; flashes.length = 0; contacts.clear(); HIST.n = 0; HIST.h = 0;
    roundOver = false; $('down').classList.remove('show');
    document.querySelectorAll('.lb-ov').forEach(x => x.remove());
    $('setup').classList.add('hidden'); SETUP_OPEN = false; last = 0;
    if(g.e && NET.reportedR >= g.r) NET.endedR = g.r;         // came back during the break after this round
    flagMsg(`${first ? 'You’re on the ' + TEAM[side] + ' team!' : 'Round ' + g.r + ': ' + TEAM[side] + ' team.'} Grab a ${side === 'grass' ? 'red' : 'blue'} flag and bring it to your base`);
    uiTick();
  }
  function finishRound(g){
    NET.endedR = g.r;
    NET.allowEnd = true; try{ endRound(); } finally { NET.allowEnd = false; }
    reportRound(g);
    uiTick();
  }
  const roundPts = s => s[0] * 100 + s[1] * 25 + s[2] * 25;
  function reportRound(g){
    if(NET.reportedR >= g.r) return; NET.reportedR = g.r;
    const s = (g.st && g.st[NET.myName]) || [0, 0, 0], pts = roundPts(s), side = SIDE[NET.team], b = g.sc[0], r = g.sc[1];
    total.points += pts; total.correct += NET.rc.correct; total.answered += NET.rc.answered; total.rounds++; total.kills += s[1]; total.caps += s[0]; saveKeep();
    const res = b === r ? 'draw' : (b > r) === (side === 'grass') ? 'won' : 'lost';
    const p = MC.result({ score:pts, correct:NET.rc.correct, answered:NET.rc.answered, seconds:(performance.now() - NET.rc.start) / 1000, variant:NET.minutes + ' min',
                          details:{ captures:s[0], tanks:s[1], returns:s[2], blue:b, red:r, result:res, team:TEAM[side], round:g.r, live:true } });
    // the save sets this round's points as the class score; put the running total straight back
    if(p && p.then) p.then(() => {
      const S = MC.session; if(!S || S.status === 'ended' || !attached) return;
      const st = liveState();
      MC.authed('mc_session_update', { p_code:S.code, p_score:st.score, p_correct:st.correct, p_answered:st.answered, p_status_text:st.status, p_finished:st.finished }).catch(() => {});
    });
  }

  /* ---------- shells ---------- */
  function hitsMe(b, T){ const m = you(); if(m.dead || b.side === m.side || b.L == null) return false; myPosAt(T - b.L, TMP); return Math.hypot(TMP.x - b.x, TMP.y - b.y) < 20; }
  function spawnShot(t, sh){
    const [, sx, sy, sa, st, L] = sh;
    let age = (serverNow() - st) / 1000; if(age > 1.1) return; age = Math.max(0, age);
    const b = { x:+sx, y:+sy, a:+sa || 0, life:1.1, trail:[], side:t.side, from:t, L:Math.max(0, Math.min(800, +L || DELAY)) };
    if(age < 0.15) flashes.push({ x:b.x + Math.cos(b.a) * 8, y:b.y + Math.sin(b.a) * 8, a:b.a, t:0 });
    const h = 6 / 520, cs = Math.cos(b.a) * 6, sn = Math.sin(b.a) * 6;
    for(let tt = 0; tt < age && !b.dead; tt += h){
      b.x += cs; b.y += sn;
      if(obstacles.some(o => blocks(o, b.x, b.y, 3)) || b.x < 0 || b.y < 0 || b.x > W || b.y > H){ b.dead = true; booms.push({ x:b.x, y:b.y, t:0 }); }
      else if(hitsMe(b, st + tt * 1000)){
        b.dead = true; const m = you(), shielded = m.shield > 0; booms.push({ x:b.x, y:b.y, t:0, big:!shielded });
        if(shielded) m.flash = 0.35; else destroy(m, false, t);
      }
    }
    b.life -= age;
    if(!b.dead && b.life > 0) bullets.push(b);
  }
  const origBulletTarget = bulletTarget;
  bulletTarget = function(b){
    if(!active()) return origBulletTarget.apply(this, arguments);
    const now = serverNow();
    for(let i = 0; i < tanks.length; i++){
      const o = tanks[i]; if(o.dead || o.side === b.side) continue;    // no friendly fire
      if(o.you){ if(hitsMe(b, now)) return o; continue; }
      if(!o.stale && Math.hypot(o.x - b.x, o.y - b.y) < 20) return o; // a classmate: just the explosion here, their iPad decides
    }
    return undefined;
  };
  const origFire = fire;
  fire = function(){
    const n = bullets.length, out = origFire.apply(this, arguments);
    if(active() && NET.round && bullets.length > n){
      const b = bullets[bullets.length - 1];
      NET.shots.push([++NET.shotId, Math.round(b.x), Math.round(b.y), r2(b.a), Math.round(serverNow()), DELAY]);
      sendState();
    }
    return out;
  };
  const origDestroy = destroy;
  destroy = function(t, byYou, from){
    if(!active()) return origDestroy.apply(this, arguments);
    if(!t || !t.you || t.dead) return;                          // only this iPad's own tank is destroyed here
    NET.dn++; NET.by = (from && from.name) || ''; saveKeep();
    const out = origDestroy.call(this, t, false);
    sendState();
    return out;
  };
  // flags belong to the referee in a class match
  const origDropFlag = dropFlag;
  dropFlag = function(t){ if(!active()) return origDropFlag.apply(this, arguments); if(t) t.flag = null; };
  const origStepFlags = stepFlags;
  stepFlags = function(dt){ if(!active()) return origStepFlags.apply(this, arguments); netFlags(); };
  function netFlags(){
    const g = NET.g, now = serverNow(), m = you(); if(!g || g.r !== NET.round) return;
    let touchPick = null, touchRet = null;
    for(let i = 0; i < FLAGOBJS.length; i++){
      const F = FLAGOBJS[i], fs = g.f[i]; if(!fs) continue;
      const ct = fs[0] ? NET.byName.get(fs[0]) : null;
      if(F.carrier && F.carrier !== ct) F.carrier.flag = null;
      F.carrier = ct || null;
      if(ct){ ct.flag = F; F.x = ct.x; F.y = ct.y; F.dropT = 0; continue; }
      F.x = fs[1]; F.y = fs[2]; F.dropT = fs[3] ? Math.max(0.01, (fs[3] - now) / 1000) : 0;
      if(m.dead || roundOver || Math.hypot(m.x - F.x, m.y - F.y) >= PICKUP_R) continue;
      if(F.team !== m.side && !m.flag) touchPick = i;
      else if(F.team === m.side && fs[3]) touchRet = i;
    }
    const changed = touchPick !== NET.pk || touchRet !== NET.rt;
    NET.pk = touchPick; NET.rt = touchRet;
    if(changed && (touchPick != null || touchRet != null)) sendState();
  }
  // the referee ends a round (3 captures or time up); the game's own timer only shows the time left
  const origEndRound = endRound;
  endRound = function(){
    if(active() && !NET.allowEnd) return;
    if(active()) return origEndRound.apply(this, arguments);
    const first = !roundOver, out = origEndRound.apply(this, arguments);
    if(first && !saved){
      saved = true;
      const t = me();
      MC.result({ score:points(), correct:stats.correct, answered:stats.answered, seconds:played(),
                  variant:Math.max(1, Math.round(ROUND.SECS / 60)) + ' min',
                  details:{ captures:t.captures || 0, tanks:totalKills || 0, blue:score.grass, red:score.sand,
                            result:score.grass > score.sand ? 'won' : score.grass < score.sand ? 'lost' : 'draw' } });
    }
    return out;
  };
  const origStep = step;
  step = function(dt){
    if(active() && NET.round && NET.g){ roundLeft = Math.max(0.05, (NET.g.end - serverNow()) / 1000 + dt); }
    origStep(dt);
    if(active() && NET.round) netFrame();
  };
  function netFrame(){
    const now = serverNow(), m = you();
    if(!m.dead) push(HIST, now, m.x, m.y, m.a, m.turret);
    if(roundOver) netFlags();                                   // keep the flags right while the board shows
    const T = now - MC.live.delay(DELAY, NET.conn);   // further behind when snapshots come less often (big classes)
    for(let i = 0; i < tanks.length; i++){
      const t = tanks[i]; if(!t.remote) continue;
      const age = t.lastTs ? now - t.lastTs : Infinity;
      t.stale = age > 5000;
      if(age > 15000) t.dead = true;                           // that iPad has gone: the tank leaves the map
      if(!t.dead && sample(t.R, T, TMP)){ t.x = TMP.x; t.y = TMP.y; t.a = TMP.a; t.turret = TMP.turret; }
    }
  }
  const origDrawTank = drawTank;
  drawTank = function(t){ if(t.stale && t.remote){ ctx.globalAlpha = 0.45; origDrawTank(t); ctx.globalAlpha = 1; return; } return origDrawTank(t); };

  /* ---------- names over the tanks (each label drawn once, then reused) ---------- */
  const LABELS = new Map();
  function label(name, kind){
    const key = kind + name; let L = LABELS.get(key); if(L) return L;
    const d = Math.min(2, devicePixelRatio || 1), fs = 13, txt = name.length > 14 ? name.slice(0, 13) + '…' : name;
    const c = document.createElement('canvas'), g = c.getContext('2d'), font = `900 ${fs * d}px Nunito,ui-rounded,system-ui,sans-serif`;
    g.font = font; const w = Math.ceil(g.measureText(txt).width + 10 * d), h = Math.ceil((fs + 8) * d);
    c.width = w; c.height = h; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 4 * d; g.strokeStyle = 'rgba(18,26,34,.9)'; g.fillStyle = kind === 'me' ? '#FFD45A' : kind === 'grass' ? '#9CC2FF' : '#FFB0A8';
    g.strokeText(txt, w / 2, h / 2); g.fillText(txt, w / 2, h / 2);
    L = { c, w:w / d, h:h / d }; if(LABELS.size > 200) LABELS.clear(); LABELS.set(key, L); return L;
  }
  function drawNames(){
    if(!active() || !NET.round) return;
    const z = cam.z, m = you(), hw = vw / 2 / z + 80, hh = vh / 2 / z + 80;
    for(let i = tanks.length - 1; i >= 0; i--){
      const t = tanks[i]; if(t.dead || !t.name) continue;
      if(t.you && z > 0.5) continue;                               // close up, your tank already says YOU
      if(mode === 'over' && t.side !== m.side) continue;          // the whole-map view only shows your own team
      if(Math.abs(t.x - cam.x) > hw || Math.abs(t.y - cam.y) > hh) continue;
      const L = label(t.name, t.you ? 'me' : t.side), w = L.w / z, h = L.h / z;
      if(t.stale) ctx.globalAlpha = 0.5;
      ctx.drawImage(L.c, t.x - w / 2, z < 0.4 && t.below ? t.y + 24 : t.y - (t.flag ? 58 : 26) - h, w, h);
      if(t.stale) ctx.globalAlpha = 1;
    }
  }

  /* ---------- messages on screen ---------- */
  function waitBox(html){
    let el = $('mcCtfWait');
    if(!html){ if(el) el.remove(); return; }
    if(!el){ el = document.createElement('div'); el.id = 'mcCtfWait'; el.className = 'mc-ui'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;inset:0;z-index:58;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,14,24,.6);font-family:Nunito,ui-rounded,system-ui,sans-serif';
      document.body.appendChild(el); }
    if(el.dataset.h !== html){ el.dataset.h = html;
      el.innerHTML = `<div style="max-width:440px;background:#1B2232;color:#fff;border:3px solid #22303A;border-radius:22px;padding:22px 24px;text-align:center;box-shadow:0 10px 0 rgba(0,0,0,.35)">${html}</div>`; }
  }
  function pill(text, colour){
    let el = $('mcCtfPill');
    if(!text){ if(el) el.style.display = 'none'; return; }
    if(!el){ el = document.createElement('div'); el.id = 'mcCtfPill'; el.className = 'mc-ui'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top,0px));z-index:70;font:900 15px Nunito,ui-rounded,system-ui,sans-serif;color:#fff;background:rgba(19,30,48,.9);border:2px solid #FFC23D;border-radius:999px;padding:7px 16px;pointer-events:none;white-space:nowrap';
      document.body.appendChild(el); }
    el.style.display = ''; el.style.borderColor = colour || '#FFC23D'; if(el.textContent !== text) el.textContent = text;
  }
  const H2 = 'style="margin:0 0 8px;font-family:\'Lilita One\',system-ui,sans-serif;font-weight:400;font-size:1.6rem;color:#FFC23D"';
  function uiTick(){
    if(!active()){ waitBox(null); pill(null); return; }
    if(!NET.round){
      const g = NET.g;
      waitBox(NET.failed ? `<h2 ${H2}>Waiting for your teacher’s screen…</h2><p style="margin:0;font-weight:800">The live match can’t connect from this iPad right now. It keeps trying by itself: keep this page open.</p>`
        : !NET.conn ? `<h2 ${H2}>Connecting to the class match…</h2>`
        : g && g.r ? `<h2 ${H2}>Joining a team…</h2>`
        : `<h2 ${H2}>Waiting for your teacher’s screen…</h2><p style="margin:0;font-weight:800">The match starts when your teacher’s Mathcade screen is open. Keep this page open.</p>`);
      pill(null); return;
    }
    waitBox(null);
    const g = NET.g, now = serverNow(), col = NET.team === 'B' ? '#4D8BFF' : '#FF5A4E';
    if(Date.now() - NET.snapAt > 6000) pill('Lost touch with your teacher’s screen: reconnecting…');
    else if(g && g.r === NET.round && g.e){ pill(g.fin ? 'Time’s up! Look at the big screen for the results' : `Next round in ${Math.max(1, Math.ceil((g.nx - now) / 1000))} s`, col); }
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
    }catch(e){ console.warn('Live match unavailable', e); NET.failed = true; NET.conn = null; setTimeout(connect, 8000); }
    NET.connecting = false; uiTick();
  }
  window.mcCtfNet = () => ({ round:NET.round, team:NET.team, me:NET.myName, connected:!!NET.conn, failed:NET.failed,
    g:NET.g ? { r:NET.g.r, tm:NET.g.tm, sc:NET.g.sc, f:NET.g.f, st:NET.g.st, e:NET.g.e, w:NET.g.w, how:NET.g.how, nx:NET.g.nx, fin:NET.g.fin } : null, now:serverNow() });
  window.mcCtfFeed = snap => onSnap(snap);   // tests: play a snapshot as if it came from the teacher's screen
  if(JOIN && MC.live && MC.live.supported && MC.live.supported('ctf') && MC.configured()) connect();

  /* ---------- reporting ---------- */
  function liveState(){
    if(active()){
      const g = NET.g, s = (g && g.r === NET.round && g.st && g.st[NET.myName]) || [0, 0, 0];
      const now = NET.round && NET.reportedR < NET.round;        // the round being played has not been added yet
      const done = !!(g && g.fin && g.e && NET.reportedR >= g.r);
      return { score:total.points + (now ? roundPts(s) : 0), correct:total.correct + (now ? NET.rc.correct : 0), answered:total.answered + (now ? NET.rc.answered : 0),
               status:!NET.team ? 'Waiting for the match' : `${TEAM[SIDE[NET.team]]} · ${plural(total.caps + (now ? s[0] : 0), 'flag', 'flags')} · ${plural(total.kills + (now ? s[1] : 0), 'tank', 'tanks')}`, finished:done };
    }
    const t = me();
    return { score:points(), correct:stats.correct, answered:stats.answered,
             status:plural(t.captures || 0, 'flag', 'flags') + ' · ' + plural(totalKills || 0, 'tank', 'tanks'), finished:roundOver };
  }
  // per-round maths counts for the class match
  const origAnswer2 = answer;
  answer = function(i){
    if(active() && !(qLocked || !Q || allFull())){ NET.rc.answered++; if(i === Q.correctIndex) NET.rc.correct++; }
    return origAnswer2.apply(this, arguments);
  };

  // end-of-round board: usernames instead of "You"; in a class match no "Play again" (the next round starts by itself)
  const origLB = window.showLeaderboard;
  window.showLeaderboard = function(cfg){
    const name = (active() && NET.myName) || (MC.user && MC.user.username);
    if(name && cfg){
      const fix = e => { if(e && e.you) e.name = name; };
      (cfg.entries || []).forEach(fix); (cfg.teams || []).forEach(t => (t.entries || []).forEach(fix));
    }
    if(active() && cfg){
      const g = NET.g, s = (g && g.st && g.st[NET.myName]) || [0, 0, 0];
      (cfg.teams || []).forEach(t => (t.entries || []).forEach(e => { const tk = [...NET.byName.values()].find(x => (x.you ? name : x.name) === e.name);
        if(tk && tk.returns) e.sub += ` · ${plural(tk.returns, 'return', 'returns')}`; }));
      cfg.note = `Your class points this round: ${roundPts(s)} (captures × 100 + tanks destroyed × 25 + flags returned × 25) · your total: ${total.points} (${TEAM[SIDE[NET.team]] || ''} team). `
        + (g && g.fin ? 'Time’s up!' : 'The next round starts by itself.');
      cfg.actions = (cfg.actions || []).filter(a => !/again/i.test(a.label || ''));
    }
    return origLB.apply(this, arguments);
  };

  MC.register({
    game:'ctf',
    keepLive:true,
    start(ctx){
      inClass = true; attached = true;
      NET.myName = ctx.username || (MC.user && MC.user.username) || NET.myName;
      loadKeep();
      const s = ctx.settings || {};
      NET.minutes = Math.max(1, Math.round(+s.minutes || 5));
      if(['easy','medium','hard'].includes(s.difficulty)){
        MATHS_DIFF = s.difficulty;
        document.querySelectorAll('#mdiff button').forEach(b => { const on = b.dataset.v === s.difficulty; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      }
      const ts = $('setupTopic'), live = $('topic');
      if(live && !ts.options.length) ts.innerHTML = live.innerHTML;
      const topic = s.topic && [...ts.options].some(o => o.value === s.topic) ? s.topic : 'mixed';
      ts.value = topic; topicId = topic; if(live) live.value = topic;
      const secs = Math.max(30, Math.round(ctx.remainingSeconds || NET.minutes * 60));
      ROUND.SECS = secs; roundLeft = secs;
      // redraw the fuel tiers and pick a fresh question at the class difficulty
      const tierBtn = document.querySelector('#tiers .tier.on') || document.querySelector('#tiers .tier');
      if(tierBtn) tierBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true }));
      // no practice tanks: the match starts when the teacher's screen sends the teams
      const t = you(); tanks.length = 0; tanks.push(t);
      $('setup').classList.add('hidden');
      FRAME_HOOK = drawNames;
      if(!NET.uiT) NET.uiT = setInterval(uiTick, 250);
      if(!NET.conn && !NET.connecting && JOIN) connect();
      handleG();
      if(NET.round && NET.lastP) applyStates(NET.lastP);
      uiTick();
    },
    live:liveState,
    onEnded(){
      // teacher ended the class game: count the round being played, then stop
      if(active() && NET.g && NET.round && NET.reportedR < NET.round){ NET.allowEnd = true; try{ endRound(); } finally { NET.allowEnd = false; } reportRound(Object.assign({}, NET.g, { r:NET.round })); }
      attached = false; inClass = false; MC.leaveSession();
      FRAME_HOOK = null;
      clearInterval(NET.sendT); NET.sendT = 0; clearInterval(NET.uiT); NET.uiT = 0;
      if(NET.conn) try{ NET.conn.close(); }catch(e){}
      NET.conn = null; waitBox(null); pill(null);
    },
  });
})();
