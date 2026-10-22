/* Treasure Isles <-> Mathcade online */
(function(){
  let correct = 0, answered = 0, reported = false, played = false, classTeam = null, classMinutes = null;
  // after the class round is saved, later rounds on this page are solo (else a replay would overwrite the class score)
  const detachClass = () => MC.leaveSession();
  const uname = () => (MC.session && MC.session.username) || (MC.user && MC.user.username) || null;

  // the game has no maths counters: count answers here (same guard as the game's own answer())
  const origAnswer = answer;
  answer = function(i){
    if(!(qLock || !Q || !running)){ answered++; if(i === Q.correctIndex) correct++; }
    return origAnswer.apply(this, arguments);
  };
  window.answer = answer;   // typed-answer questions call window[handler]

  /* ---------- one shared sea for the whole class ----------
     In the class round every iPad builds the same world from the class code:
     - the map (islands are fixed already; palms/rocks on them come from MC.withSeed('treasure-map')),
     - the practice fleet (the same 36 starting places and crews: MC.withSeed('treasure-fleet')),
     - the opening chests (MC.seed('treasure-chests-0')) and every later chest: chest event j appears
       j*CHEST_EVERY seconds after the teacher's synchronised start, with its spot and tier from its own
       stream MC.seed('treasure-chest-' + j), so nothing the student does can shift the sequence.
     The practice pirates make their decisions from their own stream (MC.seed('treasure-bots')) on a fixed
     60 Hz step, so they sail the same way on every iPad until a student's own play gets in their way
     (taking the chest a pirate was heading for, or firing at it). */
  const CHEST_EVERY = 1.5;            // seconds between chest events (solo games refill ~0.55 chests/s)
  let fleetStart = [], classRound = false, nextEvent = 0, roundClock0 = 0, botRng = null, acc = 0, classBoardUI = null, classDoneLoot = null;
  const seeded = (tag, fn) => classRound ? MC.withSeed(tag, fn) : fn();
  function classClock(){       // seconds since the teacher's synchronised start (same on every iPad)
    const S = MC.session;
    if(S && S.startsAt) return (Date.now() + (S.offset || 0) - S.startsAt) / 1000;
    return (performance.now() - roundClock0) / 1000;
  }
  function seededTier(rng){ const e = Object.entries(CONFIG.CHEST); let r = rng() * e.reduce((a, [, c]) => a + c.weight, 0); for(const [k, c] of e){ r -= c.weight; if(r <= 0) return k; } return 'bronze'; }
  /* pick a shore spot with rng: the first of a seeded list of candidates that is clear of other chests
     (and, for the opening chests, of the starting fleet, which is the same for everyone) */
  function seededChest(rng, avoidShips){
    for(let i = 0; i < 16; i++){
      const s = shoreSpots[Math.floor(rng() * shoreSpots.length)], tier = seededTier(rng);
      if(!s || chests.some(c => Math.hypot(c.x - s.x, c.y - s.y) < T * 1.6)) continue;
      if(avoidShips && ships.some(sh => Math.hypot(sh.x - s.x, sh.y - s.y) < T * 2.5)) continue;
      return { ...s, tier, q:CONFIG.CHEST[tier].q, progress:0, opener:null, t:0 };
    }
    return null;
  }
  function chestEvent(j){ return seededChest(MC.seed('treasure-chest-' + j), false); }
  const origBuild = buildMap;
  buildMap = function(){ return seeded('treasure-map', () => origBuild.apply(this, arguments)); };
  const origSpawn = spawnChest;
  spawnChest = function(){ if(classRound) return; return origSpawn.apply(this, arguments); };   // class round: chests come from the shared schedule
  const origStep = step;
  step = function(dt){
    if(!classRound) return origStep(dt);
    acc += dt; let n = 0;
    while(acc >= 1 / 60 && n++ < 6){ acc -= 1 / 60; origStep(1 / 60); }     // fixed step: the same pirate moves on every iPad
    if(n > 6) acc = 0;
    if(running){ const now = classClock();
      while((nextEvent + 1) * CHEST_EVERY <= now){ const c = chests.length < CONFIG.MAX_CHESTS ? chestEvent(nextEvent) : null; if(c) chests.push(c); nextEvent++; } }
  };
  // pirate decisions (and the time they take to answer a chest) use the pirates' own random stream
  const botOnly = (fn, shipArg) => function(){
    const sh = arguments[shipArg];
    if(!classRound || !botRng || !sh || sh.you) return fn.apply(this, arguments);
    const was = Math.random; Math.random = botRng; try{ return fn.apply(this, arguments); } finally{ Math.random = was; }
  };
  rivalStep = botOnly(rivalStep, 0);
  startOpen = botOnly(startOpen, 1);

  // class game: put the student's ship (ships[0]) in their class crew; show their username
  const origMake = makeShips;
  makeShips = function(){
    const out = seeded('treasure-fleet', () => origMake.apply(this, arguments));
    const me = ships[0];
    if(classTeam && crewList().includes(classTeam) && me.team !== classTeam){
      const j = ships.findIndex((s, k) => k > 0 && s.team === classTeam);
      if(j > 0){
        const o = ships[j];
        for(const k of ['team', 'col', 'sprite', 'x', 'y', 'a']){ const v = me[k]; me[k] = o[k]; o[k] = v; }
      }
    }
    const n = uname(); if(n) me.name = n;
    fleetStart = ships.map(s => [Math.round(s.x), Math.round(s.y), s.team].join(','));
    return out;
  };

  const origStart = start;
  start = function(){
    correct = 0; answered = 0; reported = false; played = true;
    if(classRound){ botRng = MC.seed('treasure-bots'); acc = 0; roundClock0 = performance.now(); }
    else if(classBoardUI && classBoardUI.el) classBoardUI.el.style.display = 'none';   // a solo replay after the class round
    const out = origStart.apply(this, arguments);
    if(classRound){
      chests = []; const rng = MC.seed('treasure-chests-0');
      for(let i = 0; i < CONFIG.MAX_CHESTS - 4; i++){ const c = seededChest(rng, true); if(c) chests.push(c); }
      nextEvent = Math.max(0, Math.floor(classClock() / CHEST_EVERY));   // a late joiner picks the schedule up where the class is
    }
    return out;
  };

  const origEnd = end;
  end = function(){
    const out = origEnd.apply(this, arguments);
    if(played && !reported){
      reported = true;
      const me = you(), tots = {};
      crewList().forEach(t => { tots[t] = ships.filter(s => s.team === t).reduce((a, s) => a + s.loot, 0); });
      const best = Math.max(...Object.values(tots)), won = tots[me.team] === best && Object.values(tots).filter(v => v === best).length === 1;
      const mins = classMinutes != null ? classMinutes : Math.round(CONFIG.DURATION / 60);
      MC.result({ score:me.loot, correct, answered, seconds:CONFIG.DURATION, variant:mins + ' min',
                  details:{ crew:me.team, crews:crewList().length, crewTotals:tots, crewWon:won, topic:topicId, difficulty:MATHS_DIFF } });
      if(classRound){ classRound = false; classDoneLoot = me.loot; }
      if(classMinutes != null){ CONFIG.DURATION = classMinutes * 60; classMinutes = null; detachClass(); }   // "Sail again" plays a normal-length solo game
      const sel = document.getElementById('topic'); if(sel) sel.disabled = false;
    }
    return out;
  };

  // round-end board: in a class game point at the teacher's screen
  const origLB = window.showLeaderboard;
  window.showLeaderboard = function(cfg){
    if(cfg && MC.session && MC.session.started) cfg = Object.assign({}, cfg, { note:'Class game: the whole class sailed this same sea. Your crew’s real total is on your teacher’s screen; the other ships here are practice pirates.' });
    return origLB.call(this, cfg);
  };

  // the game's own `.alt{width:100%;padding:9px 0 12px}` also hits the online lobby's "Leave" button
  const css = document.createElement('style');
  css.textContent = '.mc-ui .mc-btn.alt{width:auto;padding:12px 20px}.mc-ui .mc-btn.alt.wide{width:100%}';
  document.head.appendChild(css);

  /* live class leaderboard (everyone's loot), in the top-right corner of the sea: clear of the top bar,
     the question panel (right in landscape, bottom in portrait), the tip (top centre) and the minimap/stick (bottom left) */
  function mountClassBoard(){
    if(classBoardUI) return;
    classBoardUI = MC.classBoard({ label:'Class leaderboard', fmt:v => String(Math.round(v)),
      score:() => classDoneLoot != null ? classDoneLoot : (ships.length ? you().loot : null) });
    const el = classBoardUI.el, sea = document.querySelector('.sea');
    if(el && sea){ sea.appendChild(el); Object.assign(el.style, { position:'absolute', top:'58px', right:'10px', left:'auto', bottom:'auto', zIndex:'6', width:'min(210px,40%)' }); }
  }
  window.treasureClass = { chestEvent, get on(){ return classRound; }, get next(){ return nextEvent; }, get fleetStart(){ return fleetStart.slice(); }, get board(){ return classBoardUI; }, every:CHEST_EVERY };   // for tests

  function whenBooted(fn, tries){
    if(ships.length) return fn();
    if((tries || 0) > 300) return console.warn('Treasure Isles: game never booted');
    setTimeout(() => whenBooted(fn, (tries || 0) + 1), 50);
  }

  MC.register({
    game:'treasure',
    start(ctx){
      const s = ctx.settings || {};
      whenBooted(() => {
        if(['easy','medium','hard'].includes(s.difficulty)){
          MATHS_DIFF = s.difficulty;
          document.querySelectorAll('#mdiff [data-v]').forEach(b => { const on = b.dataset.v === s.difficulty; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
          const sub = document.getElementById('mdSub'); if(sub) sub.textContent = MATHS_DIFF_TEXT[MATHS_DIFF];
        }
        crewCount = String(s.crews) === '4' ? 4 : 2;
        document.querySelectorAll('#modes button').forEach(b => b.classList.toggle('on', +b.dataset.c === crewCount));
        topicId = s.topic && QBANK.ALL_TOPICS.some(t => t.id === s.topic) ? s.topic : 'mixed';
        const sel = document.getElementById('topic'); if(sel){ sel.value = topicId; sel.disabled = true; sel.title = 'Your teacher chose this topic'; }
        const team = String(ctx.team || '').toLowerCase();
        classTeam = TEAMS[team] ? team : null;
        classMinutes = Math.max(1, Math.round(+s.minutes || 5));
        CONFIG.DURATION = Math.max(30, Math.round(ctx.remainingSeconds || classMinutes * 60));
        document.getElementById('setup').classList.remove('show');
        document.getElementById('over').classList.remove('show');
        document.querySelectorAll('.lb-ov').forEach(el => el.remove());
        classRound = true; classDoneLoot = null;
        start();
        mountClassBoard();
      });
    },
    live(){
      if(!ships.length) return { score:0, correct:0, answered:0, status:'Starting', finished:false };
      const me = you();
      return { score:me.loot, correct, answered, status:TEAMS[me.team].name, finished:reported };
    },
  });
  // solo: the player's ship carries their username
  MC.onUser(u => { if(u && ships[0] && !MC.session) ships[0].name = u.username; });
})();
