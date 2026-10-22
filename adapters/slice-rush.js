/* Slice Rush <-> Mathcade online */
(function(){
  let cur = null, reported = false, classMinutes = null, shared = null, classG = null, board = null;
  // after the class round is saved, later rounds on this page are solo (else a replay would overwrite the class score)
  const detachClass = () => MC.leaveSession();
  const uname = () => (MC.session && MC.session.username) || (MC.user && MC.user.username) || null;

  // remember the Game each shift creates (showResults sets G to null)
  const origStart = startShift;
  startShift = function(){
    const out = origStart.apply(this, arguments); cur = G; reported = false;
    if(shared){ classG = G; shareCustomers(G, shared); shared = null; }      // the class shift: same customers for everyone
    else if(board && board.el){ board.el.remove(); }                         // a later solo shift: no class board
    return out;
  };

  /* Class game: every student gets the same customers. Arrivals follow a fixed timetable in class time (time since the
     synchronised start; a late joiner starts part-way along it), and customer k's details (recipe, slices, name, look,
     patience) come from their own seeded stream MC.seed('slice|cust'+k), so serving, misses and particles never shift
     who comes next. If the counter is full when a customer is due, they wait until there's room; if the next one is due
     by then, the earlier one is skipped, so everyone stays on the same timetable. */
  function shareCustomers(g, o){
    const D = o.dur, off = Math.max(0, D - g.cfg.duration), P = CONTENT.phases;
    const phaseAt = T => { const f = T / D; return P.find(p => f >= p.start && f < p.end) || P[P.length - 1]; };
    g.phase = function(){ return phaseAt(off + this.t); };
    const arr = MC.seed('slice|arrivals'), times = []; let T = 3;
    const due = now => {   // grow the timetable up to `now`
      while(T <= now){ times.push(T); const ph = phaseAt(T);
        if(ph.every) T += ph.every * (0.85 + arr() * 0.3);
        else { const nx = P.find(p => p.start > ph.start && p.every); T = nx ? nx.start * D : Infinity; } }
    };
    let next = 0;
    const log = window.__mcSliceCustomers = [];
    const NAMES = CONTENT.names.slice();
    function spawnSlot(k){
      const atCounter = g.spots.filter(Boolean), used = new Set(atCounter.map(c => c.name));
      const usedCols = atCounter.map(c => c.look.brick && c.look.brick.col);
      const nr = MC.seed('slice|name' + k); let ni = Math.floor(nr() * NAMES.length);
      for(let i = 0; i < NAMES.length && used.has(NAMES[ni]); i++) ni = (ni + 1) % NAMES.length;
      const bl = typeof brickCustomerLook === 'function' ? brickCustomerLook : null, ids = g.ids;
      let ok = false;
      CONTENT.names = [NAMES[ni]];
      if(bl) brickCustomerLook = () => { const L = bl([]); for(let i = 0; i < 9 && usedCols.includes(L.col); i++) L.col = (L.col + 1) % 9; return L; };
      try{ ok = MC.withSeed('slice|cust' + k, () => Game.prototype.spawn.call(g)); }
      finally{ CONTENT.names = NAMES; if(bl) brickCustomerLook = bl; }
      if(ok){
        const c = g.spots.find(x => x && x.id === g.ids && g.ids > ids);
        if(c) log.push({ k, name:c.name, recipe:c.order.recipe, slices:c.order.slices, patience:Math.round(c.maxPatience), look:[c.look.skin, c.look.hair, c.look.hc, c.look.acc, c.look.shirt].join('') + (c.look.brick ? '/' + c.look.brick.col + (c.look.brick.hat || '') : '') });
      }
      return ok;
    }
    const tick0 = Game.prototype.tick;
    g.tick = function(dt){
      this.nextSpawn = Infinity;            // the game's own arrival timer is off: the class timetable below decides
      tick0.call(this, dt);
      if(this.ended) return;
      const now = off + this.t; due(now);
      const k = times.length - 1;
      if(k < next || !(times[k] <= now)) return;
      const ph = this.phase();
      const waiting = this.spots.filter(c => c && (c.state === 'waiting' || c.state === 'ordered')).length;
      if(ph.every && waiting < ph.max && spawnSlot(k)) next = k + 1;
    };
  }

  // a shift's results screen: report it once
  const origResults = showResults;
  showResults = function(r){
    const out = origResults.apply(this, arguments);
    if(!reported){
      reported = true;
      const mins = classMinutes != null ? classMinutes : Math.round(r.duration / 60);
      MC.result({ score:r.score, correct:r.correct, answered:r.attempted, seconds:r.duration, variant:mins + ' min',
                  details:{ profit:Math.round(r.profit), served:r.served, stars:r.stars, lost:r.lost, accuracy:Math.round(r.acc * 100), topic:SETTINGS.topic, difficulty:MATHS_DIFF } });
      if(r.duration % 60){   // a late joiner's shortened class shift: tidy "4.8333-minute shift"
        const sub = document.querySelector('#results .sub');
        if(sub) sub.textContent = sub.textContent.replace(/^[\d.]+-minute/, Math.max(1, Math.round(r.duration / 60)) + '-minute');
      }
      if(classMinutes != null){ SETTINGS.duration = classMinutes * 60; classMinutes = null; detachClass(); }   // "Play again" runs a normal-length solo shift
    }
    return out;
  };

  // the round-end board: real username instead of "You"; in a class game point at the teacher's screen
  const origLB = window.showLeaderboard;
  window.showLeaderboard = function(cfg){
    const n = uname();
    if(cfg && n){
      const fix = e => e && e.you ? Object.assign({}, e, { name:n }) : e;
      if(cfg.entries) cfg = Object.assign({}, cfg, { entries:cfg.entries.map(fix) });
    }
    if(cfg && MC.session && MC.session.started) cfg = Object.assign({}, cfg, { note:'Class game: the real class leaderboard is on your teacher’s screen. These classmates are samples.' });
    return origLB.call(this, cfg);
  };

  MC.register({
    game:'slice-rush',
    start(ctx){
      const s = ctx.settings || {};
      if(['easy','medium','hard'].includes(s.difficulty)){
        MATHS_DIFF = s.difficulty;
        document.querySelectorAll('#mdiff [data-v]').forEach(b => { const on = b.dataset.v === s.difficulty; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      }
      SETTINGS.topic = s.topic && QS.topics().some(t => t.id === s.topic) ? s.topic : 'mixed';
      classMinutes = Math.max(1, Math.round(+s.minutes || 10));
      SETTINGS.duration = Math.max(30, Math.round(ctx.remainingSeconds || classMinutes * 60));
      shared = { dur:Math.max(SETTINGS.duration, classMinutes * 60) };
      // live class leaderboard: top right under the HUD bar, clear of the clock, wallet/till and the counter
      if(!board){
        board = MC.classBoard({ score:() => classG ? classG.results().score : null, fmt:v => String(Math.round(v)),
          pos:{ top:'calc(70px + env(safe-area-inset-top,0px))', right:'10px' } });
        // the kitchen and the counter are busy everywhere, so the board sits in the Supply Desk itself, under the
        // Bronze/Silver/Gold buttons: the question card makes room for it (its prompt scrolls if a diagram is tall)
        const desk = document.querySelector('.desk'), tiers = document.getElementById('tiers');
        if(board.el && desk && tiers){
          const st = document.createElement('style');
          st.textContent = '.desk .mc-cboard{position:relative!important;inset:auto!important;width:auto!important;margin:8px 12px 0;flex:none;z-index:2;backdrop-filter:none;box-shadow:none}'
            + '.desk .mc-cboard ol{grid-template-columns:1fr 1fr;column-gap:8px}.desk .mc-cboard li.gap{grid-column:1/-1}'
            + '@media (orientation:portrait){.desk .mc-cboard ol{grid-template-columns:1fr 1fr 1fr}}';
          document.head.appendChild(st);
          tiers.after(board.el);
        }
      }
      // close whatever screen is showing, then go straight into the shift
      ['#title', '.howto', '#results', '.lb-ov'].forEach(q => document.querySelectorAll(q).forEach(el => el.remove()));
      startShift();
    },
    live(){
      const g = cur; if(!g) return { score:0, correct:0, answered:0, status:'Starting', finished:false };
      const att = g.stats.attempts;
      return { score:g.results().score, correct:att.filter(a => a.correct).length, answered:att.length,
               status:g.stats.served + (g.stats.served === 1 ? ' pizza' : ' pizzas') + ' served', finished:g.ended && reported };
    },
  });
})();
