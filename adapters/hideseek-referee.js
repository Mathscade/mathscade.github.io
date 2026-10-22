/* Hide & Seek: referee for the live class game. Runs on the teacher's host screen (MC.live.host loads it).
   Each student's iPad moves its own character and keeps its own stamina. This referee is in charge of everything
   shared, and sends it with every snapshot as `g`:
     - the teams: when the game starts, everyone is shuffled and dealt out into Red (R) and Blue (B), evenly.
       Late joiners join the smaller team.
     - the minutes: the game is cut into 1-minute rounds. The first team (f) hides in rounds 0, 2, 4…, the other
       team in rounds 1, 3, 5…. Every iPad works out the round from the start time, so they all swap together.
     - tags: a seeker's iPad says who it touched (tg); the referee checks the tagger is seeking, the other is hiding,
       free (not already caught or just back) and close, then counts the catch: +1 to the seeking team. The hider is
       out for 10 s (c), then comes back somewhere else and can't be tagged for 2 s more (im).
     - the end: time is up. The team with the most catches wins.
   g = { r, s:start, end, rl:round ms, f:first hiding team, tm:{name:'R'|'B'}, c:{name:out until}, im:{name:safe until},
         sc:{R,B}, st:{name:[catches, timesCaught]}, e, w, now } */
(function(){
  const ROUND = 60000, CAUGHT = 10000, IMMUNE = 2000, TAG_D = 170, STALE = 6000;
  const NAME = { R:'Red', B:'Blue' };
  MC.live.referees.hideseek = function(api){
    const KEY = 'mc_hideseek_ref_' + api.code;
    const blank = () => ({ r:0, s:0, f:'R', tm:{}, c:{}, im:{}, sc:{ R:0, B:0 }, st:{}, e:0, w:'' });
    let R = (() => { try{ const v = JSON.parse(localStorage.getItem(KEY)); return v && v.r ? v : blank(); }catch(e){ return blank(); } })();
    const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(R)); }catch(e){} };
    const settings = () => { const B = api.board(); return (B && B.settings) || {}; };
    const stat = n => R.st[n] || (R.st[n] = [0, 0]);
    const sizes = () => { const s = { R:0, B:0 }; for(const n in R.tm) s[R.tm[n]]++; return s; };
    const hiding = sn => { const k = Math.max(0, Math.floor((sn - R.s) / ROUND)); return k % 2 === 0 ? R.f : (R.f === 'R' ? 'B' : 'R'); };
    function tick(latest, hostNow){
      const B = api.board(); if(!B || B.status !== 'live') return null;
      const sn = api.now(), st0 = Date.parse(B.starts_at);
      const endsAt = B.ends_at ? Date.parse(B.ends_at) : st0 + 60000 * Math.max(1, +settings().minutes || 6);
      const inClass = new Set((B.players || []).map(p => p.username));
      if(!R.r){
        if(!(sn >= st0 - 300)) return null;
        const names = [...new Set([...inClass, ...[...latest.keys()].filter(n => inClass.has(n))])];
        for(let i = names.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
        names.forEach((n, i) => { R.tm[n] = i % 2 ? 'B' : 'R'; });
        R.f = Math.random() < 0.5 ? 'R' : 'B'; R.r = 1; R.s = sn - st0 < 8000 ? st0 : sn; save();
      }
      // late joiners join the smaller team
      for(const [n, s] of latest) if(!R.tm[n] && (!inClass.size || inClass.has(n)) && hostNow - s.at < STALE){ const z = sizes(); R.tm[n] = z.R <= z.B ? 'R' : 'B'; }
      if(!R.e){
        const hide = hiding(sn);
        // tags: a seeker's iPad names the hider it touched
        for(const [n, s] of latest){
          if(!R.tm[n] || R.tm[n] === hide || !s.tg || hostNow - s.at > 1500) continue;
          if((R.c[n] || 0) > sn) continue;   // a caught player can't tag
          const v = latest.get(s.tg); if(!v || R.tm[s.tg] !== hide || hostNow - v.at > STALE) continue;
          if((R.c[s.tg] || 0) > sn || (R.im[s.tg] || 0) > sn) continue;
          if(Math.hypot(s.x - v.x, s.y - v.y) > TAG_D || (s.l || 0) !== (v.l || 0)) continue;   // same level only (the mezzanine)
          R.c[s.tg] = sn + CAUGHT; R.im[s.tg] = sn + CAUGHT + IMMUNE;
          R.sc[R.tm[n]]++; stat(n)[0]++; stat(s.tg)[1]++;
        }
        if(sn >= endsAt){ R.e = sn; R.w = R.sc.R > R.sc.B ? 'R' : R.sc.B > R.sc.R ? 'B' : ''; }
        save();
      }
      for(const n in R.im) if(R.im[n] < sn){ delete R.im[n]; delete R.c[n]; }
      return { r:R.r, s:R.s, end:endsAt, rl:ROUND, f:R.f, tm:R.tm, c:R.c, im:R.im, sc:R.sc, st:R.st, e:R.e, w:R.w, now:sn };
    }
    function info(){
      if(!R.r) return '';
      if(R.e) return `${R.w ? NAME[R.w] + ' team wins' : 'A draw'}: Red ${R.sc.R}, Blue ${R.sc.B} catches`;
      const sn = api.now(), k = Math.max(0, Math.floor((sn - R.s) / ROUND));
      return `Red ${R.sc.R} · Blue ${R.sc.B} catches · minute ${k + 1}: ${NAME[hiding(sn)]} hiding`;
    }
    function teams(){ const o = {}; for(const n in R.tm) o[n] = NAME[R.tm[n]]; return o; }
    return { tick, info, teams };
  };
})();
