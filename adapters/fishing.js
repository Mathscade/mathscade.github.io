/* Fishing Fury <-> Mathcade online */
(function(){
  const variant = () => Math.round(Game.duration / 60) + ' min';
  let inClass = false;   // set when the class game starts (start(ctx))
  let fresh = null;       // the account's current look from the server (a class page keeps the cached user, which can be stale)
  const pickCss = document.head.appendChild(document.createElement('style'));
  // save the result whenever the round's results screen appears
  const show = Results.show;
  Results.show = function(){
    const first = !this.shown, out = show.apply(this, arguments);
    if(first){
      const st = Game.stats;
      MC.result({ score:Game.score, correct:st.correct, answered:st.answered, seconds:Game.duration, variant:variant(),
                  details:{ fish:st.caught, deepest:st.deepest, best:st.best ? st.best.name : null } });
    }
    return out;
  };

  /* ---------- one lake for the whole class ----------
     In a class game the lake's content comes from class-seeded streams, keyed on game time since the
     synchronised start (late joiners skip ahead), so it never drifts with what the player does:
     - the starting fish: stream 'fish-start';
     - new fish: every 0.25 s slot each zone rolls its own stream ('fz<zone>:<slot>') and, if the zone has room,
       that slot's fish (species, rarity, side, depth, size, speed, points) swims in;
     - every lake fish swims with its own stream (pauses, darts, turns), so it moves the same on every iPad;
     - ambient deep-water sharks: one stream per shark ('shark-amb:<n>'), scheduled on the game clock;
     - shark attacks when a line reaches depth: rolled from the stream of that zone and 2 s slot, so
       students fishing the same zone at the same time meet the same shark and pattern.
     Player luck stays the player's own: which fish go for the bait, escapes, fish that come to a waiting hook,
     particles. Solo play is unchanged. */
  const SLOT = 0.25, SLOT_P = 1 - Math.exp(-1.8 * SLOT);   // the solo game's 3 % per frame at 60 fps = 1.8 fish/s
  let cls = false, offset = 0, lastSlot = 0, fishTag = null, fishK = 0, sharkTag = null, sharkK = 0, ambN = 0, ambAt = 8;
  const log = { fish:[], sharks:[] };
  const gameT = () => offset + (Game.duration - Game.timeLeft);
  const withR = (r, fn) => { const was = Math.random; Math.random = r; try{ return fn(); } finally{ Math.random = was; } };
  const r2 = v => Math.round(v * 100) / 100;

  const oSpawn = Spawner.spawn;
  Spawner.spawn = function(){
    const out = oSpawn.apply(this, arguments), f = fishes[fishes.length - 1];
    if(cls && fishTag && f){
      const tag = fishTag + (fishK++ ? '.' + fishK : '');
      f.rng = MC.seed('fish-swim:' + tag);
      log.fish.push({ tag, t:r2(gameT()), sp:f.sp.id, dir:f.dir, depth:r2(f.depth), pts:f.pts, size:r2(f.size / World.k), speed:r2(f.speed / World.k), x:fishTag === 'start' ? r2(f.x / World.w) : null });
    }
    return out;
  };
  const oSeed = Spawner.seed;
  Spawner.seed = function(){
    if(!cls) return oSeed.apply(this, arguments);
    fishTag = 'start'; fishK = 0;
    try{ return MC.withSeed('fish-start', () => oSeed.apply(this, arguments)); } finally{ fishTag = null; }
  };
  const oKeep = Spawner.keepPopulation;
  Spawner.keepPopulation = function(){
    if(!cls) return oKeep.apply(this, arguments);
    const now = Math.floor(gameT() / SLOT);
    for(let k = Math.max(lastSlot + 1, now - 8); k <= now; k++) CONFIG.ZONES.forEach((z, zi) => {
      const r = MC.seed('fz' + zi + ':' + k);
      if(r() >= SLOT_P) return;
      const n = fishes.filter(f => f.state === 'free' && World.zoneOf(f.depth) === zi).length;
      if(n >= CONFIG.POPULATION[zi]) return;
      fishTag = 's' + k + 'z' + zi; fishK = 0;
      try{ withR(r, () => this.spawn(zi, {})); } finally{ fishTag = null; }
    });
    lastSlot = Math.max(lastSlot, now);
  };
  // lake fish swim with their own stream (a fish going for the bait / hooked is the player's business)
  const oMove = moveFish;
  moveFish = function(f){ return f.rng && f.state === 'free' ? withR(f.rng, () => oMove.apply(this, arguments)) : oMove.apply(this, arguments); };

  const oLaunch = Sharks.launch;
  Sharks.launch = function(){
    const s = oLaunch.apply(this, arguments);
    if(cls && sharkTag && s){
      const tag = sharkTag + (sharkK++ ? '.' + sharkK : '');
      s.rng = MC.seed('shark-swim:' + tag);
      log.sharks.push({ tag, t:r2(gameT()), pattern:s.pattern, depth:r2(s.depth), dir:s.dir, speed:r2(s.speed / World.k), weave:r2(s.weave), turns:s.turns });
    }
    return s;
  };
  for(const m of ['planTurn', 'startTurn', 'stepTurn']){
    const o = Sharks[m];
    Sharks[m] = function(s){ return cls && s && s.rng ? withR(s.rng, () => o.apply(this, arguments)) : o.apply(this, arguments); };
  }
  // A fake-out shark heading for the line plans where to turn; with too little room on a narrow screen the solo game
  // sends it in from the other side instead, which made the same class shark differ between iPads. In the class lake it
  // still turns (as late as this screen allows), drawing the same random number, so every screen keeps the same shark.
  const oPlan = Sharks.planTurn;
  Sharks.planTurn = function(s){
    const done = oPlan.apply(this, arguments);
    if(done || !cls || !s || s.dir * (World.lineX() - s.x) <= 0) return done;
    const lx = World.lineX(), from = s.dir > 0 ? Math.max(0, s.x) : Math.min(World.w, s.x), r = (s.rng || Math.random)();
    const room = Math.max(0, Math.abs(lx - from) - s.len * 0.8 - s.cruise * 0.55 / 2);
    s.turnX = from + s.dir * room * r; return true;
  };
  const oRoll = Sharks.rollForAttempt;
  Sharks.rollForAttempt = function(depth){
    if(!cls) return oRoll.apply(this, arguments);
    const zi = World.zoneOf(depth), k = Math.floor(gameT() / 2);
    sharkTag = 'hit' + zi + ':' + k; sharkK = 0;
    try{ return withR(MC.seed('shark-att:' + zi + ':' + k), () => oRoll.apply(this, arguments)); } finally{ sharkTag = null; }
  };
  const oStep = Sharks.step;
  Sharks.step = function(){
    if(cls){
      this.ambientT = 1e9;   // the class schedule below replaces the solo game's random ambient sharks
      while(Game.running && gameT() >= ambAt){
        const r = MC.seed('shark-amb:' + ambN), late = gameT() - ambAt > 3, gap = 9 + r() * 10;
        if(!late){ sharkTag = 'amb' + ambN; sharkK = 0;
          try{ withR(r, () => this.launch(72 + r() * 50, { warn:false, pattern:this.pick(CONFIG.SHARK_AMBIENT) })); } finally{ sharkTag = null; } }
        ambAt += gap; ambN++;
      }
    }
    return oStep.apply(this, arguments);
  };
  window.mcFishing = { log, gameT, get classLake(){ return cls; } };

  const BOARD_POS = { top:'128px', right:'12px' };
  MC.register({
    game:'fishing',
    start(ctx){
      const s = ctx.settings;
      if(s.difficulty){ MATHS_DIFF = s.difficulty; document.querySelectorAll('#mdiff [data-v]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === s.difficulty)); }
      if(s.topic && [...$('#startTopic').options].some(o => o.value === s.topic)) $('#startTopic').value = s.topic;
      // class game: the teacher's difficulty and topic are locked in, so students don't see those choices
      inClass = true; lockPicker();
      Start.duration = Math.max(30, Math.round(ctx.remainingSeconds || (+s.minutes || 10) * 60));
      SAVE.player.name = ctx.username;
      // game time since the synchronised start (a late joiner starts part-way through the class's lake)
      const total = (+s.minutes || 10) * 60;
      offset = ctx.remainingSeconds ? Math.max(0, total - Start.duration) : 0;
      cls = !!MC.classCode(); lastSlot = Math.floor(offset / SLOT); ambN = 0; ambAt = 8;
      const b = Start.begin;   // only the class round uses the class lake ("play again" afterwards is solo practice)
      Start.begin = function(){ if(cls && Game.duration && Results.shown){ cls = false; Sharks.ambientT = 8; } return b.apply(this, arguments); };
      Start.begin();
      const board = MC.classBoard({ score:() => Game.stats && (Game.running || Results.shown) ? Game.score : null, lower:false,
                      fmt:v => Math.round(v).toLocaleString() + ' pts', label:'Class leaderboard', pos:BOARD_POS });
      // keep it inside the lake's top-right corner just below the water line: under the coach tip and clear of the
      // boat (the side panel's question and bait shop sit beside the lake on a landscape iPad / laptop, below it in portrait)
      const place = () => { const el = board.el, cv = document.getElementById('cv'), lake = cv && cv.parentElement; if(!el || !lake) return;
        const r = lake.getBoundingClientRect(); el.style.top = Math.round(r.top + Math.max(64, World.sky + 14)) + 'px'; el.style.right = Math.max(8, Math.round(innerWidth - r.right + 10)) + 'px'; };
      setInterval(place, 500); addEventListener('resize', place);
    },
    live(){ return { score:Game.score, correct:Game.stats.correct, answered:Game.stats.answered, status:Game.stats.caught + ' fish', finished:!Game.running && Results.shown }; },
  });
  if(MC.user) SAVE.player.name = MC.user.username;
  MC.onUser(u => { if(u) SAVE.player.name = u.username; lockPicker(); boatLook(u); });

  /* ---------- the question tiers (Easy $5 / Medium $10 / Hard $20) and the topic box ----------
     Only a teacher playing solo may change them. Students (and class games) answer at one pay rate with the
     teacher's / start screen's topic and difficulty. */
  function lockPicker(){
    const u = MC.user, lock = inClass || !(u && u.role === 'teacher');
    pickCss.textContent = lock ? '#tiers,#topic{display:none!important}' : '';
    if(lock && Maths.tier !== 'medium'){ Maths.tier = 'medium'; Maths.renderTiers(); if(Game.running && !Maths.bonusType && !Maths.locked) Maths.next(); }
  }
  // (clicks on a hidden tier can't happen, but keep the rate fixed even if something re-shows them)
  document.getElementById('tiers').addEventListener('click', e => { if(pickCss.textContent) e.stopImmediatePropagation(); }, true);
  document.getElementById('topic').addEventListener('change', e => { if(pickCss.textContent) e.stopImmediatePropagation(); }, true);
  lockPicker();

  /* ---------- the angler in the boat is the student's own Brick (default Brick when nobody is logged in) ---------- */
  function boatLook(u){ if(!window.Brick || typeof Fisher === 'undefined') return;
    Fisher.setLook(u ? Brick.lookOf(fresh && fresh.username === u.username ? fresh : u) : null); }
  boatLook(MC.user);
  if(MC.user && MC.token && MC.token() && new URLSearchParams(location.search).get('join'))
    MC.rpc('mc_me', { p_token:MC.token() }).then(u => { if(u && MC.user && u.username === MC.user.username){ fresh = u; boatLook(MC.user); } }).catch(() => {});
  // read-only hook for tests: the look the boat wants and the look it last drew
  window.mcFishingBoatLook = () => window.Brick && typeof Fisher !== 'undefined'
    ? { want:Brick.lookKey(Fisher.look || Brick.lookOf(null)), drawn:Fisher.drawn, user:MC.user ? MC.user.username : null } : null;
})();
