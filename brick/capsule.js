/* Mathcade capsule (gumball) machine for the Shop.
   Capsule.machine(el, { onTake(rarity) }) -> draws the machine into el; returns { dispense(rarity) -> Promise, setTray(rarity|null), trayRect(), refill() }
     dispense: the crank turns, the globe shakes and a capsule in that rarity's colour drops into the tray, where it pulses until tapped.
   Capsule.open(result, opts)      -> lifts the capsule to the middle of the screen with an Open button; Open cracks it and shows the prize.
     result: { rarity, item:{id,kind,name,...} | null, refund }
     opts:   { from:() => DOMRect, renderItem(el, item) -> {destroy()}, onWear(item) -> Promise, onClose(), coinSVG(size), esc }
   Art: bold #22303A outlines, flat colours and simple shines, like Brick: a classic red gumball machine with a chrome front.
   The globe shows more commons than rare ones (NOT the real odds, which live on the server and are never shown). */
(function(){
'use strict';
const INK = '#22303A';
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Collector'];
const COL = { Common:'#7E8E9F', Uncommon:'#24965A', Rare:'#2C74D6', Legendary:'#D9750A', Collector:'#FF3DCB' };
const GLOW = { Legendary:'#FFB028', Collector:'#FF3DCB' };
const MIX = { Common:10, Uncommon:9, Rare:6, Legendary:4, Collector:2 };      // how many of each sit in the globe
const KIND = { hat:'Hat', shoes:'Shoes', skin:'Costume', fx:'Hat effect', companion:'Companion' };
const HEAD = { Common:'Nice!', Uncommon:'Ooh, Uncommon!', Rare:'Rare find!', Legendary:'LEGENDARY!', Collector:'COLLECTOR!!' };
const RED = '#E8392F', RED_EDGE = '#A8231C', RED_LIGHT = '#FF8A7A', CHROME = '#E3EAF1', CHROME_DARK = '#A9B8C7', CHROME_EDGE = '#7E8E9F';
const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const wait = ms => new Promise(r => setTimeout(r, ms));
const GX = 120, GY = 106, GR = 84, CR = 12.5;          // globe centre / radius, capsule radius (SVG units)
const VB = { x:-14, y:-8, w:268, h:356 };           // the drawing's viewBox
const CHUTE = { x:120, y:282 }, TRAY = { x:120, y:314 };   // where a capsule comes out, where it rests
const pc = (v, a, n) => (100 * (v - a) / n).toFixed(2) + '%';

/* one small capsule in the globe (centred on 0,0) */
function smallCap(rar, rot){
  const c = COL[rar];
  return `<g class="cm-cap r-${rar}"><g transform="rotate(${rot})">
      <path d="M${-CR} 0A${CR} ${CR} 0 0 1 ${CR} 0Z" fill="${c}"/>
      <path d="M${-CR} 0A${CR} ${CR} 0 0 0 ${CR} 0Z" fill="#F3F7FB"/>
      <path d="M${-CR} 0H${CR}" stroke="${INK}" stroke-width="2"/></g>
    <circle r="${CR}" fill="none" stroke="${INK}" stroke-width="2.6"/>
    <ellipse cx="-4.5" cy="-6" rx="4" ry="2.3" transform="rotate(-32 -4.5 -6)" fill="#fff" opacity=".85"/></g>`;
}
/* capsules settle in rows from the bottom of the globe (a hex pile), then the rarities are shuffled in.
   The special ones (Legendary, Collector) are kept in clear view, not behind the collar. */
function layout(){
  const d = CR * 2 + 0.8, bottom = GY + GR - 5 - CR, rows = [];
  for(let k = 0; k < 12; k++){
    const y = bottom - k * d * 0.866, hw = Math.sqrt(Math.max(0, (GR - 5) ** 2 - (y - GY) ** 2)) - CR;
    if(hw < 0) break;
    const row = [];
    for(let m = -6; m <= 6; m++){ const x = m * d + (k % 2) * d / 2; if(Math.abs(x) <= hw) row.push({ x:GX + x, y }); }
    rows.push(row);
  }
  const total = RARITIES.reduce((n, r) => n + MIX[r], 0), spots = [];
  for(const row of rows){ if(spots.length >= total) break; spots.push(...row.slice(0, total - spots.length)); }
  spots.forEach(p => { p.x += (Math.random() - .5) * 2; p.y += (Math.random() - .5) * 1.6; p.rot = Math.round((Math.random() - .5) * 80); });
  const free = spots.slice(), take = ok => { const c = free.filter(ok), p = c.length ? c[Math.floor(Math.random() * c.length)] : free[0]; free.splice(free.indexOf(p), 1); return p; };
  const seen = p => p.y < GY + 50 && p.y > GY - 40 && Math.abs(p.x - GX) < 54;
  const out = [], dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // spread the better capsules out: each one goes where it is furthest from the special ones already placed
  // (same rarity counts double), with a little randomness so the globe looks shuffled, never sorted
  const spread = r => {
    const placed = out.filter(o => o.r !== 'Common');
    let best = null, bestScore = -1;
    free.forEach(p => {
      const near = placed.length ? Math.min(...placed.map(o => dist(o, p) / (o.r === r ? 2 : 1))) : 999;
      const lowBias = GLOW[r] && p.y > GY + GR * 0.55 ? 0.6 : 1;      // glowing ones not hidden down by the collar
      const score = near * lowBias + Math.random() * CR;
      if(score > bestScore){ bestScore = score; best = p; }
    });
    if(!best) return null; free.splice(free.indexOf(best), 1); return best;
  };
  ['Collector','Legendary','Rare','Uncommon'].forEach(r => { for(let i = 0; i < MIX[r] && free.length; i++) out.push(Object.assign(spread(r), { r })); });
  while(free.length) out.push(Object.assign(take(() => true), { r:'Common' }));      // commons fill whatever room is left
  console.debug && console.debug('capsules', out.length);
  // a back layer peeking through the gaps, so the globe looks full and round
  const topY = Math.min(...spots.map(p => p.y)), back = [];
  for(let k = 0; k < rows.length; k++){
    const y = bottom - k * d * 0.866 - d * 0.433; if(y < topY - 4) break;
    const hw = Math.sqrt(Math.max(0, (GR - 5) ** 2 - (y - GY) ** 2)) - CR * .8;
    for(let m = -6; m <= 6; m++){ const x = m * d + ((k + 1) % 2) * d / 2; if(Math.abs(x) <= hw)
      back.push({ x:GX + x, y, rot:Math.round((Math.random() - .5) * 90), r:['Common','Common','Common','Uncommon','Uncommon','Rare'][Math.floor(Math.random() * 6)], back:true }); }
  }
  return back.concat(out);
}
function sparkle(x, y, s, delay){
  return `<path class="cm-spark" style="animation-delay:${delay}s" transform="translate(${x} ${y}) scale(${s})" d="M0-10C1.4-3 3-1.4 10 0 3 1.4 1.4 3 0 10-1.4 3-3 1.4-10 0-3-1.4-1.4-3 0-10Z" fill="#FFE36B" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
}
function capsLayer(spots){
  const back = spots.filter(p => p.back), normal = spots.filter(p => !p.back && !GLOW[p.r]), special = spots.filter(p => GLOW[p.r]);
  const put = p => `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})${p.back ? ' scale(.86)' : ''}"><g class="cm-jig" style="animation-delay:${(-Math.random() * 4).toFixed(2)}s;animation-duration:${(3 + Math.random() * 2.5).toFixed(2)}s">${smallCap(p.r, p.rot)}</g></g>`;
  const glow = p => `<circle class="cm-glow g-${p.r}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r === 'Collector' ? CR + 9 : CR + 5}" fill="${GLOW[p.r]}" filter="url(#cmBlur${p.r === 'Collector' ? 'B' : 'A'})"/>`;
  return `<g class="cm-back" opacity=".42">${back.map(put).join('')}</g>` + normal.map(put).join('') + special.map(glow).join('') + special.map(put).join('');
}
/* the classic red gumball machine: glass globe, red cap + collar, chrome front plate (coin slot, crank, flap chute), red pedestal */
function machineSVG(spots){
  const base = 'M58 296H182L204 326Q207 336 197 336H43Q33 336 36 326Z';
  return `<svg class="cm-svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="cmGlass" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#F2FBFF"/><stop offset=".7" stop-color="#CBE9FA"/><stop offset="1" stop-color="#A9D6F0"/></radialGradient>
    <linearGradient id="cmChrome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="${CHROME}"/><stop offset="1" stop-color="${CHROME_DARK}"/></linearGradient>
    <clipPath id="cmGlobe"><circle cx="${GX}" cy="${GY}" r="${GR - 2}"/></clipPath>
    <clipPath id="cmBase"><path d="${base}"/></clipPath>
    <filter id="cmBlurA" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="3.2"/></filter>
    <filter id="cmBlurB" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="4.6"/></filter>
  </defs>
  <g class="cm-sparks">${sparkle(6, 56, .9, 0)}${sparkle(232, 36, .7, .8)}${sparkle(238, 150, 1, 1.6)}${sparkle(-2, 176, .65, 2.2)}${sparkle(226, 236, .6, 1.1)}</g>
  <!-- pedestal -->
  <g clip-path="url(#cmBase)"><path d="${base}" fill="${RED}"/><rect x="30" y="320" width="180" height="20" fill="${RED_EDGE}"/>
    <path d="M66 304L54 322" stroke="${RED_LIGHT}" stroke-width="5" stroke-linecap="round" opacity=".9"/></g>
  <path d="${base}" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linejoin="round"/>
  <!-- tray lip (the capsule lands here) -->
  <ellipse cx="${TRAY.x}" cy="${TRAY.y + 11}" rx="38" ry="10" fill="${CHROME_DARK}" stroke="${INK}" stroke-width="4"/>
  <ellipse cx="${TRAY.x}" cy="${TRAY.y + 10}" rx="30" ry="5.5" fill="#2A1416"/>
  <!-- body -->
  <rect x="54" y="202" width="132" height="100" rx="12" fill="${RED}" stroke="${INK}" stroke-width="5.5"/>
  <path d="M62 216Q62 209 69 209" fill="none" stroke="${RED_LIGHT}" stroke-width="5" stroke-linecap="round"/>
  <!-- chrome front plate -->
  <rect x="68" y="208" width="104" height="82" rx="10" fill="url(#cmChrome)" stroke="${INK}" stroke-width="4.5"/>
  <rect x="73" y="213" width="94" height="72" rx="7" fill="none" stroke="${CHROME_EDGE}" stroke-width="2" opacity=".5"/>
  <path d="M76 226V220Q76 216 80 216H90" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
  <!-- coin slot -->
  <rect x="104" y="213" width="32" height="12" rx="4" fill="${CHROME_DARK}" stroke="${INK}" stroke-width="3"/>
  <rect x="109" y="217.5" width="22" height="3.6" rx="1.8" fill="${INK}"/>
  <!-- crank -->
  <g class="cm-knob">
    <circle class="cm-knob-ring" cx="120" cy="249" r="26" fill="none" stroke="#FFE36B" stroke-width="5" opacity="0"/>
    <circle cx="120" cy="249" r="20" fill="${CHROME_DARK}" stroke="${INK}" stroke-width="4"/>
    <circle cx="120" cy="249" r="14.5" fill="url(#cmChrome)" stroke="${INK}" stroke-width="3"/>
    <g class="cm-knob-turn">
      <rect x="96" y="243.5" width="48" height="11" rx="5.5" fill="url(#cmChrome)" stroke="${INK}" stroke-width="3.2"/>
      <circle cx="120" cy="249" r="3.6" fill="${INK}"/>
    </g>
  </g>
  <!-- flap chute -->
  <rect x="96" y="272" width="48" height="14" rx="4" fill="#2A1416" stroke="${INK}" stroke-width="3.5"/>
  <rect class="cm-flap" x="97.5" y="272" width="45" height="10" rx="3.5" fill="url(#cmChrome)" stroke="${INK}" stroke-width="3"/>
  <!-- collar -->
  <rect x="60" y="188" width="120" height="20" rx="8" fill="${RED}" stroke="${INK}" stroke-width="5"/>
  <path d="M70 196H112" stroke="${RED_LIGHT}" stroke-width="4.5" stroke-linecap="round" opacity=".9"/>
  <!-- globe -->
  <g class="cm-globe">
    <circle cx="${GX}" cy="${GY}" r="${GR}" fill="url(#cmGlass)"/>
    <g clip-path="url(#cmGlobe)"><g class="cm-caps">${capsLayer(spots)}</g></g>
    <path d="M${GX - 62} ${GY - 20}A66 66 0 0 1 ${GX - 20} ${GY - 63}" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".75"/>
    <circle cx="${GX - 66}" cy="${GY + 2}" r="4.5" fill="#fff" opacity=".7"/>
    <path d="M${GX + 48} ${GY + 48}A66 66 0 0 1 ${GX + 28} ${GY + 64}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".45"/>
    <circle cx="${GX}" cy="${GY}" r="${GR}" fill="none" stroke="${INK}" stroke-width="6"/>
  </g>
  <!-- cap + top knob -->
  <path d="M88 34Q88 6 120 6Q152 6 152 34Q120 24 88 34Z" fill="${RED}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M98 24Q102 14 114 12" fill="none" stroke="${RED_LIGHT}" stroke-width="4.5" stroke-linecap="round"/>
  <rect x="113" y="-4" width="14" height="12" rx="4" fill="${RED_EDGE}" stroke="${INK}" stroke-width="4"/>
  <circle cx="120" cy="-2" r="6.5" fill="${RED}" stroke="${INK}" stroke-width="4"/>
  <circle cx="118" cy="-4" r="1.8" fill="#fff" opacity=".8"/>
</svg>`;
}
/* the capsule that comes out of the chute (an HTML button so it's a big, reliable tap target) */
function outCap(rar){
  const c = COL[rar], R = 20;
  return `<span class="cm-out-halo"></span><svg class="cm-out-svg" viewBox="-24 -24 48 48" aria-hidden="true">
    <path d="M${-R} 0A${R} ${R} 0 0 1 ${R} 0Z" fill="${c}"/><path d="M${-R} 0A${R} ${R} 0 0 0 ${R} 0Z" fill="#F3F7FB"/>
    <path d="M${-R} 0H${R}" stroke="${INK}" stroke-width="2.6"/><circle r="${R}" fill="none" stroke="${INK}" stroke-width="3.2"/>
    <ellipse cx="-7" cy="-9" rx="5.5" ry="3" transform="rotate(-32 -7 -9)" fill="#fff" opacity=".85"/></svg>
    <i class="cm-twinkle a"></i><i class="cm-twinkle b"></i><i class="cm-twinkle c"></i>`;
}

