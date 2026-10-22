/* Carnival Sharpshooter <-> Mathcade online
   The game's code lives inside a closure, so this adapter works through what it exposes:
   window.__sharp.round (the current Round), the setup screen's controls and window.showLeaderboard. */
(function(){
  const WAIT = new URLSearchParams(location.search).get('wait');
  if(WAIT){ waitingRoom(); return; }
  const done = new WeakSet();
  let last = null, classMinutes = null, classSeconds = null, classRound = null, board = null;
  // class game: every student gets the same targets (see setRng in the game: per-lane / per-target seeded streams)
  const shareTargets = on => { if(window.__sharp && window.__sharp.setRng) window.__sharp.setRng(on ? tag => MC.seed('sharp|' + tag) : null); };
  // after the class round is saved, later rounds on this page are solo (else a replay would overwrite the class score)
  const detachClass = () => MC.leaveSession();
  const uname = () => (MC.session && MC.session.username) || (MC.user && MC.user.username) || null;
  const round = () => (window.__sharp && window.__sharp.round) || null;

  // watch for each round ending (Round.end() sets phase 'over') and report it once
  setInterval(() => {
    const r = round(); if(!r) return;
    if(r !== last){
      last = r;
      if(classSeconds != null && r.phase === 'ready'){ r.duration = r.timeLeft = classSeconds; classSeconds = null; }   // class game: teacher's time left
    }
    if(r.phase === 'over' && !done.has(r)){
      done.add(r);
      const mins = classMinutes != null ? classMinutes : Math.round(r.duration / 60);
      MC.result({ score:r.score, correct:r.reloads, answered:r.reloads + r.wrong, seconds:r.duration, variant:mins + ' min',
                  details:{ hits:r.hits, shots:r.shots, accuracy:Math.round(r.accuracy * 100), difficulty:r.difficulty, topic:r.topic,
                             fastHits:r.fastHits || 0, upgradeSpent:r.spent || 0, magazine:r.cap || 3 } });   // score is after any upgrade spending
      if(classMinutes != null){ classMinutes = null; shareTargets(false); detachClass();
        const pos = document.getElementById('posV'); if(pos && pos.parentElement) pos.parentElement.style.display = ''; }   // later solo rounds: random targets again
    }
  }, 150);

  // round-end board: real username instead of "You"
  const origLB = window.showLeaderboard;
  window.showLeaderboard = function(cfg){
    const n = uname();
    if(cfg && n && cfg.entries) cfg = Object.assign({}, cfg, { entries:cfg.entries.map(e => e && e.you ? Object.assign({}, e, { name:n, initial:n[0] }) : e) });
    if(cfg && MC.session && MC.session.started) cfg = Object.assign({}, cfg, { note:'Class game: the real class leaderboard is on your teacher’s screen. These classmates are simulated.' });
    return origLB.call(this, cfg);
  };

  // wait for the setup screen (it appears once the art has loaded)
  function whenSetup(fn, tries){
    const go = document.getElementById('goBtn');
    if(go) return fn(go);
    if((tries || 0) > 200) return console.warn('Sharpshooter: setup screen never appeared');
    setTimeout(() => whenSetup(fn, (tries || 0) + 1), 50);
  }
  function openSetup(){
    // from the results board, "Change settings" brings the setup back: use it so the game resets itself properly
    const b = [...document.querySelectorAll('.lb-ov .lb-foot button')].find(x => /settings/i.test(x.textContent));
    if(b) b.click();
  }

  MC.register({
    game:'sharpshooter',
    start(ctx){
      const s = ctx.settings || {};
      classMinutes = Math.max(1, Math.min(30, Math.round(+s.minutes || 3)));
      classSeconds = Math.max(20, Math.round(ctx.remainingSeconds || classMinutes * 60));
      if(!document.getElementById('goBtn')) openSetup();
      whenSetup(go => {
        if(['easy','medium','hard'].includes(s.difficulty)){ const b = document.querySelector(`#setDiff [data-v="${s.difficulty}"]`); if(b) b.click(); }
        const sel = document.getElementById('topicSel');
        if(sel) sel.value = s.topic && [...sel.options].some(o => o.value === s.topic) ? s.topic : 'auto';
        // the minutes stepper only takes whole minutes: step it to the teacher's value (the exact time left is set on the round)
        const st = document.getElementById('setMin'), out = st && st.querySelector('output');
        for(let i = 0; st && out && i < 40; i++){
          const v = parseInt(out.textContent, 10); if(v === classMinutes) break;
          st.dispatchEvent(new KeyboardEvent('keydown', { key:v < classMinutes ? 'ArrowUp' : 'ArrowDown', bubbles:true }));
        }
        // don't overwrite the student's own saved settings with the teacher's
        let saved = null; try{ saved = localStorage.getItem('mathcade_sharp_settings'); }catch(e){}
        shareTargets(true);
        go.click();
        try{ saved == null ? localStorage.removeItem('mathcade_sharp_settings') : localStorage.setItem('mathcade_sharp_settings', saved); }catch(e){}
        const r = round(); classRound = r;
        if(r && classSeconds != null){ r.duration = r.timeLeft = classSeconds; classSeconds = null; last = r; }
        // live class leaderboard: top right, just under the HUD bar (over the canopy, clear of the ammo / upgrade bar and the reload card)
        // in two columns, so even a full board (top 5 + you) stays about as tall as the canopy, above the sky targets
        if(!board){
          board = MC.classBoard({ score:() => classRound ? classRound.score : null, fmt:v => String(Math.round(v)),
            pos:{ top:'calc(66px + env(safe-area-inset-top,0px))', right:'10px' } });
          const st = document.createElement('style');
          st.textContent = '.mc-cboard:not(.mini){width:min(390px,48vw)!important}.mc-cboard ol{grid-template-columns:1fr 1fr;column-gap:8px}.mc-cboard li.gap{display:none!important}';
          document.head.appendChild(st);
        }
        // the HUD's "Position x/24" is against simulated practice rivals: hide it while the real class board is up
        const pos = document.getElementById('posV'); if(pos && pos.parentElement) pos.parentElement.style.display = 'none';
      });
    },
    live(){
      const r = round() || last;
      if(!r) return { score:0, correct:0, answered:0, status:'Starting', finished:false };
      return { score:r.score, correct:r.reloads, answered:r.reloads + r.wrong,
               status:r.hits + (r.hits === 1 ? ' hit' : ' hits') + ' · ' + r.reloads + (r.reloads === 1 ? ' reload' : ' reloads') + (r.cap > 3 ? ' · ' + r.cap + '-shot gun' : ''),
               finished:done.has(r) };
    },
  });

  /* Waiting room: the student's home page shows this game in a frame (sharpshooter.html?wait=CODE) while they wait for
     the teacher to start a class game. Same gameplay, but it starts straight away, has no way off the page, never saves a
     score or gives coins itself: it tells the home page its best round and the home page cashes that in (mc_wait_reward). */
  function waitingRoom(){
    if(window.parent === window){ location.replace('index.html'); return; }   // only ever inside the home page
    const q = new URLSearchParams(location.search), st = document.createElement('style');
    st.textContent = '#leaveBtn,#leaveModal,.allgames,.tc-foot,#setup,.title-screen{display:none!important}.lb-foot a{display:none!important}'
      // in the waiting frame the booth only needs a modest frame; only a really tiny one gets the "bigger screen" card
      + '.tooSmall{display:none!important}@media (max-width:360px),(max-height:240px){.tooSmall{display:flex!important}}';
    document.head.appendChild(st);
    const round = () => (window.__sharp && window.__sharp.round) || null;
    const inst = Math.random().toString(36).slice(2);
    let bestDone = 0;   // best finished round; the round being played counts with its current score (after any upgrade spending)
    const S = { inst, best:0, correct:0, answered:0, rounds:0, score:0, playing:false };
    const seen = new WeakMap();   // round -> answers already counted
    let cur = null;
    const snap = () => {
      const r = round();
      if(r){
        if(r !== cur){ cur = r; seen.set(r, { c:0, a:0, over:false }); }
        const k = seen.get(r), c = r.reloads | 0, a = (r.reloads + r.wrong) | 0;
        S.correct += c - k.c; S.answered += a - k.a; k.c = c; k.a = a;
        if(r.phase === 'over' && !k.over){ k.over = true; S.rounds++; bestDone = Math.max(bestDone, Math.max(0, r.score | 0)); }
        S.best = Math.max(bestDone, Math.max(0, r.score | 0));
        S.score = r.score | 0; S.playing = r.phase !== 'over';
      }
      return Object.assign({}, S);
    };
    window.__mcWait = snap;
    const post = type => { try{ window.parent.postMessage(Object.assign({ type }, snap()), location.origin); }catch(e){} };
    setInterval(() => post('mc-wait-state'), 300);
    // the end-of-round board: real name, no "All games" / "Change settings", just Play again
    const origLB = window.showLeaderboard;
    window.showLeaderboard = function(cfg){
      const n = MC.user && MC.user.username;
      if(cfg && n && cfg.entries) cfg = Object.assign({}, cfg, { entries:cfg.entries.map(e => e && e.you ? Object.assign({}, e, { name:n, initial:n[0] }) : e) });
      if(cfg) cfg = Object.assign({}, cfg, { note:'Warm-up round: your best round is cashed in for coins when your class game starts. Classmates here are simulated.',
                                              actions:(cfg.actions || []).filter(a => /again/i.test(a.label)) });
      const out = origLB.call(this, cfg); post('mc-wait-state'); return out;
    };
    whenSetup(go => {
      const diff = ['easy','medium','hard'].includes(q.get('diff')) ? q.get('diff') : 'medium';
      const b = document.querySelector(`#setDiff [data-v="${diff}"]`); if(b) b.click();
      const sel = document.getElementById('topicSel'), t = q.get('topic');
      if(sel) sel.value = t && [...sel.options].some(o => o.value === t) ? t : 'auto';
      const stp = document.getElementById('setMin'), out = stp && stp.querySelector('output');
      for(let i = 0; stp && out && i < 40; i++){
        const v = parseInt(out.textContent, 10); if(v === 3) break;
        stp.dispatchEvent(new KeyboardEvent('keydown', { key:v < 3 ? 'ArrowUp' : 'ArrowDown', bubbles:true }));
      }
      let saved = null; try{ saved = localStorage.getItem('mathcade_sharp_settings'); }catch(e){}
      go.click();
      try{ saved == null ? localStorage.removeItem('mathcade_sharp_settings') : localStorage.setItem('mathcade_sharp_settings', saved); }catch(e){}
      post('mc-wait-ready');
    });
  }
})();
