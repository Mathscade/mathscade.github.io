/* =====================================================================
   UI: setup screens (track select -> race settings -> lobby), the race HUD,
   the pit wall (maths panel), banners, toasts and results.
   The UI never changes the race directly: it reads snapshots and sends
   messages through the transport, exactly like a networked client would.
   ===================================================================== */
window.F1 = window.F1 || {};
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtTime = t => { if (t == null || !isFinite(t)) return '--'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
const fmtClock = t => { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; };
F1.fmtTime = fmtTime;

function makeStepper(root, value, onChange, opts = {}) {
  const MIN = opts.min ?? 1, MAX = opts.max ?? 60, unit = opts.unit ?? ''; let v = Math.max(MIN, Math.min(MAX, Math.round(value)));
  root.innerHTML = `<button type="button" data-d="-1" aria-label="Fewer">▼</button><output aria-live="polite"></output><button type="button" data-d="1" aria-label="More">▲</button>`;
  const out = root.querySelector('output'), down = root.children[0], up = root.children[2];
  const show = () => { out.innerHTML = `${v}<small>${typeof unit === 'function' ? unit(v) : unit}</small>`; down.disabled = v <= MIN; up.disabled = v >= MAX; };
  const bump = d => { const n = Math.max(MIN, Math.min(MAX, v + d)); if (n !== v) { v = n; show(); onChange(v); } };
  let hold = 0, rep = 0; const stop = () => { clearTimeout(hold); clearInterval(rep); };
  root.addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; e.preventDefault(); const d = +b.dataset.d; bump(d); stop(); hold = setTimeout(() => { rep = setInterval(() => bump(d), 110); }, 420); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => root.addEventListener(t, stop));
  root.addEventListener('click', e => { if (e.detail !== 0) return; const b = e.target.closest('button'); if (b && !b.disabled) bump(+b.dataset.d); });
  show();
  return { set(n) { v = Math.max(MIN, Math.min(MAX, n)); show(); }, get: () => v };
}
function bindSeg(root, onPick) {
  root.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; root.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); onPick(b.dataset.v); });
}
F1.makeStepper = makeStepper;