/* Capsule.machine(el, { onTake(rarity) }) -> { dispense(rarity) -> Promise, setTray(rarity|null), trayRect(), refill() } */
function machine(el, opts){
  opts = opts || {};
  el.classList.add('cm');
  el.innerHTML = machineSVG(layout()) + `<button class="cm-out" type="button" hidden style="left:${pc(TRAY.x, VB.x, VB.w)};top:${pc(TRAY.y, VB.y, VB.h)};--chute:${((CHUTE.y - TRAY.y) / (0.34 * VB.w) * 100).toFixed(1)}%"></button>`;
  const out = el.querySelector('.cm-out');
  let tray = null, busy = false;
  const svg = el.querySelector('.cm-svg');
  svg.addEventListener('click', () => { if(!tray && !busy && !reduced()){ el.classList.remove('cm-wiggle'); void el.offsetWidth; el.classList.add('cm-wiggle'); } });
  out.addEventListener('click', () => { if(tray && !busy && opts.onTake) opts.onTake(tray); });
  function show(rar){
    tray = rar; el.dataset.tray = rar;
    out.className = 'cm-out r-' + rar; out.innerHTML = outCap(rar); out.hidden = false;
    out.setAttribute('aria-label', `Your ${rar} capsule. Tap to pick it up`);
  }
  return {
    setTray(rar){
      if(!rar){ tray = null; delete el.dataset.tray; out.hidden = true; out.className = 'cm-out'; el.classList.remove('has-cap'); return; }
      show(rar); out.classList.add('settled'); el.classList.add('has-cap');
    },
    async dispense(rar){
      busy = true; this.setTray(null);
      if(reduced()){ this.setTray(rar); busy = false; return; }
      el.classList.add('turning');                       // crank turns, globe shakes, the flap swings open
      await wait(850);
      show(rar); out.classList.add('drop');              // out of the chute, bounce into the tray
      await wait(700);
      out.classList.remove('drop'); out.classList.add('settled'); el.classList.add('has-cap');
      el.classList.remove('turning');
      busy = false;
    },
    trayRect(){ return out.querySelector('.cm-out-svg') ? out.querySelector('.cm-out-svg').getBoundingClientRect() : out.getBoundingClientRect(); },
    refill(){ const g = el.querySelector('.cm-caps'); if(g) g.innerHTML = capsLayer(layout()); },
  };
}

