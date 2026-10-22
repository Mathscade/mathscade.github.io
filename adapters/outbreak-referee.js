/* Total Outbreak: referee for the live class game. Runs on the teacher's host screen (MC.live.host loads it).
   Each student's iPad moves its own character and answers its own questions. This referee is in charge of
   everything shared, and sends it with every snapshot as `g`:
     - the teams: when the game starts ONE student, at random, is the zombie (Z); everyone else is human (H).
       Late joiners are human.
     - tags: a zombie's iPad says who it touched (tg); the referee checks both are free (not racing, not just
       out of a race) and close together, then starts a maths race between them.
     - races: each side's iPad reports its right answers (dq: [race id, right answers, ms since the race opened]).
       First to RACE_Q wins. Zombie wins: the human is infected (becomes Z, for good). Human wins: they escape.
       Nobody finishing within RACE_MAX, or the human's iPad going quiet: they get away.
     - the end: time is up (the humans still standing survived), or no humans are left (total outbreak).
   g = { r, s:start, rel:zombies-released-at, end, tm:{name:'H'|'Z'}, d:[[id,z,s,zc,sc]], res:[[id,z,s,out]],
         im:{name:until}, st:{name:[raceWins, infections, 0]}, e, w:'H' (someone survived) | 'Z' (nobody did), now } */
(function(){
  const RACE_Q = 3, RACE_MAX = 60000, IMMUNE = 4000, RELEASE = 10000, TAG_D = 170, STALE = 6000;
  const NAME = { H:'Humans', Z:'Zombies' };
  MC.live.referees.outbreak = function(api){
    const KEY = 'mc_outbreak_ref_' + api.code;
    const blank = () => ({ r:0, s:0, tm:{}, d:[], res:[], id:0, im:{}, st:{}, e:0, w:'' });
    let R = (() => { try{ const v = JSON.parse(localStorage.getItem(KEY)); return v && v.r ? v : blank(); }catch(e){ return blank(); } })();
    const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(R)); }catch(e){} };
    const settings = () => { const B = api.board(); return (B && B.settings) || {}; };
    const stat = n => R.st[n] || (R.st[n] = [0, 0, 0]);
    const sizes = () => { const s = { H:0, Z:0 }; for(const n in R.tm) s[R.tm[n]]++; return s; };
    const busy = (n, sn) => R.d.some(d => d[1] === n || d[2] === n) || (R.im[n] || 0) > sn;
    function result(d, out, sn){
      const [id, z, s] = d; R.d = R.d.filter(x => x !== d);
      if(out === 'infected'){ R.tm[s] = 'Z'; stat(z)[0]++; stat(z)[1]++; }
      else stat(s)[0]++;   // escaped: a win for the human
      R.res.push([id, z, s, out]); if(R.res.length > 16) R.res.shift();
      R.im[z] = R.im[s] = sn + IMMUNE;
    }
    function tick(latest, hostNow){
      const B = api.board(); if(!B || B.status !== 'live') return null;
      const sn = api.now(), st0 = Date.parse(B.starts_at);
      const endsAt = B.ends_at ? Date.parse(B.ends_at) : st0 + 60000 * Math.max(1, +settings().minutes || 5);
      const inClass = new Set((B.players || []).map(p => p.username));
      if(!R.r){
        if(!(sn >= st0 - 300)) return null;
        const names = [...new Set([...inClass, ...[...latest.keys()].filter(n => inClass.has(n))])];
        for(let i = names.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
        const zs = names.length > 1 ? 1 : 0;   // one zombie
        names.forEach((n, i) => { R.tm[n] = i < zs ? 'Z' : 'H'; });
        R.r = 1; R.s = sn - st0 < 8000 ? st0 : sn; save();
      }
      // late joiners join the smaller side
      for(const [n, s] of latest) if(!R.tm[n] && (!inClass.size || inClass.has(n)) && hostNow - s.at < STALE) R.tm[n] = 'H';   // late joiners are human
      if(!R.e){
        const released = sn >= R.s + RELEASE;
        // races: progress, finish, time-outs, someone gone quiet
        for(const d of [...R.d]){
          const [id, z, s] = d, Sz = latest.get(z), Ss = latest.get(s);
          const cz = Sz && Sz.dq && Sz.dq[0] === id ? +Sz.dq[1] || 0 : d[3], cs = Ss && Ss.dq && Ss.dq[0] === id ? +Ss.dq[1] || 0 : d[4];
          d[3] = Math.max(d[3], cz); d[4] = Math.max(d[4], cs);
          const zq = !Sz || hostNow - Sz.at > STALE, sq = !Ss || hostNow - Ss.at > STALE;
          if(d[3] >= RACE_Q && d[4] >= RACE_Q){ const tz = +(Sz.dq[2] || 0), ts = +(Ss.dq[2] || 0); result(d, tz < ts ? 'infected' : 'escaped', sn); }
          else if(d[3] >= RACE_Q) result(d, 'infected', sn);
          else if(d[4] >= RACE_Q) result(d, 'escaped', sn);
          else if(sq) result(d, 'escaped', sn);
          else if(zq) result(d, 'escaped', sn);
          else if(sn - d[5] > RACE_MAX) result(d, 'escaped', sn);
        }
        // tags: a zombie's iPad names the scientist it touched
        if(released) for(const [n, s] of latest){
          if(R.tm[n] !== 'Z' || !s.tg || hostNow - s.at > 1500) continue;
          const v = latest.get(s.tg); if(!v || R.tm[s.tg] !== 'H' || hostNow - v.at > STALE) continue;
          if(busy(n, sn) || busy(s.tg, sn)) continue;
          if(Math.hypot(s.x - v.x, s.y - v.y) > TAG_D) continue;
          R.d.push([++R.id, n, s.tg, 0, 0, sn]);
        }
        const z = sizes();
        if(sn >= endsAt || (released && R.r && z.H === 0 && Object.keys(R.tm).length > 1)){
          R.e = sn; R.w = z.H > 0 ? 'H' : 'Z';
          R.d.forEach(d => R.res.push([d[0], d[1], d[2], 'escaped'])); R.d = [];
        }
        save();
      }
      for(const n in R.im) if(R.im[n] < sn) delete R.im[n];
      return { r:R.r, s:R.s, rel:R.s + RELEASE, end:endsAt, tm:R.tm, d:R.d.map(d => d.slice(0, 5)), res:R.res, im:R.im, st:R.st, e:R.e, w:R.w, now:sn };
    }
    function info(){
      if(!R.r) return '';
      const z = sizes();
      if(R.e) return R.w === 'H' ? `${z.H} survived the night, ${z.Z} infected` : `Total outbreak: everyone was infected`;
      return `${z.H} humans, ${z.Z} zombies · ${R.d.length} maths race${R.d.length === 1 ? '' : 's'} on now`;
    }
    function teams(){ const o = {}; for(const n in R.tm) o[n] = NAME[R.tm[n]]; return o; }
    return { tick, info, teams };
  };
})();
