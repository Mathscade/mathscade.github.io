/* Speed Golf <-> Mathcade online
   Score = the round time in seconds (lower is better): the round clock, which excludes teacher pauses,
   plus 30 s for each hole the student picked up. Wrong answers add NO seconds: each one locks the
   student out for 3 s (the clock keeps running) before a new question, so it only costs real time.
   qualified = the game's 70% maths accuracy rule (right ÷ all answers given).
   Variant = `${holes} holes` (there is no penalty setting any more). */
(function(){
  const G = window.SpeedGolf, SC = window.SpeedGolfScoring;
  if(!G || !SC){ console.warn('Mathcade: Speed Golf did not load'); return; }
  const $ = s => document.querySelector(s);
  let classSettings = null, classDone = false, ownSettings = null, board = null;
  const inClass = () => !!(classSettings && !classDone && MC.classCode());

  /* One course for the whole class. The holes themselves are fixed data (same tiles, hazards, movers and par
     for everyone, always in course order); the only random part of a hole is its decoration (sand speckles,
     ice streaks), drawn with Math.random while the hole loads. In a class game each hole loads with its own
     class-seeded stream, so every iPad builds exactly the same hole, whatever happened earlier in the round. */
  const origLoad = G.loadHole;
  G.loadHole = function(i){
    if(inClass()) return MC.withSeed('golf-hole-' + i, () => origLoad.apply(this, arguments));
    return origLoad.apply(this, arguments);
  };
  // the class leaderboard ranks by holes finished (most first), then by the time you finished your latest hole
  // (picked-up holes' +30 s included). One number: holes x 100000 - seconds, shown as "3/9 · 4:12" = 3 of 9 holes done, the 3rd finished at 4:12.
  const origDone = G.holeDone;
  G.holeDone = function(){
    const out = origDone.apply(this, arguments), R = this.round;
    if(R) R.mcSplit = this.elapsed() + this.extraSecs();
    return out;
  };
  function boardScore(){
    const R = G.round; if(!R) return null;
    if(G.state === 'final' && R.rec) return R.count * 1e5 - R.rec.adj;
    const h = (R.results || []).length;
    return h ? h * 1e5 - (R.mcSplit || 0) : 0;
  }
  function boardFmt(v){
    const h = Math.max(0, Math.ceil(v / 1e5 - 1e-9)), t = Math.max(0, h * 1e5 - v), n = classSettings ? classSettings.holes : 9;
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return (h >= n ? 'Done' : `${h}/${n}`) + ` · ${m}:${String(s).padStart(2, '0')}`;
  }
  const userName = () => (MC.session && MC.session.username) || (MC.user && MC.user.username) || '';

  // a class round always uses the teacher's settings, even if the student goes back to the menu and restarts
  function applyClass(){
    const S = G.settings, c = classSettings;
    S.holes = c.holes; S.difficulty = c.difficulty; S.topic = c.topic;
    S.name = userName() || S.name;
  }
  const origStart = G.startRound;
  G.startRound = function(){
    if(classSettings && !classDone) applyClass();
    else if(!(G.settings.name || '').trim() && MC.user) G.settings.name = MC.user.username;
    return origStart.apply(this, arguments);
  };

  // put the username in the setup's name box
  const origSetup = G.openSetup;
  G.openSetup = function(){
    const out = origSetup.apply(this, arguments);
    const box = $('#setName'); if(box && !box.value && MC.user) box.value = MC.user.username;
    return out;
  };

  // save once per finished round
  const origFinish = G.finishRound;
  G.finishRound = function(){
    const out = origFinish.apply(this, arguments);
    const R = this.round, rec = R && R.rec;
    if(rec && !R.mcSaved){
      R.mcSaved = true;
      const code = classSettings && !classDone && MC.session ? MC.session.code : null;
      const saving = MC.result({ score:rec.adj, correct:rec.right, answered:rec.total, seconds:rec.el, variant:rec.holes + ' holes',
                  qualified:!!rec.qualified,
                  // pickupSecs = the only seconds added on top of the clock; lockoutSecs = time spent waiting after wrong answers (already in played)
                  details:{ strokes:rec.strokes, wrong:rec.wrong, firstTry:rec.first, pickupSecs:Math.round(rec.pen * 10) / 10, lockoutSecs:rec.wrong * 3,
                            played:Math.round(rec.el * 10) / 10, accuracy:Math.round(rec.acc * 10) / 10,
                            holes:(R.results || []).map(h => ({ n:h.n, par:h.par, strokes:h.strokes, tries:h.tries, gaveUp:h.gaveUp })) } });
      // show "Finished" on the projector (the save itself stops the live updates)
      if(code && saving && saving.then) saving.then(() => MC.authed('mc_session_update', { p_code:code, p_status_text:`Finished ${rec.holes} holes`, p_finished:true }).catch(() => {}));
      if(classSettings && !classDone){
        // the class round is done: play again on this page is solo practice with the student's own settings
        classDone = true;
        MC.leaveSession();
      }
      if(classSettings && ownSettings){   // give the student back their own setup choices
        Object.assign(G.settings, ownSettings); ownSettings = null;
        try{ localStorage.setItem('speedgolf_settings', JSON.stringify(G.settings)); }catch(e){}
      }
    }
    return out;
  };

  // below the round clock and the camera buttons (top right), clear of the ball/aim area and the question card
  const BOARD_POS = () => ({ top:'calc(170px + env(safe-area-inset-top,0px))', right:'12px' });

  MC.register({
    game:'speed-golf',
    start(ctx){
      const s = ctx.settings || {};
      ownSettings = Object.assign({}, G.settings);
      classSettings = { holes:+s.holes === 18 ? 18 : 9, difficulty:['easy','medium','hard'].includes(s.difficulty) ? s.difficulty : 'medium',
                        topic:s.topic && (s.topic === 'mixed' || QBANK.ALL_TOPICS.some(t => t.id === s.topic)) ? s.topic : 'mixed' };
      document.querySelectorAll('.sgb-ov').forEach(n => n.remove());
      G.startRound();
      if(!board) board = MC.classBoard({ score:boardScore, lower:false, fmt:boardFmt, label:'Class leaderboard', pos:BOARD_POS() });
    },
    live(){
      const R = G.round, done = G.state === 'final' && R && R.rec;
      if(!R) return { score:null, correct:0, answered:0, status:'Starting', finished:false };
      const hole = Math.min(R.count, Math.max(1, R.idx + 1));
      return { score:done ? R.rec.adj : null, correct:R.right, answered:R.right + R.wrong,
               status:done ? `Finished ${R.count} holes` : `Hole ${hole}/${R.count}`, finished:!!done };
    },
    onEnded(){
      // teacher ended the game mid-round: let the student finish it as solo practice
      if(classSettings && !classDone){
        classDone = true; MC.leaveSession();
      }
    },
  });
})();