/* the big capsule: two halves that can fly apart */
function bigHalves(rar){
  const c = COL[rar], R = 46;
  const top = `<svg class="cap-top" viewBox="-50 -50 100 100" aria-hidden="true"><path d="M${-R} 0A${R} ${R} 0 0 1 ${R} 0Z" fill="${c}" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M-30-22Q-22-34-8-38" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".8"/><circle cx="-35" cy="-8" r="3.6" fill="#fff" opacity=".7"/></svg>`;
  const bot = `<svg class="cap-bot" viewBox="-50 -50 100 100" aria-hidden="true"><path d="M${-R} 0A${R} ${R} 0 0 0 ${R} 0Z" fill="#F3F7FB" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
    <rect x="${-R - 1}" y="-1" width="${2 * R + 2}" height="8" rx="4" fill="${c}" stroke="${INK}" stroke-width="3.5"/>
    <path d="M24 26Q32 18 36 8" fill="none" stroke="#D2DCE6" stroke-width="5" stroke-linecap="round"/></svg>`;
  return top + bot;
}

function confetti(host, rar){
  if(reduced()) return;
  const n = { Common:26, Uncommon:36, Rare:50, Legendary:84, Collector:120 }[rar] || 30;
  const big = rar === 'Legendary' || rar === 'Collector';
  const cols = [COL[rar], COL[rar], '#FFFFFF', '#FFE36B', rar === 'Collector' ? '#B8FFE4' : rar === 'Legendary' ? '#FFD08A' : '#FFB3CB'];
  for(let i = 0; i < n; i++){
    const p = document.createElement('i'), star = big ? Math.random() < .4 : Math.random() < .15;
    p.className = 'cap-bit' + (star ? ' star' : Math.random() < .4 ? ' dot' : '');
    p.style.background = cols[i % cols.length];
    const s = (star ? 12 : 8) + Math.random() * (big ? 10 : 6); p.style.width = s + 'px'; p.style.height = (star || p.classList.contains('dot') ? s : s * .55) + 'px';
    host.appendChild(p);
    const a = Math.random() * Math.PI * 2, d = (big ? 170 : 120) + Math.random() * (big ? 260 : 170);
    const dx = Math.cos(a) * d, dy = Math.sin(a) * d * .8 - 40, rot = (Math.random() - .5) * 900;
    const an = p.animate([
      { transform:'translate(-50%,-50%) scale(.4)', opacity:1 },
      { transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${rot * .6}deg) scale(1)`, opacity:1, offset:.55 },
      { transform:`translate(calc(-50% + ${dx * 1.12}px),calc(-50% + ${dy + 180}px)) rotate(${rot}deg) scale(.9)`, opacity:0 }],
      { duration:1500 + Math.random() * 1100, easing:'cubic-bezier(.12,.75,.3,1)', delay:Math.random() * (big ? 260 : 80), fill:'forwards' });
    an.onfinish = () => p.remove();
  }
}

function open(res, o){
  const rar = RARITIES.includes(res.rarity) ? res.rarity : 'Common', esc = o.esc || (s => String(s));
  const ov = document.createElement('div');
  ov.className = 'cap-ov r-' + rar;
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Your capsule');
  ov.innerHTML = `<div class="cap-dim"></div><div class="cap-stage">
      <div class="cap-rays" aria-hidden="true"></div>
      <button class="cap-big" type="button" aria-label="Your ${rar} capsule"><span class="cap-bob"><span class="cap-halo"></span>${bigHalves(rar)}</span></button>
      <button class="cap-open" type="button" aria-label="Open your ${rar} capsule">Open</button>
      <div class="cap-flash" aria-hidden="true"></div><div class="cap-fx" aria-hidden="true"></div>
    </div>`;
  document.body.appendChild(ov);
  document.documentElement.classList.add('cap-lock');
  const big = ov.querySelector('.cap-big'), stage = ov.querySelector('.cap-stage'), openBtn = ov.querySelector('.cap-open');
  let mount = null, opened = false, closed = false;

  // 1. out of the chute and over to the middle of the screen
  requestAnimationFrame(() => ov.classList.add('in'));
  const from = o.from && o.from();
  if(from && from.width && !reduced()){
    const b = big.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const fx = from.left + from.width / 2 - cx, fy = from.top + from.height / 2 - cy, s0 = Math.max(.12, from.width * .8 / b.width);
    big.animate([
      { transform:`translate(${fx}px,${fy}px) scale(${s0}) rotate(0deg)`, opacity:1 },
      { transform:`translate(${fx * .5}px,${fy * .45 - 60}px) scale(${(s0 + 1) / 2}) rotate(180deg)`, offset:.5 },
      { transform:'translate(0,0) scale(1.12) rotate(350deg)', offset:.85 },
      { transform:'translate(0,0) scale(1) rotate(360deg)' }],
      { duration:900, easing:'cubic-bezier(.3,.6,.3,1)' });
    setTimeout(() => ov.classList.add('landed'), 900);
  } else ov.classList.add('landed');
  setTimeout(() => { try{ openBtn.focus({ preventScroll:true }); }catch(e){} }, 950);

  // 2. Open (or a tap on the capsule itself): wobble, crack, prize
  const crack = async () => {
    if(opened || !ov.classList.contains('landed')) return; opened = true;
    ov.classList.add('wobble'); openBtn.disabled = true;
    await wait(reduced() ? 0 : 720);
    ov.classList.add('cracked');
    confetti(ov.querySelector('.cap-fx'), rar);
    showPrize();
  };
  openBtn.addEventListener('click', crack); big.addEventListener('click', crack);
  function showPrize(){
    const it = res.item, card = document.createElement('div');
    card.className = 'cap-card r-' + rar;
    if(it){
      card.innerHTML = `<div class="cap-head">${HEAD[rar]}</div><div class="cap-pv" data-pv></div>
        <div class="cap-nm">${esc(it.name)}</div>
        <div class="cap-meta"><span class="rar ${rar}">${rar}</span><span class="cap-kind">${KIND[it.kind] || ''}</span></div>
        <div class="cap-btns"><button class="btn sun" type="button" data-wear>Wear it</button><button class="btn alt" type="button" data-done>Done</button></div>`;
    } else {
      card.innerHTML = `<div class="cap-head">${rar} capsule!</div>
        <div class="cap-pv cap-refund"><div class="cap-coin">${o.coinSVG ? o.coinSVG(84) : ''}</div><b>+${Number(res.refund || 0).toLocaleString()} coins</b></div>
        <div class="cap-nm">You already have them all!</div>
        <div class="cap-meta"><span class="rar ${rar}">${rar}</span><span class="cap-kind">You own every ${rar} item</span></div>
        <div class="cap-btns"><button class="btn sun" type="button" data-done>Done</button></div>`;
    }
    stage.appendChild(card);
    if(it && o.renderItem) mount = o.renderItem(card.querySelector('[data-pv]'), it);
    requestAnimationFrame(() => card.classList.add('show'));
    const wear = card.querySelector('[data-wear]');
    if(wear) wear.addEventListener('click', async () => {
      wear.disabled = true;
      try{ await o.onWear(it); close(); }
      catch(e){ wear.disabled = false; }
    });
    card.querySelector('[data-done]').addEventListener('click', close);
    setTimeout(() => { try{ (wear || card.querySelector('[data-done]')).focus({ preventScroll:true }); }catch(e){} }, 400);
  }
  function close(){
    if(closed) return; closed = true;
    document.removeEventListener('keydown', key);
    ov.classList.add('out');
    setTimeout(() => { if(mount) mount.destroy(); ov.remove(); document.documentElement.classList.remove('cap-lock'); }, reduced() ? 0 : 260);
    o.onClose && o.onClose();
  }
  const key = e => { if(e.key === 'Escape' && ov.querySelector('.cap-card')) close(); };
  document.addEventListener('keydown', key);
  return { close };
}

/* a little capsule picture (for the legend under the machine) */
function icon(rar, size){
  const c = COL[rar] || COL.Common;
  return `<svg class="cap-ico r-${rar}" viewBox="-15 -15 30 30" width="${size || 26}" height="${size || 26}" aria-hidden="true">
    <path d="M-12 0A12 12 0 0 1 12 0Z" fill="${c}"/><path d="M-12 0A12 12 0 0 0 12 0Z" fill="#F3F7FB"/><path d="M-12 0H12" stroke="${INK}" stroke-width="2"/>
    <circle r="12" fill="none" stroke="${INK}" stroke-width="2.6"/><ellipse cx="-4.2" cy="-5.6" rx="3.8" ry="2.2" transform="rotate(-32 -4.2 -5.6)" fill="#fff" opacity=".85"/></svg>`;
}

window.Capsule = { machine, open, icon, RARITIES, COLOURS:COL };
})();
