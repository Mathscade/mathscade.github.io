/* Battle Tank Royale: referee for the live class battle.
   Runs on the teacher's host screen (MC.live.host loads it), next to the relay that sends every student's
   tank to everyone else. Each student's iPad is in charge of its own tank (where it is, whether it has been
   hit and by whom). This referee is in charge of everything shared:
     - the battle number, the roster (one lane per student, in a fixed order) and the phase times
       (supply start and GO, on the server clock, so every iPad changes phase together);
     - the list of knockouts (from the victims' own reports, plus students whose iPad stopped sending);
     - the trophy claim (alone in the circle for 8 s; a second tank pauses it) and the winner
       (trophy holder or last tank standing);
     - the break before the next battle, which then starts by itself.
   Its state rides along in every snapshot as `g`, so a missed message never matters.
   Positions in the students' states are relative to the arena centre, in a frame shared by everyone. */
(function(){
  const CLAIM_R = 95, CLAIM_SECS = 8, COUNTDOWN = 3, DROP_MS = 15000, NOSHOW_MS = 10000;
  const hash = s => { let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const r1 = v => Math.round(v * 10) / 10;
  MC.live.referees.royale = function(api){
    const KEY = 'mc_royale_ref_' + api.code;
    const blank = () => ({ b:0, r:[], s:0, go:0, ko:[], c:null, cx:0, w:null, how:'', e:0, nx:0, seen:{} });
    let R = (() => { try{ const v = JSON.parse(localStorage.getItem(KEY)); return v && v.b ? v : blank(); }catch(e){ return blank(); } })();
    const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(R)); }catch(e){} };
    let lastSn = 0;
    const settings = () => { const B = api.board(); return (B && B.settings) || {}; };
    // supply and break lengths: 60 s and 15 s (tests may shorten them with the hidden settings supply / breakSecs)
    const supplyMs = () => 1000 * Math.max(5, Math.min(120, +settings().supply || 60));
    const breakMs = () => 1000 * Math.max(5, Math.min(60, +settings().breakSecs || 15));
    function newBattle(s, names){
      const b = R.b + 1;
      // a fixed order everyone receives; it changes each battle so neighbours change
      const r = [...new Set(names)].sort((x, y) => (hash(x + '#' + b) - hash(y + '#' + b)) || (x < y ? -1 : 1)).slice(0, 60);
      R = Object.assign(blank(), { b, r, s, go:s + supplyMs() + COUNTDOWN * 1000 });
      save();
    }
    function end(w, how, sn){ R.w = w; R.how = how; R.e = sn; R.nx = sn + breakMs(); R.c = null; R.cx = 0; save(); }
    function tick(latest, hostNow){
      const B = api.board(); if(!B || B.status !== 'live') return null;
      const sn = api.now(), dt = lastSn ? Math.max(0, Math.min(1, (sn - lastSn) / 1000)) : 0; lastSn = sn;
      const inClass = new Set((B.players || []).map(p => p.username));
      const live = [];
      for(const [n, s] of latest) if(hostNow - s.at < DROP_MS && (!inClass.size || inClass.has(n))) live.push(n);
      if(!R.b){
        // battle 1: everyone in the class game, starting when the teacher's countdown ends
        const st = Date.parse(B.starts_at); if(!(sn >= st - 300)) return null;
        newBattle(sn - st < 8000 ? st : sn + 2000, [...inClass].concat(live));
      } else if(R.e && sn >= R.nx){
        // later battles: every student whose game is open (late joiners included)
        if(live.length) newBattle(sn, live); else { R.nx = sn + 3000; }
      }
      if(!R.e && R.b){
        const out = new Set(R.ko.map(k => k[0]));
        for(const n of R.r){
          if(out.has(n)) continue;
          const s = latest.get(n), cur = s && s.b === R.b && !s.sp;
          if(cur) R.seen[n] = s.at;
          if(cur && s.al === 0){ R.ko.push([n, s.by && s.by !== n && R.r.includes(s.by) ? s.by : '', sn]); out.add(n); continue; }
          if(sn >= R.go){
            const seen = R.seen[n];
            if(seen == null ? sn > R.go + NOSHOW_MS : hostNow - seen > DROP_MS){ R.ko.push([n, '', sn]); out.add(n); }   // iPad closed or offline
          }
        }
        const alive = R.r.filter(n => !out.has(n));
        if(sn >= R.go){
          if(R.r.length >= 2 && alive.length <= 1) end(alive[0] || '', alive.length ? 'last' : 'none', sn);
          else if(!alive.length) end('', 'none', sn);
          else {
            const inside = alive.filter(n => { const s = latest.get(n); return s && s.b === R.b && s.al !== 0 && hostNow - s.at < 3000 && Math.hypot(s.x, s.y) < CLAIM_R; });
            R.cx = inside.length > 1 ? 1 : 0;
            if(!inside.length) R.c = null;
            else if(inside.length === 1){
              const h = inside[0]; if(!R.c || R.c.n !== h) R.c = { n:h, p:0 };
              R.c.p += dt; if(R.c.p >= CLAIM_SECS) end(h, 'trophy', sn);
            } else if(R.c && !inside.includes(R.c.n)) R.c = null;
          }
        }
        save();
      }
      return { b:R.b, r:R.r, s:R.s, go:R.go, ko:R.ko, c:R.c ? [R.c.n, r1(R.c.p)] : null, cx:R.cx, w:R.e ? R.w : null, how:R.how, e:R.e, nx:R.nx, now:sn };
    }
    function info(){
      if(!R.b) return '';
      const sn = api.now();
      if(R.e){ const left = Math.max(0, Math.ceil((R.nx - sn) / 1000));
        return `Battle ${R.b}: ${R.w ? R.w + (R.how === 'trophy' ? ' held the trophy' : ' was the last tank standing') : 'no winner'} · next battle in ${left} s`; }
      if(sn < R.go - COUNTDOWN * 1000) return `Battle ${R.b}: supply phase, ${R.r.length} tanks`;
      return `Battle ${R.b}: ${R.r.length - R.ko.length} of ${R.r.length} tanks left${R.c ? ' · ' + R.c.n + ' is claiming the trophy' : ''}`;
    }
    return { tick, info };
  };
})();
