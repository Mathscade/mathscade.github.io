/* Battle Tank Capture the Flag: referee for the live class match.
   Runs on the teacher's host screen (MC.live.host loads it). Each student's iPad is in charge of its own tank
   (where it is, whether it has been destroyed and by whom, its spawn shield). This referee is in charge of
   everything shared, and sends it with every snapshot as `g`:
     - the teams: when the match starts every student is put at random into Blue or Red, evenly (sizes differ
       by at most one); late joiners go into the smaller team. Teams stay the same for the whole class game.
     - the flags: pickups (a student's iPad asks when its tank touches an enemy flag), carrying, captures
       (the carrier reaches its own base), drops (the carrier is destroyed or its iPad goes quiet) and returns
       (a defender touches its own dropped flag, or 30 s pass);
     - the score, knockouts, captures and returns per student, and the end of each round (3 captures or the
       class game's time is up); a new round starts by itself after a short break while time is left.
   Map numbers below are the game's (64 px tiles, 60 × 34). */
(function(){
  const T = 64, W = 60 * T, H = 34 * T, PICK_R = 130, DROP_MS = 30000, STALE_MS = 15000, CAPS = 3;
  const BASE = { x:T, y:10 * T, w:6 * T, h:14 * T };
  const baseX = team => team === 'B' ? BASE.x : W - BASE.x - BASE.w;
  const inBase = (team, x, y) => { const bx = baseX(team); return x > bx && x < bx + BASE.w && y > BASE.y && y < BASE.y + BASE.h; };
  // the four flags, in the game's order: Blue (grass) flags belong to team B, Red (sand) flags to team R
  const HOME = [];
  for(const [x, y] of [[2.4 * T, 2.6 * T], [2.4 * T, H - 2.6 * T]]){ HOME.push({ team:'B', x, y }); HOME.push({ team:'R', x:W - x, y:H - y }); }
  const homeFlags = () => HOME.map(h => ({ c:'', x:h.x, y:h.y, until:0 }));
  const TEAM = { B:'Blue', R:'Red' };

  MC.live.referees.ctf = function(api){
    const KEY = 'mc_ctf_ref_' + api.code;
    const blank = () => ({ r:0, s:0, tm:{}, sc:{ B:0, R:0 }, f:homeFlags(), st:{}, dn:{}, e:0, w:'', how:'', nx:0, fin:0, ev:[], evId:0, last:{} });
    let R = (() => { try{ const v = JSON.parse(localStorage.getItem(KEY)); return v && v.r ? v : blank(); }catch(e){ return blank(); } })();
    const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(R)); }catch(e){} };
    const settings = () => { const B = api.board(); return (B && B.settings) || {}; };
    const breakMs = () => 1000 * Math.max(5, Math.min(60, +settings().breakSecs || 15));
    const stat = n => R.st[n] || (R.st[n] = [0, 0, 0]);          // [captures, knockouts, returns] this round
    const event = (type, name, flag, team) => { R.ev.push([++R.evId, type, name || '', flag == null ? -1 : flag, team || '']); if(R.ev.length > 10) R.ev.shift(); };
    const sizes = () => { const s = { B:0, R:0 }; for(const n in R.tm) s[R.tm[n]]++; return s; };
    function addPlayer(n){ const s = sizes(); R.tm[n] = s.B < s.R ? 'B' : s.R < s.B ? 'R' : (Math.random() < 0.5 ? 'B' : 'R'); }
    function startRound(s){
      R.r++; R.s = s; R.sc = { B:0, R:0 }; R.f = homeFlags(); R.st = {}; R.e = 0; R.w = ''; R.how = ''; R.nx = 0;
      event('round', '', null, ''); save();
    }
    function drop(i, x, y, sn){ const f = R.f[i]; f.c = ''; f.x = x; f.y = y; f.until = sn + DROP_MS; event('drop', '', i, HOME[i].team); }
    function home(i, type, name){ const f = R.f[i]; f.c = ''; f.x = HOME[i].x; f.y = HOME[i].y; f.until = 0; event(type, name, i, HOME[i].team); }
    function end(how, w, sn, endsAt){ R.e = sn; R.how = how; R.w = w; R.nx = sn + breakMs(); R.fin = R.nx > endsAt - 20000 ? 1 : 0; event('end', '', null, w); save(); }

    function tick(latest, hostNow){
      const B = api.board(); if(!B || B.status !== 'live') return null;
      const sn = api.now(), st0 = Date.parse(B.starts_at);
      const endsAt = B.ends_at ? Date.parse(B.ends_at) : st0 + 60000 * Math.max(1, +settings().minutes || 5);
      const inClass = new Set((B.players || []).map(p => p.username));
      if(!R.r){
        if(!(sn >= st0 - 300)) return null;
        // the random, even split: shuffle everyone, then deal them out Blue, Red, Blue, Red...
        const names = [...new Set([...inClass, ...[...latest.keys()].filter(n => inClass.has(n))])];
        for(let i = names.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
        const first = Math.random() < 0.5 ? 'B' : 'R', other = first === 'B' ? 'R' : 'B';
        names.forEach((n, i) => { R.tm[n] = i % 2 ? other : first; });
        startRound(sn - st0 < 8000 ? st0 : sn);
      }
      // late joiners: into the smaller team
      for(const [n, s] of latest) if(!R.tm[n] && (!inClass.size || inClass.has(n)) && hostNow - s.at < STALE_MS) addPlayer(n);
      if(R.e && !R.fin && sn >= R.nx && sn < endsAt - 15000) startRound(sn);
      if(!R.e && R.r){
        for(const n in R.tm){
          const team = R.tm[n], s = latest.get(n), ok = s && hostNow - s.at < STALE_MS && s.r === R.r;
          const carrying = R.f.findIndex(f => f.c === n);
          if(!ok){ if(carrying >= 0){ const l = R.last[n] || HOME[carrying]; drop(carrying, l.x, l.y, sn); } continue; }
          R.last[n] = { x:s.x, y:s.y };
          // knockouts: the victim's iPad counts its own deaths and says who did it
          const dn = s.dn | 0;
          if(R.dn[n] == null) R.dn[n] = dn;
          else if(dn > R.dn[n]){
            const k = dn - R.dn[n]; R.dn[n] = dn;
            if(s.by && R.tm[s.by] && R.tm[s.by] !== team){ stat(s.by)[1] += k; event('ko', s.by, null, R.tm[s.by]); }
          }
          if(s.d){ if(carrying >= 0) drop(carrying, s.x, s.y, sn); continue; }
          if(carrying >= 0){
            const f = R.f[carrying]; f.x = s.x; f.y = s.y;
            if(inBase(team, s.x, s.y)){
              R.sc[team]++; stat(n)[0]++; home(carrying, 'cap', n);
              if(R.sc[team] >= CAPS){ end('caps', team, sn, endsAt); break; }
            }
            continue;
          }
          // pickup and return requests, checked against where the tank is
          const pk = s.pk, rt = s.rt;
          if(pk != null && R.f[pk] && HOME[pk].team !== team && !R.f[pk].c && Math.hypot(s.x - R.f[pk].x, s.y - R.f[pk].y) < PICK_R){
            const f = R.f[pk]; f.c = n; f.until = 0; event('take', n, pk, team);
          } else if(rt != null && R.f[rt] && HOME[rt].team === team && !R.f[rt].c && R.f[rt].until && Math.hypot(s.x - R.f[rt].x, s.y - R.f[rt].y) < PICK_R){
            stat(n)[2]++; home(rt, 'ret', n);
          }
        }
        if(!R.e){
          R.f.forEach((f, i) => { if(!f.c && f.until && sn >= f.until) home(i, 'home', ''); });
          if(sn >= endsAt) end('time', R.sc.B > R.sc.R ? 'B' : R.sc.R > R.sc.B ? 'R' : '', sn, endsAt);
        }
        save();
      }
      return { r:R.r, s:R.s, end:endsAt, tm:R.tm, sc:[R.sc.B, R.sc.R], f:R.f.map(f => [f.c, Math.round(f.x), Math.round(f.y), f.until]),
               st:R.st, e:R.e, w:R.w, how:R.how, nx:R.nx, fin:R.fin, ev:R.ev, now:sn };
    }
    function info(){
      if(!R.r) return '';
      const s = sizes(), sc = `Blue ${R.sc.B} – ${R.sc.R} Red`;
      if(R.e) return `Round ${R.r}: ${R.w ? TEAM[R.w] + ' team won' : 'a draw'} (${sc})` + (R.fin ? '' : ` · next round in ${Math.max(0, Math.ceil((R.nx - api.now()) / 1000))} s`);
      return `Round ${R.r}: ${sc} · teams ${s.B} Blue, ${s.R} Red`;
    }
    // each student's team, for the team totals on the host screen
    function teams(){ const o = {}; for(const n in R.tm) o[n] = TEAM[R.tm[n]]; return o; }
    return { tick, info, teams };
  };
})();
