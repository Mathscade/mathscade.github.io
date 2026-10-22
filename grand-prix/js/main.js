/* =====================================================================
   MAIN: loads the art, runs the screen flow and the race loop.
   HOME (Mathcade hub) -> TRACK SELECT -> RACE SETTINGS -> LOBBY -> GRID
   -> RACE -> FINISH -> RESULTS -> back to TRACK SELECT
   The race loop steps the server at a fixed 60 Hz and draws every frame,
   blending car positions between ticks so motion stays smooth.
   ===================================================================== */
(function () {
  const IMAGES = ['oil'];

  const App = {
    trackId: F1.TRACK_ORDER[0],   // the first offered circuit (Las Vegas since Monza and Spa were retired)
    tracks: {}, images: {}, mySprite: 'car_red_1',
    settings: { laps: 3, difficulty: 'medium', topic: 'mixed', maxPlayers: 32, collision: 'normal', damage: 'normal', itemFreq: 'normal', oilDuration: 20, items: true, sound: true },
    keys: new Set(), touch: {}, server: null, net: null, renderer: null, running: false, lobby: [],

    get track() { return this.tracks[this.trackId]; },

    async boot() {
      await Promise.all(IMAGES.map(n => new Promise(res => { const im = new Image(); im.onload = im.onerror = res; im.src = `img/${n}.png`; this.images[n] = im; })));
      if (!window.THREE) { $('#loading').textContent = 'The 3D engine could not load. Check the internet connection and reload.'; return; }
      F1.makeCarThumbs();
      for (const id of F1.TRACK_ORDER) this.tracks[id] = new F1.Track(F1.TRACKS[id]);
      try { const s = JSON.parse(localStorage.getItem('mathcadeGP_settings') || 'null'); if (s) Object.assign(this.settings, s); this.settings.laps = Math.max(1, Math.min(3, Math.round(this.settings.laps) || 3)); const sp = localStorage.getItem('mathcadeGP_car'); if (sp && F1.CAR_SPRITES.includes(sp)) this.mySprite = sp; } catch (e) {}
      const hash = (location.hash || '').replace('#', ''); if (this.tracks[hash]) this.trackId = hash;
      F1.UI.buildTracks(this); F1.UI.buildSettings(this); F1.UI.buildLobby(this);
      this.bindInput();
      $('#loading').remove();
      if (this.tracks[hash]) this.toSettings(); else F1.UI.show('#scrTracks');
    },

    toSettings() {
      const S = this.settings;
      const syncSeg = (sel, val) => document.querySelectorAll(sel + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === String(val)));
      syncSeg('#setLaps', S.laps); syncSeg('#setDiff', S.difficulty); syncSeg('#setOil', S.oilDuration); syncSeg('#setColl', S.collision); syncSeg('#setDmg', S.damage); syncSeg('#setFreq', S.itemFreq);
      $('#setTopic').value = S.topic; $('#optItems').checked = S.items; $('#optSound').checked = S.sound;
      F1.UI.refreshSettings(this);
      F1.UI.show('#scrSettings');
    },

    // ---------- lobby: practice drivers join one by one ----------
    toLobby() {
      F1.Audio.unlock();
      try { localStorage.setItem('mathcadeGP_settings', JSON.stringify(this.settings)); } catch (e) {}
      $('#roomCode').textContent = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
      this.lobby = [{ you: true, name: 'You' }];
      F1.UI.resetReaction(this);
      const names = F1.BOT_NAMES.slice().sort(() => Math.random() - 0.5), max = this.settings.maxPlayers;
      $('#startRace').disabled = true;
      F1.UI.show('#scrLobby'); F1.UI.renderDrivers(this);
      clearInterval(this.joinTimer);
      this.joinTimer = setInterval(() => {
        if (this.lobby.length >= max) { clearInterval(this.joinTimer); this.updateStartBtn(); return; }
        const i = this.lobby.length - 1;
        this.lobby.push({ name: names[i % names.length], sprite: F1.CAR_SPRITES[(i * 7 + 3) % F1.CAR_SPRITES.length], reaction: 0.2 + Math.pow(Math.random(), 1.3) * 0.45 });
        F1.UI.renderDrivers(this); this.updateStartBtn();
      }, 70);
    },
    cancelLobby() { clearInterval(this.joinTimer); F1.UI.resetReaction(this); },
    /** The race can start once there are two drivers and you've done your reaction test. */
    updateStartBtn() {
      const b = $('#startRace'), ok = this.lobby.length >= 2 && !!this.myReaction;
      b.disabled = !ok; b.textContent = this.myReaction ? 'Start the race' : 'Do the reaction test first';
    },

    // ---------- race ----------
    startRace() {
      clearInterval(this.joinTimer);
      F1.Audio.unlock(); F1.Audio.on = this.settings.sound;
      try { localStorage.setItem('mathcadeGP_car', this.mySprite); } catch (e) {}
      const S = Object.assign({}, this.settings);
      this.server = new F1.RaceServer(this.trackId, S);
      this.net = new F1.LocalTransport(this.server);
      this.meId = this.net.join({ name: 'You', sprite: this.mySprite });
      const R = this.myReaction; this.server.byId.get(this.meId).reaction = R ? (R.jump ? 99 : R.time) : 98;
      // other drivers keep the cars they joined with; nobody shares your car
      const used = new Set([this.mySprite]);
      this.lobby.filter(d => !d.you).forEach((d, i) => {
        let sp = d.sprite; if (used.has(sp)) sp = F1.CAR_SPRITES.find(x => !used.has(x)) || sp; used.add(sp);
        const car = this.server.addPlayer({ id: 'b' + i, name: d.name, sprite: sp, isBot: true }); if (car) car.reaction = d.reaction;
      });
      this.server.placeGrid();
      document.querySelectorAll('.lb-ov').forEach(x => x.remove());
      F1.UI.show(null); $('#stage').classList.remove('hidden'); $('#pit').classList.remove('hidden');
      $('#elevBox').classList.toggle('hidden', this.track.elevMax - this.track.elevMin < 30);
      F1.UI.banner('LOADING', 'Building the circuit…', 'teal', 0.6);
      this.renderer = new F1.Renderer($('#cv'), this.server.track, this.images);
      this.renderer.resize();
      F1.UI.hud.qid = null; F1.UI.hud.shownFor = null; $('#prompt').innerHTML = ''; $('#answers').innerHTML = ''; $('#feed').textContent = '';
      $('#keyHint').classList.remove('hidden'); clearTimeout(this.hintT); this.hintT = setTimeout(() => $('#keyHint').classList.add('hidden'), 12000);
      this.acc = 0; this.lastT = performance.now(); this.finishedShown = false; this.resultsShown = false;
      const slot = this.server.byId.get(this.meId).gridSlot;
      F1.UI.banner(this.track.def.name.toUpperCase(), `${S.laps} ${S.laps === 1 ? 'lap' : 'laps'} · you start P${slot} of ${this.server.cars.length}`, 'yellow', 2.6);
      setTimeout(() => this.server && this.server.startCountdown(), 1600);
      if (!this.running) { this.running = true; requestAnimationFrame(t => this.frame(t)); }
    },
    raceAgain() { document.querySelectorAll('.lb-ov').forEach(x => x.remove()); $('#scrResults').classList.add('hidden'); this.toLobby(); $('#stage').classList.add('hidden'); $('#pit').classList.add('hidden'); this.server = null; },
    backToTracks() { document.querySelectorAll('.lb-ov').forEach(x => x.remove()); this.server = null; $('#stage').classList.add('hidden'); $('#pit').classList.add('hidden'); F1.UI.show('#scrTracks'); },

    readInput() {
      const k = this.keys, t = this.touch;
      const left = k.has('ArrowLeft') || k.has('KeyA') || t.left, right = k.has('ArrowRight') || k.has('KeyD') || t.right;
      return { throttle: (k.has('ArrowUp') || k.has('KeyW') || t.gas) ? 1 : 0, brake: (k.has('ArrowDown') || k.has('KeyS') || t.brake) ? 1 : 0, steer: (right ? 1 : 0) - (left ? 1 : 0) };
    },

    frame(t) {
      requestAnimationFrame(tt => this.frame(tt));
      if (!this.server) return;
      const dt = Math.min(0.1, (t - this.lastT) / 1000); this.lastT = t;
      const TICK = F1.CONFIG.TICK; this.acc += dt;
      let steps = 0;
      while (this.acc >= TICK && steps < 8) { this.net.sendInput(this.readInput()); this.server.step(TICK); this.acc -= TICK; steps++; }
      if (steps === 8) this.acc = 0;
      const snap = this.net.state();
      this.handleEvents(this.net.drainEvents(), snap);
      const me = snap.cars.find(c => c.id === this.meId);
      this.renderer.draw(snap, this.meId, this.acc / TICK, dt);
      if (t - (this.miniT || 0) > 66) {          // the map and height chart only need ~15 updates a second
        this.miniT = t;
        this.renderer.drawMinimap($('#miniCv'), snap, this.meId);
        if (!$('#elevBox').classList.contains('hidden') && me) $('#elevVal').textContent = this.renderer.drawElevation($('#elevCv'), me.s) + ' m';
      }
      F1.UI.updateHUD(this, snap, t / 1000);
      F1.UI.renderQuestion(this, snap.me, snap);
      if (me) F1.Audio.setEngine(Math.abs(me.speed), this.readInput().throttle, snap.phase === 'racing' && !me.finished);
      if (snap.phase === 'finished' && !this.resultsShown) { this.resultsShown = true; F1.Audio.setEngine(0, 0, false); setTimeout(() => F1.UI.results(this, this.server), 1200); }
    },

    handleEvents(events, snap) {
      const R = this.renderer, me = this.meId, UI = F1.UI;
      for (const e of events) {
        const mine = e.carId === me;
        switch (e.type) {
          case 'countdown': UI.countdown(e.n); F1.Audio.play('count'); break;
          case 'go': UI.countdown('GO!'); F1.Audio.play('go'); break;
          case 'crash': R.spark(e.x, e.y, e.sev === 'major' ? 22 : 10); if (mine || e.other === me) { F1.Audio.play(e.sev === 'minor' ? 'bump' : 'crash'); if (e.sev === 'major') UI.toast('Big hit! Damage taken'); } break;
          case 'wall': R.spark(e.x, e.y, 14, '#FFFFFF'); if (mine) { F1.Audio.play(e.impact > 12 ? 'crash' : 'bump'); if (e.impact > 14) UI.toast('Into the wall!'); } break;
          case 'critical': if (mine) { UI.banner('CRITICAL DAMAGE', 'Losing power: your crew will fix it at the next pit stop', 'red', 2.5); F1.Audio.play('warn'); } break;
          case 'itembox': R.ring(e.x, e.y, '#FFE36B'); break;
          case 'gotoil': if (mine) { F1.Audio.play('item'); UI.toast('Oil slick! Press SPACE to drop it'); } break;
          case 'pitin': if (mine) { UI.banner(e.kind === 'mid' ? 'HALF-WAY PIT STOP' : 'PIT LANE', 'Speed limiter on. Your crew is ready.', 'teal', 2.2); F1.Audio.play('item'); } break;
          case 'pitbox': if (mine) { UI.banner('PIT STOP', `Answer ${F1.CONFIG.PIT.questions} questions to get back out`, 'yellow', 2.2); } break;
          case 'pitdone': if (mine) { UI.banner('GO! GO! GO!', `${e.right}/${e.right + e.wrong} right · stop ${e.time.toFixed(1)} s`, e.wrong ? 'teal' : 'yellow', 2.4); F1.Audio.play('go'); } break;
          case 'pitexit': if (mine && e.boost > 0) UI.toast(e.boost >= F1.CONFIG.PIT.perfectBoost ? 'Perfect pit stop: big boost!' : 'Great pit stop: boost!'); break;
          case 'oildrop': if (mine) UI.toast('Oil slick dropped'); break;
          case 'oilhit': R.ring(e.x, e.y, '#22303A'); if (mine) { UI.banner('OIL!', 'You slid on an oil slick', 'yellow', 1.4); F1.Audio.play('oil'); } else if (e.owner === me) UI.toast(`${e.victimName} hit your oil slick!`); break;
          case 'lap': if (mine) { F1.Audio.play('lap'); const left = this.server.laps - e.lap; UI.banner(left === 1 ? 'FINAL LAP' : `LAP ${e.lap + 1}`, `Last lap ${F1.fmtTime(e.time)}`, left === 1 ? 'red' : 'teal', 2); } break;
          case 'cut': if (mine) { UI.banner('TRACK LIMITS', e.reset ? 'Corner cut: sent back to where you left the track' : 'Corner cut: power cut for 2.5 s', 'yellow', 2.2); F1.Audio.play('warn'); } break;
          case 'reset': if (mine && e.why !== 'manual') UI.toast(e.why === 'stuck' ? 'Back on track' : 'Reset to the track'); break;
          case 'winner': if (!mine) UI.toast(`${e.carId === me ? 'You' : (this.server.byId.get(e.carId) || {}).name} wins! Finish your last lap`); break;
          case 'finish': if (mine) { const p = e.place; UI.banner('FINISHED!', `You came P${p}. Time ${F1.fmtTime(e.time)}`, 'yellow', 4); F1.Audio.play('finish'); } break;
          case 'raceover': break;
        }
      }
    },

    bindInput() {
      const block = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
      addEventListener('keydown', e => {
        if (!this.server) return;
        if (block.includes(e.code)) e.preventDefault();
        this.keys.add(e.code);
        if (e.repeat) return;
        if (/^Digit[1-4]$/.test(e.code) || /^Numpad[1-4]$/.test(e.code)) F1.UI.answer(this, +e.code.slice(-1) - 1);
        if (e.code === 'Space') this.net.useItem();
        if (e.code === 'KeyR') this.net.reset();
        if (e.code === 'KeyC') F1.UI.toast(this.renderer.cycleCamera());
        if (e.code === 'Equal' || e.code === 'NumpadAdd') this.renderer.userZoom = Math.min(1.8, (this.renderer.userZoom || 1) * 1.15);
        if (e.code === 'Minus' || e.code === 'NumpadSubtract') this.renderer.userZoom = Math.max(0.5, (this.renderer.userZoom || 1) / 1.15);
      });
      addEventListener('keyup', e => this.keys.delete(e.code));
      addEventListener('blur', () => this.keys.clear());
      addEventListener('resize', () => this.renderer && this.renderer.resize());
      $('#answers').addEventListener('pointerdown', e => { const b = e.target.closest('.ans'); if (!b) return; e.preventDefault(); F1.UI.answer(this, +b.dataset.i); });
      $('#itemBtn').onclick = () => this.net && this.net.useItem();
      document.querySelectorAll('.touch button').forEach(b => {
        const k = b.dataset.k;
        b.addEventListener('pointerdown', e => { e.preventDefault(); if (k === 'item') this.net && this.net.useItem(); else this.touch[k] = true; });
        for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { this.touch[k] = false; });
      });
      $('#leaveBtn').onclick = () => $('#confirm').classList.remove('hidden');
      // teacher: end the race for everyone (tap twice so it can't happen by accident)
      $('#endBtn').onclick = () => {
        const b = $('#endBtn'); if (!this.server || this.server.phase === 'finished') return;
        if (b.classList.contains('armed')) { clearTimeout(this.endT); b.classList.remove('armed'); b.textContent = 'End race'; this.server.endRace(); return; }
        b.classList.add('armed'); b.textContent = 'Tap again to end'; clearTimeout(this.endT);
        this.endT = setTimeout(() => { b.classList.remove('armed'); b.textContent = 'End race'; }, 3000);
      };
      $('#stay').onclick = () => $('#confirm').classList.add('hidden');
    },
  };
  window.F1App = App;
  App.boot();
})();