F1.UI = {
  show(id) { for (const s of ['#scrTracks', '#scrSettings', '#scrLobby', '#scrResults']) $(s).classList.toggle('hidden', s !== id); },

  // ---------- 1. track select ----------
  buildTracks(app) {
    const wrap = $('#trackCards');
    wrap.innerHTML = F1.TRACK_ORDER.map(id => {
      const t = app.tracks[id], d = t.def;
      return `<button class="tcard" role="listitem" data-id="${id}" aria-pressed="false">
        <div class="ttop"><h3>${esc(d.name.toUpperCase())}</h3><span class="cty">${esc(d.country)}</span></div>
        <div class="art">${t.outlineSVG(d.theme.accent === '#D9302C' ? '#FF5A3C' : d.theme.accent === '#F2B800' ? '#FFE36B' : d.theme.accent === '#FF3EA5' ? '#FF3EA5' : '#2EC4B6')}</div>
        <div class="tags"><span class="tag t${d.difficultyLevel}">${esc(d.raceType)}</span><span class="tag">${esc(d.difficulty)}</span></div>
        <div class="facts"><span>Length<b>${(d.realLength / 1000).toFixed(3)} km</b></span><span>Laps<b>1 to 3</b></span>
          <span>Race time<b>about ${Math.round(t.minutesFor(3))} min</b></span><span>Lap time<b>about ${fmtClock(t.expectedLap)}</b></span></div>
      </button>`;
    }).join('');
    const pick = id => { app.trackId = id; wrap.querySelectorAll('.tcard').forEach(b => { b.classList.toggle('on', b.dataset.id === id); b.setAttribute('aria-pressed', b.dataset.id === id); }); };
    wrap.addEventListener('click', e => { const b = e.target.closest('.tcard'); if (!b) return; pick(b.dataset.id); });
    wrap.addEventListener('dblclick', e => { const b = e.target.closest('.tcard'); if (b) { pick(b.dataset.id); app.toSettings(); } });
    pick(app.trackId);
    $('#toSettings').onclick = () => app.toSettings();
  },

  // ---------- 2. race settings ----------
  buildSettings(app) {
    const S = app.settings;
    bindSeg($('#setLaps'), v => { S.laps = +v; this.refreshSettings(app); });
    makeStepper($('#playersStep'), S.maxPlayers, v => { S.maxPlayers = v; }, { min: 2, max: 32, unit: 'cars' });
    bindSeg($('#setDiff'), v => S.difficulty = v);
    bindSeg($('#setOil'), v => S.oilDuration = +v);
    bindSeg($('#setColl'), v => S.collision = v);
    bindSeg($('#setDmg'), v => S.damage = v);
    bindSeg($('#setFreq'), v => S.itemFreq = v);
    $('#setTopic').innerHTML = '<option value="mixed">Mixed: all main topics</option>' + F1.QuestionService.topics().map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    $('#setTopic').onchange = e => S.topic = e.target.value;
    for (const [id, key] of [['#optItems', 'items'], ['#optSound', 'sound']]) $(id).onchange = e => S[key] = e.target.checked;
    $('#backTracks').onclick = () => this.show('#scrTracks');
    $('#toLobby').onclick = () => app.toLobby();
  },
  refreshSettings(app) {
    const S = app.settings, t = app.track, d = t.def;
    $('#chosen').innerHTML = `${t.outlineSVG('#FFE36B', 160, 110, { ink: 8, core: 4 })}<div><h3>${esc(d.name.toUpperCase())}</h3><p>${esc(d.country)} · ${(d.realLength / 1000).toFixed(3)} km · ${esc(d.raceType)} · ${esc(d.difficulty)}</p><p>${d.corners.length} named corners · about ${fmtClock(t.expectedLap)} a lap</p></div><button class="alt" type="button" id="chg">Change</button>`;
    $('#chg').onclick = () => this.show('#scrTracks');
    $('#setLaps').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === S.laps));
    const Q = F1.CONFIG.PIT.questions;
    const stops = S.laps * t.stopsPerLap;
    $('#lapsSub').textContent = `${stops} pit stops (half way and end of each lap) × ${Q} questions = ${stops * Q} questions each, about ${Math.max(1, Math.round(t.minutesFor(S.laps)))} min`;
  },

  // ---------- 3. lobby ----------
  buildLobby(app) {
    const pick = $('#carPick');
    pick.innerHTML = F1.CAR_SPRITES.map(s => `<button data-s="${s}" aria-label="${s.replace(/_/g, ' ')}"><img src="${F1.carImg(s)}" alt=""></button>`).join('');
    pick.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; app.mySprite = b.dataset.s; pick.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); this.renderDrivers(app); });
    $('#backSettings').onclick = () => { app.cancelLobby(); this.show('#scrSettings'); };
    $('#startRace').onclick = () => app.startRace();
    this.buildReaction(app);
  },
  // ---------- reaction start: decides the grid ----------
  // Five red lights come on one by one, then after a random wait they all turn green. Tap as fast as you can.
  // Tapping before green is a jump start (back of the grid). One attempt per race.
  buildReaction(app) {
    const box = $('#react');
    box.addEventListener('pointerdown', e => { e.preventDefault(); this.reactPress(app, e.timeStamp); });
    addEventListener('keydown', e => {
      if ($('#scrLobby').classList.contains('hidden') || (e.code !== 'Space' && e.code !== 'Enter')) return;
      e.preventDefault(); if (!e.repeat) this.reactPress(app, e.timeStamp);
    });
    this.resetReaction(app);
  },
  resetReaction(app) {
    const R = this.R || (this.R = {}); (R.timers || []).forEach(clearTimeout);
    Object.assign(R, { state: 'idle', timers: [], t0: 0, began: 0 }); app.myReaction = null;
    $('#react').className = 'react'; $('#rlights').querySelectorAll('i').forEach(l => l.className = '');
    const c = $('#reactCall'); c.className = 'rcall'; c.textContent = 'Tap here or press SPACE to begin';
    $('#reactMsg').textContent = 'Your reaction time sets your grid position. Fastest starts on pole. One go only!';
  },
  reactPress(app, stamp) {
    const R = this.R, now = stamp && stamp > 0 ? stamp : performance.now(), lights = $('#rlights').querySelectorAll('i'), call = $('#reactCall');
    if (R.state === 'idle') {
      R.state = 'lights'; R.began = now; call.textContent = 'Wait for green…'; call.className = 'rcall';
      for (let k = 0; k < 5; k++) R.timers.push(setTimeout(() => { lights[k].className = 'red'; F1.Audio.play('count'); }, 700 + k * 800));
      const hold = 700 + 4 * 800 + 700 + Math.random() * 2800;   // the last light's timing is random, so it can't be guessed
      R.timers.push(setTimeout(() => {
        lights.forEach(l => l.className = 'green'); call.textContent = 'GO! TAP NOW!'; call.className = 'rcall go';
        requestAnimationFrame(() => { R.t0 = performance.now(); R.state = 'green'; });
        R.timers.push(setTimeout(() => { if (R.state === 'green') this.reactDone(app, 3); }, 3000));   // asleep at the wheel
      }, hold));
    } else if (R.state === 'lights') {
      if (now - R.began < 250) return;          // ignore a double tap on the first press
      this.reactDone(app, null);                 // too early: jump start
    } else if (R.state === 'green') this.reactDone(app, Math.max(0.08, (now - R.t0) / 1000));
  },
  reactDone(app, t) {
    const R = this.R; R.timers.forEach(clearTimeout); R.timers = []; R.state = 'done';
    const jump = t == null, call = $('#reactCall'), lights = $('#rlights').querySelectorAll('i');
    app.myReaction = jump ? { jump: true, time: null } : { time: t };
    const bots = app.lobby.filter(d => !d.you), pos = jump ? app.lobby.length : 1 + bots.filter(d => d.reaction < t).length;
    $('#react').className = 'react done' + (jump ? ' jump' : '');
    if (jump) { lights.forEach(l => l.className = 'red'); call.className = 'rcall bad'; call.textContent = 'JUMP START! You start from the back'; $('#reactMsg').textContent = 'You tapped before the lights went green.'; F1.Audio.play('wrong'); }
    else { call.className = 'rcall good'; call.textContent = `${t.toFixed(3)} s · P${pos} on the grid`; $('#reactMsg').textContent = pos === 1 ? 'Pole position! Fastest reaction in the lobby.' : 'Your grid position is set. Others may still join.'; F1.Audio.play(pos <= 3 ? 'right' : 'item'); }
    this.renderDrivers(app); app.updateStartBtn();
  },
  renderDrivers(app) {
    pickOn: { const b = $('#carPick').querySelector(`[data-s="${app.mySprite}"]`); $('#carPick').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }
    // listed in grid order: fastest reaction first; you appear once your test is done
    const mine = app.myReaction ? (app.myReaction.jump ? 99 : app.myReaction.time) : 98;
    const rt = d => d.you ? mine : d.reaction;
    const list = app.lobby.slice().sort((a, b) => rt(a) - rt(b));
    $('#drivers').innerHTML = list.map(d => `<div class="drv ${d.you ? 'you' : ''}"><img src="${F1.carImg(d.you ? app.mySprite : d.sprite)}" alt="">${esc(d.you ? 'You' : d.name)}<small class="rt">${d.you ? (app.myReaction ? (app.myReaction.jump ? 'JUMP' : app.myReaction.time.toFixed(3)) : '—') : d.reaction.toFixed(3)}</small></div>`).join('');
    $('#joinedN').textContent = app.lobby.length; $('#joinedMax').textContent = app.settings.maxPlayers;
  },

  // ---------- race HUD ----------
  hud: { last: 0, qid: null, bannerT: 0, lastCorner: '' },

  updateHUD(app, snap, now) {
    const H = this.hud, me = snap.cars.find(c => c.id === app.meId), mv = snap.me; if (!me) return;
    $('#spd').textContent = Math.round(Math.abs(me.speed) * 3.6);
    if (now - H.last < 0.1) return; H.last = now;
    const n = snap.cars.length;
    $('#pos').innerHTML = `P${me.place}<small>/${n}</small>`;
    $('#lap').textContent = `${Math.min(snap.laps, me.lap)}/${snap.laps}`;
    $('#time').textContent = fmtTime(snap.raceTime);
    const lt = mv.lapTimes; $('#last').textContent = lt.length ? fmtTime(lt[lt.length - 1]) : '--'; $('#best').textContent = fmtTime(me.bestLap);
    const corner = app.track.cornerAt(me.s); const cn = corner ? corner.name : (app.track.vIdeal[app.track.indexAtS(me.s)] > 70 ? 'Straight' : '');
    if (cn !== H.lastCorner) { H.lastCorner = cn; $('#corner').textContent = cn || '—'; }
    // health
    const hp = Math.round(me.health), bar = $('#hpBar');
    $('#hpTxt').textContent = `${hp}% · ${F1.Damage.label(hp)}`;
    bar.style.width = hp + '%'; bar.style.background = hp > 75 ? 'var(--teal)' : hp > 50 ? '#9BD45A' : hp > 25 ? 'var(--orange)' : 'var(--hot)';
    // boost
    const bt = me.boostT, max = F1.CONFIG.MATHS.fastBoostTime;
    $('#boostBar').style.width = Math.min(100, bt / max * 100) + '%';
    $('#boostLbl').textContent = bt > 0 ? 'BOOST!' : 'Boost';
    $('#streakTxt').textContent = me.streak > 1 ? `Streak ×${Math.min(me.streak, F1.CONFIG.MATHS.streakMax)}` : '';
    // item
    $('#itemBox').classList.toggle('has', me.oilHeld);
    $('#itemSlot').innerHTML = me.oilHeld ? `<img src="img/oil.png" alt="Oil slick">` : '';
    $('#itemBtn').textContent = me.oilHeld ? 'SPACE: drop' : 'No item';
    // board: top 8, plus you if lower
    const top = snap.cars.slice(0, 8), leader = snap.cars[0];
    const gap = c => c === leader ? (c.finished ? 'FIN' : 'Leader') : c.finished ? 'FIN' : c.lapsDone < leader.lapsDone - 0 && leader.prog - c.prog > app.track.length ? `+${Math.floor((leader.prog - c.prog) / app.track.length)} lap` : `+${Math.max(0, (leader.prog - c.prog) / Math.max(20, leader.speed || 40)).toFixed(1)}`;
    const row = c => `<li class="${c.id === app.meId ? 'you' : ''}"><span>${c.place}</span><i style="background:${c.colour}"></i><span>${esc(c.id === app.meId ? 'You' : c.name)}</span><b>${gap(c)}</b></li>`;
    let html = top.map(row).join('');
    if (me.place > 8) html += `<li class="gap">⋯</li>` + row(me);
    $('#boardList').innerHTML = html;
    $('#boardLap').textContent = `Lap ${Math.min(snap.laps, leader.lap)}/${snap.laps}`;
    // pit wall stats
    const st = mv.stats; $('#sRight').textContent = st.correct; $('#sStreak').textContent = me.streak; $('#sAcc').textContent = st.questions ? Math.round(st.correct / st.questions * 100) + '%' : '–';
    // persistent warnings
    if (me.critical && !me.pit) this.banner('CRITICAL DAMAGE', 'Losing power: your crew will fix it at the next pit stop', 'red', 0.3);
    else if (mv.wrongWay) this.banner('WRONG WAY', 'Turn around, or press R to reset', 'yellow', 0.3);
    else if (mv.penaltyT > 0) this.banner('TRACK LIMITS', `Corner cut: power cut for ${mv.penaltyT.toFixed(1)} s`, 'yellow', 0.3);
  },

  // ---------- pit wall ----------
  /** The pit stop panel: a status message on track, the questions in the garage. */
  renderQuestion(app, mv, snap) {
    const q = mv.question, H = this.hud, p = mv.pit, P = F1.CONFIG.PIT;
    // job progress: one cell per question in this stop
    const jobs = p ? p.jobs : 0, key = p ? `${p.right}/${p.wrong}/${jobs}` : 'none';
    if (H.jobsKey !== key) {
      H.jobsKey = key; const marks = H.marks = p ? (H.marks || []).slice(0, jobs) : [];
      if (p && mv.lastResult && marks.length < jobs) marks.push(mv.lastResult.right);
      $('#jobs').innerHTML = Array.from({ length: P.questions }, (_, i) => `<i class="${i < marks.length ? (marks[i] ? 'ok' : 'no') : i === jobs && p && p.phase === 'box' ? 'now' : ''}"></i>`).join('');
    }
    const mode = $('#qMode'), why = $('#qWhy');
    if (!q) {
      if (H.qid != null && mv.lastResult && mv.lastResult.qid === H.qid) { this.showResult(mv.lastResult); if (performance.now() - (H.resultAt || 0) < 650) return; }
      // nothing to answer right now: say what's happening
      const me = snap && snap.cars.find(c => c.id === app.meId);
      const hold = p && p.hold > 0;
      const state = !p ? (me && me.finished ? 'done' : 'track') : hold ? 'hold' : p.phase;
      const left = me ? Math.max(0, snap.laps * (snap.stopsPerLap || 1) - me.stops) : 0;
      const nextPit = me && snap.stopsPerLap > 1 ? (me.stops % snap.stopsPerLap === 0 ? 'the half-way pit lane' : 'the pit lane at the end of the lap') : 'the end of the lap';
      const msg = {
        track: ['ON TRACK', `Drive to ${nextPit}. Your crew is waiting there.`, `<div class="idle"><span class="big">${left}</span><small>${left === 1 ? 'pit stop' : 'pit stops'} to go · ${P.questions} questions each</small></div>`],
        in: ['PIT LANE', 'Speed limiter on: the car drives itself to your garage.', `<div class="idle"><span class="big">PIT LANE</span><small>Get ready: ${P.questions} questions</small></div>`],
        box: ['PIT STOP', `Job ${Math.min(P.questions, jobs + 1)} of ${P.questions}`, `<div class="idle"><span class="big">${jobs}/${P.questions}</span><small>Next question coming…</small></div>`],
        hold: ['+' + P.wrongPenalty + ' s', 'Wrong answer: the crew fumbled that job.', `<div class="idle"><span class="big hot">${p && p.hold > 0 ? p.hold.toFixed(1) : ''}</span><small>seconds penalty</small></div>`],
        out: ['PIT EXIT', 'All jobs done. Back out on track!', `<div class="idle"><span class="big">GO!</span><small>${p ? p.right : 0}/${P.questions} right this stop</small></div>`],
        done: ['FINISHED', 'Race complete. Great driving!', `<div class="idle"><span class="big">🏁</span></div>`],
      }[state];
      const sk = state + (state === 'hold' ? (p.hold.toFixed(1)) : state === 'track' ? left : state === 'box' ? jobs : '');
      if (H.idleKey !== sk) {
        H.idleKey = sk; H.qid = null;
        mode.className = 'mode ' + (state === 'hold' ? 'repair' : state === 'track' || state === 'done' ? '' : 'item'); mode.textContent = msg[0]; why.textContent = msg[1];
        $('#prompt').innerHTML = msg[2]; $('#answers').innerHTML = ''; $('#feed').textContent = ''; $('#feed').className = 'feed';
      }
      return;
    }
    if (q.id === H.qid) return;
    H.qid = q.id; H.locked = false; H.idleKey = null;
    mode.className = 'mode item'; mode.textContent = 'PIT STOP';
    why.textContent = `Job ${Math.min(P.questions, jobs + 1)} of ${P.questions} · each wrong answer adds ${P.wrongPenalty} s`;
    $('#prompt').innerHTML = (h => /angle-diagram|q-text|data-set/.test(h) ? h : '<span>' + h + '</span>')(q.prompt);
    const a = $('#answers'); a.classList.remove('locked');
    a.innerHTML = q.options.map((o, i) => `<button class="ans" data-i="${i}" type="button"><kbd>${i + 1}</kbd>${o}</button>`).join('');
    $('#feed').textContent = ''; $('#feed').className = 'feed';
  },
  answer(app, i) {
    const H = this.hud; if (H.locked || H.qid == null) return;
    const r = app.net.answer(H.qid, i); if (!r) return;
    H.locked = true; this.showResult(r);
  },
  showResult(r) {
    const H = this.hud; if (H.shownFor === r.qid) return; H.shownFor = r.qid; H.resultAt = performance.now();
    const a = $('#answers'); a.classList.add('locked');
    a.querySelectorAll('.ans').forEach((b, i) => { if (i === r.correct) b.classList.add('right'); else if (i === r.picked) b.classList.add('wrong'); });
    const f = $('#feed'); f.className = 'feed ' + (r.right ? 'good' : 'bad'); f.textContent = (r.right ? 'Correct! ' : 'Not quite. ') + r.reward;
    F1.Audio.play(r.right ? 'right' : 'wrong');
  },

  banner(title, sub, cls = '', hold = 2) {
    const b = $('#banner'), H = this.hud;
    if (b.dataset.t !== title) { b.className = 'banner show ' + cls; b.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`; b.dataset.t = title; }
    else if (sub) { const sp = b.querySelector('span'); if (sp && sp.textContent !== sub) sp.textContent = sub; }
    clearTimeout(H.bannerTimer); H.bannerTimer = setTimeout(() => { b.className = 'banner'; b.dataset.t = ''; }, hold * 1000);
  },
  toast(text) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = text; $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 2700); const all = $('#toasts').children; if (all.length > 3) all[0].remove();
  },
  countdown(n) {
    const c = $('#count'); c.classList.add('show');
    const lights = $('#lights'); lights.classList.toggle('go', n === 'GO!');
    const on = n === 'GO!' ? 5 : (4 - n) * 2 - 1;
    lights.querySelectorAll('i').forEach((l, i) => l.classList.toggle('on', n !== 'GO!' && i < Math.min(5, on)));
    const b = $('#countNum'); b.textContent = n; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    if (n === 'GO!') setTimeout(() => c.classList.remove('show'), 900);
  },

  // ---------- results ----------
  results(app, server) {
    const st = server.standings(), me = server.byId.get(app.meId), track = server.track;
    const entries = st.map(c => ({
      name: c.id === app.meId ? 'You' : c.name, you: c.id === app.meId, img: F1.carImg(c.sprite), colour: c.colour,
      display: c.finished ? fmtTime(c.finishTime) : `${Math.max(0, c.lapsDone)} ${c.lapsDone === 1 ? 'lap' : 'laps'}`,
      sub: `${c.stats.correct}/${c.stats.questions} right · pit time ${Math.round(c.pitStops.reduce((a, s) => a + s.time, 0))} s`,
      tag: c.place === 1 ? '🏁 Winner' : '',
    }));
    showLeaderboard({
      title: `${track.def.name} results`, subtitle: me ? `You finished P${me.place} of ${st.length}` : '',
      note: 'Practice drivers fill the grid until live class races are connected.',
      entries,
      actions: [
        { label: 'Full results', onClick: () => this.fullResults(app, server) },
        { label: 'Race again', primary: true, onClick: () => app.raceAgain() },
        { label: 'Change track', onClick: () => app.backToTracks() },
        { label: '← All games', href: '../index.html' },
      ],
    });
  },
  fullResults(app, server) {
    const st = server.standings();
    const rows = st.map(c => `<tr class="${c.id === app.meId ? 'you' : ''}"><td>${c.place}</td><td>${esc(c.id === app.meId ? 'You' : c.name)}</td><td>${c.finished ? fmtTime(c.finishTime) : 'DNF'}</td><td>${c.reaction == null ? '--' : c.reaction >= 99 ? 'Jump start' : c.reaction.toFixed(3) + ' s'}</td><td>${Math.max(0, c.lapsDone)}</td><td>${fmtTime(c.bestLap)}</td>
      <td>${c.stats.questions}</td><td>${c.stats.correct}</td><td>${c.stats.wrong}</td><td>${c.pitStops.length ? c.pitStops.reduce((a, s) => a + s.time, 0).toFixed(1) + ' s' : '--'}</td><td>${Math.round(c.stats.damage)}%</td><td>${c.stats.oilCollected}</td><td>${c.stats.oilUsed}</td><td>${c.stats.oilHits}</td><td>${c.stats.collisions}</td><td>${c.stats.cuts}</td></tr>`).join('');
    const scr = $('#scrResults');
    scr.innerHTML = `<div class="resultsWrap" role="dialog" aria-label="Full race results"><header><h2>Full results</h2></header><div class="scroll"><table class="tbl"><thead><tr><th>Pos</th><th>Driver</th><th>Race time</th><th>Reaction</th><th>Laps</th><th>Best lap</th><th>Questions</th><th>Right</th><th>Wrong</th><th>Pit time</th><th>Damage taken</th><th>Oil won</th><th>Oil used</th><th>Oil hits</th><th>Collisions</th><th>Corner cuts</th></tr></thead><tbody>${rows}</tbody></table></div>
      <footer><button class="btn" id="resBack" type="button">Podium</button><button class="btn primary" id="resAgain" type="button">Race again</button><button class="btn" id="resTracks" type="button">Change track</button><a class="btn" href="../index.html" >← All games</a></footer></div>`;
    document.querySelectorAll('.lb-ov').forEach(x => x.remove());
    this.show('#scrResults');
    $('#resBack').onclick = () => { scr.classList.add('hidden'); this.results(app, server); };
    $('#resAgain').onclick = () => app.raceAgain();
    $('#resTracks').onclick = () => app.backToTracks();
  },
};
