/* =====================================================================
   MATHCADE ONLINE: accounts, coins, shop, game codes and leaderboards.
   Every page and game loads this file after mathcade-config.js.
   It talks to Supabase only through the mc_* database functions
   (see setup/mathcade-setup.sql), using plain fetch: no other libraries.
   ===================================================================== */
(function(){
'use strict';
const CFG = Object.assign({ supabaseUrl:'', supabaseKey:'' }, window.MATHCADE_CONFIG || {});
const SCRIPT = document.currentScript;
const ROOT = SCRIPT && SCRIPT.src ? new URL('.', SCRIPT.src).href : new URL('.', location.href).href;
const K = { token:'mathcade_token', user:'mathcade_user', pending:'mathcade_pending' };
const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ v==null ? localStorage.removeItem(k) : localStorage.setItem(k,v); }catch(e){} },
  json(k){ try{ return JSON.parse(store.get(k)); }catch(e){ return null; } },
};
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------------------------------------------------------------
   Game catalogue: ids match the mc_games table. Settings are what a
   teacher can choose when hosting a class game.
   --------------------------------------------------------------------- */
const TOPICS = [
  ['mixed','Mixed: all main topics'],['integers','Integers & order of operations'],['fractions','Fractions'],['decimals','Decimals'],
  ['percentages','Percentages'],['algterms','Multiplying and dividing algebraic terms'],['coordinates','Graphs and coordinates'],
  ['ratio','Ratios & rates'],['algebra','Algebra'],['measurement','Measurement'],['angles','Angles & geometry'],
  ['pythagoras','Pythagoras & trigonometry'],['linear_equations','Solving linear equations'],['stats','Probability'],
  ['statistics','Statistics'],['timestables','Times tables'],['squares','Squares & square roots'],['indexlaws','Index laws'],
  ['mentalpercent','Quick percentages'],
];
const DIFF = { key:'difficulty', label:'Maths difficulty', type:'choice', options:[['easy','Easy'],['medium','Medium'],['hard','Hard']], def:'medium' };
const TOPIC = { key:'topic', label:'Maths topic', type:'select', options:TOPICS, def:'mixed' };
const mins = (def, max) => ({ key:'minutes', label:'Round length (minutes)', type:'number', min:1, max, def });
const GAMES = [
  { id:'slice-rush',   name:'Slice Rush',                   file:'slice-rush.html',        settings:[mins(10,60), TOPIC, DIFF] },
  { id:'ctf',          name:'Battle Tank Capture the Flag', file:'ctf.html',               settings:[mins(5,20), TOPIC, DIFF],
    note:'One live match for the whole class, with no computer tanks. When the game starts, students are split at random into two even teams, Red and Blue, on the same map. Keep this screen open (it runs the match). If a team makes 3 captures before time is up, a new round starts by itself; points add up.' },
  { id:'royale',       name:'Battle Tank Royale',           file:'royale.html',            timed:false,
    settings:[TOPIC, DIFF],
    note:'One live battle for the whole class, every student for themselves: the arena has one lane per student. Keep this screen open (it runs the battle). A new battle starts by itself after each one; points add up until you end the game.' },
  { id:'fishing',      name:'Fishing Fury',                 file:'fishing.html',           settings:[mins(10,60), TOPIC, DIFF] },
  { id:'speed-run',    name:'Speed Run',                    file:'speed-run.html',         timed:false,
    settings:[{ key:'rounds', label:'Races', type:'number', min:1, max:20, def:3 }, TOPIC, DIFF],
    note:'Fastest finish time wins. End the game when everyone has finished.' },
  { id:'lava',         name:'Leap, Ladder, Lava',           file:'lava.html',              timed:false,
    settings:[{ key:'rounds', label:'Climbs', type:'number', min:1, max:20, def:3 },
              { key:'lava', label:'Lava speed', type:'choice', options:[['easy','Slow'],['medium','Medium'],['hard','Fast']], def:'medium' }, TOPIC, DIFF],
    note:'Fastest climb wins. End the game when everyone has finished.' },
  { id:'treasure',     name:'Treasure Isles',               file:'treasure-isles.html',    settings:[mins(5,60),
    { key:'crews', label:'Crews', type:'choice', options:[['2','2 crews'],['4','4 crews']], def:'2' }, TOPIC, DIFF],
    teamsFrom:s => (s.crews==='4' ? ['Blue','Red','Green','Gold'] : ['Blue','Red']) },
  { id:'sharpshooter', name:'Carnival Sharpshooter',        file:'sharpshooter.html',      settings:[mins(3,30), TOPIC, DIFF] },
  { id:'speed-golf',   name:'Speed Golf',                   file:'speed-golf.html',        timed:false,
    settings:[{ key:'holes', label:'Holes', type:'choice', options:[['9','9 holes'],['18','18 holes']], def:'9' }, TOPIC, DIFF],
    note:'Lowest time wins (a wrong answer locks the student out for 3 seconds). End the game when everyone has finished.' },
  { id:'zombie',       name:'Team Total Outbreak',          file:'zombie-lab.html',        settings:[mins(3,20), TOPIC, DIFF],
    teamNote:'When the game starts, half the class become zombies and half scientists, at random. Team sizes show on the big screen.',
    note:'One live lab for the whole class. Zombies hunt, scientists hide. A tag starts a maths race: first to 3 right answers wins, so the scientist is infected or the zombie is cured. When time is up, the bigger side wins. Keep this screen open (it runs the game).' },
  { id:'hideseek',     name:'Hide & Seek',                  file:'hide-seek.html',         settings:[mins(10,20), TOPIC, DIFF],
    teamNote:'When the game starts, the class is split into Red and Blue at random. Every minute the teams swap: one hides, the other seeks.',
    note:'One live warehouse for the whole class. Two teams take turns to hide and seek, swapping every minute. A seeker who tags a hider scores a point for their team; the hider is back 10 seconds later. Moving uses stamina, and each right answer adds 10 seconds. Most catches wins. Keep this screen open (it runs the game).' },
  { id:'farm',         name:'Fruit Farm',                   file:'fruit-farm.html',        settings:[mins(10,60), TOPIC, DIFF],
    note:'Each student runs their own farm: dig, plant, water (each right answer gives 5 L), grow, pick and sell at the market. Only fruit that is sold counts: most money from sales wins.' },
  { id:'mining',       name:'Dig Deep',                     file:'mining.html',            settings:[mins(10,30), TOPIC, DIFF],
    note:'Everyone digs the same caves and sees each other. Mine ore, answer to sharpen a blunt pickaxe, bank at the hub and buy upgrades. Only banked money counts: most money banked wins. (Base version: each iPad has its own rocks.)' },
  { id:'outbreak',     name:'Total Outbreak',               file:'total-outbreak.html',    settings:[mins(8,20), TOPIC, DIFF],
    teamNote:'When the game starts, one student at random is the zombie; everyone else is human. Anyone infected stays a zombie.',
    note:'One school campus at night for the whole class. One zombie hunts; humans use their torches (charged by right answers) to see. A tag starts a maths race: first to 3 right answers. The zombie wins and the human is infected for good; the human wins and escapes. Humans still standing at the end survived (+20 coins). Keep this screen open (it runs the game).' },
  { id:'grand-prix',   name:'Mathcade Grand Prix',          file:'grand-prix/index.html',  timed:false,
    // Monza and Spa were retired on 17 October 2026 (see retired/README.md). To offer them again, make the options
    // [['monza','Monza'],['vegas','Las Vegas'],['spa','Spa']] and add their ids back to F1.TRACK_ORDER in the game.
    settings:[{ key:'track', label:'Track', type:'choice', options:[['vegas','Las Vegas']], def:'vegas' },
              { key:'laps', label:'Laps', type:'number', min:1, max:3, def:1 }, TOPIC, DIFF],
    note:'Everyone races their own Grand Prix. Fastest race time wins.' },
];
const gameById = id => GAMES.find(g => g.id === id);

/* ---------------------------------------------------------------------
   Server calls
   --------------------------------------------------------------------- */
function configured(){
  return /^https:\/\/.+/.test(CFG.supabaseUrl||'') && !!CFG.supabaseKey && !/PASTE/.test(CFG.supabaseKey) || !!CFG.devUrl;
}
function apiBase(){ return (CFG.devUrl || CFG.supabaseUrl).trim().replace(/\/+$/,'').replace(/\/rest\/v1$/,'') + '/rest/v1/rpc/'; }
function mkErr(message, hint){ const e = new Error(message); e.hint = hint || null; return e; }
async function rpc(fn, args){
  if(!configured()) throw mkErr('Mathcade online isn’t set up yet. Your teacher needs to finish the setup guide.', 'config');
  const headers = { 'Content-Type':'application/json', 'apikey':CFG.supabaseKey || 'dev' };
  if(/^eyJ/.test(CFG.supabaseKey||'')) headers.Authorization = 'Bearer ' + CFG.supabaseKey;
  let res;
  try{ res = await fetch(apiBase() + fn, { method:'POST', headers, body:JSON.stringify(args || {}) }); }
  catch(e){ throw mkErr('Can’t reach the Mathcade server. Check your internet connection.', 'network'); }
  let body = null; try{ body = await res.json(); }catch(e){}
  if(!res.ok){
    let msg = (body && (body.message || body.msg || body.error_description)) || ('Server error ' + res.status);
    if(res.status === 404 || (body && body.code === 'PGRST202')) msg = 'The Mathcade database isn’t set up yet (run the setup SQL in Supabase).';
    if(res.status === 401 && /api key/i.test(msg)) msg = 'The Supabase key in mathcade-config.js isn’t right.';
    const e = mkErr(msg, body && body.hint);
    if(e.hint === 'auth' && token()) setAuth(null, null);
    throw e;
  }
  if(body && typeof body === 'object' && !Array.isArray(body) && body.error && Object.keys(body).length === 1) throw mkErr(body.error);
  return body;
}

/* ---------------------------------------------------------------------
   Login state
   --------------------------------------------------------------------- */
// the shared styles (name effects, toasts) are needed on every page
if(document.head) injectCSS(); else document.addEventListener('DOMContentLoaded', injectCSS);
const listeners = new Set();
let USER = store.json(K.user);
const token = () => store.get(K.token);
function setAuth(tok, profile){
  store.set(K.token, tok || null);
  setUser(tok ? profile : null);
}
function setUser(profile){
  USER = profile || null;
  store.set(K.user, USER ? JSON.stringify(USER) : null);
  listeners.forEach(fn => { try{ fn(USER); }catch(e){ console.error(e); } });
}
function onUser(fn){ listeners.add(fn); try{ fn(USER); }catch(e){ console.error(e); } return () => listeners.delete(fn); }
async function refreshMe(){
  if(!token()) { setUser(null); return null; }
  try{ setUser(await rpc('mc_me', { p_token:token() })); }
  catch(e){ if(e.hint === 'auth') setAuth(null, null); }
  return USER;
}
async function login(username, password){
  const r = await rpc('mc_login', { p_username:username.trim(), p_password:password });
  setAuth(r.token, r.profile); flushPending(); return r.profile;
}
async function signup(username, password){
  const r = await rpc('mc_signup', { p_username:username.trim(), p_password:password });
  setAuth(r.token, r.profile); flushPending(); return r.profile;
}
async function logout(){
  const t = token(); setAuth(null, null);
  if(t) try{ await rpc('mc_logout', { p_token:t }); }catch(e){}
}
function authed(fn, args){ return rpc(fn, Object.assign({ p_token:token() }, args || {})); }

/* ---------------------------------------------------------------------
   Cosmetics: how a username looks everywhere (colour, icon, title)
   --------------------------------------------------------------------- */
const ICON_PATHS = {
  star:'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z',
  bolt:'M13.5 2L4 13.5h6.5L9 22l10-12h-6.5z',
  heart:'M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.6 4.5 4.5 0 0 1 20 9.5c0 6.1-8 11-8 11z',
  pi:'M4 6.5h16v3h-3.2v7.2c0 1 .5 1.4 1.4 1.4h.8v2.7h-2.2c-2.4 0-3.4-1.2-3.4-3.6V9.5h-3.6l-.6 11.3H6l.6-11.3H4z',
  rocket:'M12 2c3.5 2.2 5.2 5.7 5 10l2.5 3.5-3 1.5-1.4-2H8.9l-1.4 2-3-1.5L7 12c-.2-4.3 1.5-7.8 5-10zm0 6a1.8 1.8 0 1 0 0 3.6A1.8 1.8 0 0 0 12 8zm-2 9h4l-2 5z',
  crown:'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z',
  diamond:'M6.5 3h11L22 9l-10 12L2 9z',
};
function iconSVG(shape, colour, size){
  const d = ICON_PATHS[shape]; if(!d) return '';
  const s = size || 18;
  return `<svg class="mc-ico" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="${d}" fill="${esc(colour||'#FFB020')}" stroke="#1E2433" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}
function nameHTML(username, look, opts){
  look = look || {}; opts = opts || {};
  const col = look.colour || null, fx = col && col.fx ? String(col.fx).replace(/[^a-z]/g, '') : '';
  const style = col && !col.rainbow && !fx ? `color:${esc(col.hex)}` : (fx && col.hex ? `--nc:${esc(col.hex)}` : '');
  const cls = 'mc-name' + (col && col.rainbow ? ' mc-rainbow' : '') + (col ? ' mc-coloured' : '') + (fx ? ' mc-fx mc-fx-' + fx : '');
  // letters bob one after another for the "wave" effect, so each gets its own span
  const text = fx === 'wave' ? Array.from(username).map((ch, i) => `<i style="--i:${i}">${esc(ch)}</i>`).join('') : esc(username);
  return `<span class="mc-nm">${look.icon ? iconSVG(look.icon, col && !col.rainbow && !fx ? col.hex : '#FFB020', opts.iconSize) : ''}<span class="${cls}" style="${style}">${text}</span>${
    opts.title !== false && look.title ? `<span class="mc-title">${esc(look.title)}</span>` : ''}</span>`;
}
const coinSVG = (s=18) => `<svg class="mc-coin" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#FFD23F" stroke="#B07A06" stroke-width="2"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#E0A50E" stroke-width="1.6"/><path d="M12 8.3v7.4" stroke="#B07A06" stroke-width="2" stroke-linecap="round"/></svg>`;

/* ---------------------------------------------------------------------
   Shared look for overlays, toasts and the login box
   --------------------------------------------------------------------- */
/* every game: lift the multiple-choice answers clear of the bottom corners of the screen, where Netlify's badge
   sits and covered the bottom-right answer on iPads (20 Oct 2026) */
(function liftAnswers(){
  const add = () => { if(document.getElementById('mc-ans-lift')) return; const st = document.createElement('style'); st.id = 'mc-ans-lift';
    st.textContent = '.answers{margin-bottom:calc(52px + env(safe-area-inset-bottom,0px))!important}'; document.head.appendChild(st); };
  if(document.head) add(); else document.addEventListener('DOMContentLoaded', add);
})();
function injectCSS(){
  if(document.getElementById('mc-css')) return;
  const st = document.createElement('style'); st.id = 'mc-css';
  if(!document.getElementById('mc-fonts')){ const l = document.createElement('link'); l.id = 'mc-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Chakra+Petch:wght@500;600;700&display=swap'; document.head.appendChild(l); }
  st.textContent = `
.mc-ui,.mc-ui *{box-sizing:border-box}
.mc-ui{line-height:1.36;font-family:'Baloo 2','Nunito',ui-rounded,'Segoe UI',system-ui,sans-serif;color:#1E2433;-webkit-font-smoothing:antialiased}
.mc-ui button{font:inherit;cursor:pointer;border:0}
.mc-ui :focus-visible{outline:3px solid #FFE36B;outline-offset:2px}
.mc-veil{position:fixed;inset:0;z-index:2147483000;background:rgba(10,20,36,.72);display:grid;place-items:center;padding:16px;animation:mcFade .18s ease-out}
@keyframes mcFade{from{opacity:0}}
.mc-box{position:relative;width:min(420px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#FFF8EE;border-radius:22px;box-shadow:0 10px 0 rgba(0,0,0,.25);padding:22px 22px 20px}
.mc-box h2{margin:0 0 4px;font-family:'Chakra Petch','Baloo 2','Trebuchet MS',system-ui,sans-serif;font-weight:700;font-size:1.7rem;line-height:1.1}
.mc-box p{margin:6px 0;line-height:1.4}
.mc-x{position:absolute;right:10px;top:10px;width:36px;height:36px;border-radius:50%;background:#F1E3CF;font-size:1.2rem;font-weight:900;color:#5F5A66}
.mc-tabs{display:flex;gap:6px;margin:12px 0 14px;background:#F1E3CF;border-radius:14px;padding:4px}
.mc-tabs button{flex:1;padding:9px 6px;border-radius:11px;background:transparent;font-weight:900;color:#5F5A66}
.mc-tabs button[aria-selected="true"]{background:#fff;color:#1E2433;box-shadow:0 2px 0 #E2C9A6}
.mc-field{display:block;margin:0 0 12px}
.mc-field span{display:block;font-weight:900;font-size:.85rem;margin-bottom:4px}
.mc-field input{width:100%;font:inherit;font-weight:800;font-size:1.05rem;padding:11px 12px;border-radius:12px;border:2px solid #E2C9A6;background:#fff;color:#1E2433}
.mc-field input:focus{border-color:#2EC4B6;outline:none}
.mc-field small{display:block;margin-top:4px;font-weight:800;font-size:.8rem;color:#5F5A66;min-height:1em}
.mc-field small.ok{color:#1A8C5A}.mc-field small.bad{color:#C02A1C}
.mc-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 20px;border-radius:14px;font-weight:900;font-size:1.05rem;background:#2EC4B6;color:#0E2A33;box-shadow:inset 0 -5px 0 #1A8C82;text-decoration:none}
.mc-btn:active{transform:translateY(2px)}
.mc-btn[disabled]{opacity:.55;cursor:default}
.mc-btn.wide{width:100%}
.mc-btn.alt{background:#F1E3CF;color:#1E2433;box-shadow:inset 0 -5px 0 #E2C9A6}
.mc-btn.hot{background:#FF5A3C;color:#fff;box-shadow:inset 0 -5px 0 #B4261C}
.mc-err{min-height:1.2em;margin:4px 0 10px;color:#C02A1C;font-weight:900;font-size:.92rem}
.mc-privacy{font-size:.82rem;color:#5F5A66;font-weight:700;background:#F6E7D3;border-radius:12px;padding:8px 10px;margin-top:12px}
.mc-toasts{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483600;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:min(520px,calc(100% - 24px))}
.mc-toast{pointer-events:auto;display:flex;align-items:center;gap:10px;background:#13233A;color:#fff;border-radius:14px;padding:10px 14px;box-shadow:0 6px 0 rgba(0,0,0,.25);font-weight:800;font-size:.95rem;animation:mcDrop .25s ease-out;max-width:100%}
.mc-toast b{color:#FFE36B}
.mc-toast .mc-btn{padding:7px 12px;font-size:.9rem;box-shadow:inset 0 -3px 0 #1A8C82}
@keyframes mcDrop{from{transform:translateY(-12px);opacity:0}}
.mc-nm{display:inline-flex;align-items:center;gap:5px;min-width:0;vertical-align:middle}
.mc-nm .mc-ico{flex:none}
.mc-name{font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-coloured{-webkit-text-stroke:.35px rgba(0,0,0,.25)}
.mc-rainbow{background:linear-gradient(90deg,#E53935,#FB8C00,#FDD835,#43A047,#1E88E5,#8E24AA);-webkit-background-clip:text;background-clip:text;color:transparent!important}
/* animated name styles (data.fx on a "colour" item): slight, so they stay readable on leaderboards */
.mc-fx{color:var(--nc,#FFE36B);-webkit-text-stroke:0}
.mc-fx-shimmer,.mc-fx-galaxy,.mc-fx-fire,.mc-fx-ice{background-clip:text;-webkit-background-clip:text;color:transparent!important;background-size:250% 100%}
.mc-fx-shimmer{background-image:linear-gradient(100deg,#B8860B 0%,#F7D154 30%,#FFF6C8 48%,#F7D154 58%,#B8860B 100%);animation:mcShimmer 2.6s linear infinite}
.mc-fx-galaxy{background-image:linear-gradient(100deg,#7A4FCC,#4FD8FF,#B46CFF,#7A4FCC);animation:mcShimmer 5s linear infinite}
.mc-fx-fire{background-image:linear-gradient(0deg,#FF4E1A 10%,#FFB02E 55%,#FFF2A8 100%);background-size:100% 220%;animation:mcFlame .7s ease-in-out infinite alternate;filter:drop-shadow(0 0 4px rgba(255,120,30,.6))}
.mc-fx-ice{background-image:linear-gradient(100deg,#7FD4FF 0%,#FFFFFF 45%,#9FE7FF 55%,#5FBDF5 100%);animation:mcShimmer 3.4s linear infinite;filter:drop-shadow(0 0 3px rgba(160,230,255,.55))}
.mc-fx-neon{color:#8FF4FF!important;animation:mcNeon 1.8s ease-in-out infinite}
.mc-fx-electric{color:#FFF200!important;text-shadow:0 0 6px rgba(255,242,0,.7);animation:mcSpark 1.6s steps(1,end) infinite}
.mc-fx-mint{color:#FF3DCB!important;animation:mcMint 2.2s ease-in-out infinite}
.mc-fx-wave{color:var(--nc,#FF8ACB)!important;white-space:nowrap}
.mc-fx-wave i{display:inline-block;font-style:normal;animation:mcWave 1.4s ease-in-out infinite;animation-delay:calc(var(--i,0) * -.11s)}
@keyframes mcShimmer{to{background-position:-250% 0}}
@keyframes mcFlame{from{background-position:0 100%}to{background-position:0 20%}}
@keyframes mcNeon{0%,100%{text-shadow:0 0 4px rgba(143,244,255,.6),0 0 10px rgba(0,200,255,.45)}50%{text-shadow:0 0 8px rgba(143,244,255,.95),0 0 20px rgba(0,200,255,.8)}}
@keyframes mcSpark{0%,88%,100%{opacity:1}90%{opacity:.35}92%{opacity:1}95%{opacity:.5}97%{opacity:1}}
@keyframes mcMint{0%,100%{text-shadow:0 0 5px rgba(255,61,203,.55)}50%{text-shadow:0 0 12px rgba(255,61,203,1),0 0 22px rgba(255,61,203,.6)}}
@keyframes mcWave{0%,100%{transform:translateY(0)}50%{transform:translateY(-.18em)}}
@media (prefers-reduced-motion:reduce){.mc-fx,.mc-fx i{animation:none!important}.mc-fx-shimmer,.mc-fx-galaxy,.mc-fx-fire,.mc-fx-ice{background-position:50% 50%}}
.mc-title{flex:none;font-size:.7em;font-weight:900;text-transform:uppercase;letter-spacing:.05em;background:#1E2433;color:#FFE36B;border-radius:6px;padding:2px 6px}
.mc-coin{vertical-align:-3px}
.mc-lobby{position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;padding:16px;background:radial-gradient(circle at 50% 30%,#24406A,#13233A 70%)}
.mc-lobby .mc-box{text-align:center;width:min(480px,100%)}
.mc-code{display:inline-block;font-family:'Chakra Petch',Impact,sans-serif;font-size:2.2rem;letter-spacing:.12em;background:#13233A;color:#FFE36B;border-radius:14px;padding:6px 16px;margin:6px 0 10px;font-weight:700}
.mc-team{display:inline-block;margin:6px 0;padding:6px 14px;border-radius:999px;font-weight:900;color:#fff;background:#2F6FE4}
.mc-wait{font-weight:900;font-size:1.15rem;margin:14px 0 6px}
.mc-dots::after{content:'';animation:mcDots 1.2s steps(4) infinite}
@keyframes mcDots{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
.mc-count{font-family:'Chakra Petch',Impact,sans-serif;font-size:5rem;color:#FFE36B;text-shadow:0 6px 0 rgba(0,0,0,.3);line-height:1;font-weight:700}
.mc-home{position:fixed;left:14px;bottom:14px;z-index:2147482400;display:inline-flex;align-items:center;gap:8px;background:#FFE36B;color:#4A2606;font:900 1.15rem 'Baloo 2','Nunito',ui-rounded,'Segoe UI',system-ui,sans-serif;text-decoration:none;border-radius:16px;padding:12px 20px;box-shadow:0 5px 0 #D9A21F,0 8px 18px rgba(0,0,0,.3)}
.mc-banner{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147482500;background:#FFE36B;color:#4A2606;font-weight:900;border-radius:14px;padding:10px 16px;box-shadow:0 6px 0 rgba(0,0,0,.25);display:flex;gap:10px;align-items:center;font-family:'Baloo 2','Nunito',ui-rounded,'Segoe UI',system-ui,sans-serif}
.mc-mine{margin-top:10px;font-weight:800;font-size:1.1rem}.mc-mine b{font-family:'Chakra Petch',var(--title);font-size:1.4rem}
.mc-podscreen{align-items:start;overflow:auto;padding:12px}
.mc-podbox{max-width:760px;width:100%;padding:18px 18px 22px}
.mc-podbox h2{font-family:'Chakra Petch','Baloo 2',sans-serif;color:#1E2433}
.mc-sub{font-weight:800;color:#5F5A66;margin:0 0 6px}
.mc-bonus{display:inline-flex;align-items:center;gap:6px;margin:0 0 6px;padding:4px 12px;border-radius:999px;background:#FFF2B8;color:#7A4A00;font-weight:900}
.mc-bonus span{font-weight:800;color:#7A5A20;font-size:.85rem}
.mc-step .mc-pb{display:inline-flex;align-items:center;gap:3px;font-weight:900;font-size:.8rem;background:rgba(255,255,255,.7);border-radius:999px;padding:1px 8px}
.mc-pod{position:relative;display:flex;justify-content:center;align-items:flex-end;gap:clamp(8px,2vw,18px);margin:6px auto 10px;padding-top:6px;max-width:640px;min-height:250px;isolation:isolate;overflow:hidden}
.mc-pod .mc-rays{position:absolute;left:50%;bottom:20%;width:min(800px,120%);aspect-ratio:1;transform:translateX(-50%);z-index:-1;pointer-events:none;border-radius:50%;
  background:repeating-conic-gradient(from 0deg,rgba(255,210,63,.18) 0 10deg,transparent 10deg 22deg);-webkit-mask:radial-gradient(circle,#000 25%,transparent 68%);mask:radial-gradient(circle,#000 25%,transparent 68%);animation:mcRays 26s linear infinite}
@keyframes mcRays{to{transform:translateX(-50%) rotate(360deg)}}
.mc-step{position:relative;display:flex;flex-direction:column;align-items:center;width:clamp(96px,28%,170px)}
.mc-step .mc-who{width:100%;height:0;padding-bottom:100%;position:relative;overflow:visible;margin-bottom:-6px;z-index:1}
.mc-step .mc-who>canvas{position:absolute;left:0;top:0;width:100%!important;height:100%!important}   /* a fixed square: on iPad Safari a canvas inside an aspect-ratio box made the box grow and grow */
.mc-step.p1 .mc-who{transform:scale(1.12);transform-origin:bottom}
.mc-step .mc-crown{position:absolute;left:-14px;top:-24px;transform:rotate(-18deg);width:clamp(40px,6vw,56px);filter:drop-shadow(0 3px 0 rgba(0,0,0,.35));z-index:2}
.mc-step .mc-block{position:relative;width:100%;border-radius:16px 16px 8px 8px;display:flex;flex-direction:column;align-items:center;padding-top:12px;color:#3B2300;box-shadow:inset 0 -8px 0 rgba(0,0,0,.18),0 8px 0 rgba(0,0,0,.3)}
.mc-step.p1 .mc-block{height:170px;background:linear-gradient(180deg,#FFE680,#F2B705);box-shadow:inset 0 -8px 0 rgba(0,0,0,.18),0 8px 0 rgba(0,0,0,.3),0 0 30px rgba(255,210,63,.55)}
.mc-step.p2 .mc-block{height:150px;background:linear-gradient(180deg,#DCE3EB,#8E9BAB)}
.mc-step.p3 .mc-block{height:136px;background:linear-gradient(180deg,#F4C18E,#C7783A)}
.mc-step.p1{order:2}.mc-step.p2{order:1}.mc-step.p3{order:3}
.mc-step .mc-place{position:relative;font-family:'Chakra Petch',Impact,sans-serif;font-weight:700;font-size:2rem;line-height:1}
.mc-step .mc-place sup{font-size:.4em;vertical-align:top;margin-left:2px}
.mc-step .mc-foot{position:absolute;left:0;right:0;bottom:18px;display:flex;flex-direction:column;align-items:center;gap:8px}
.mc-step .mc-pn{font-weight:800;font-size:.8rem;max-width:94%;background:rgba(19,35,58,.88);color:#fff;border-radius:10px;padding:3px 9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-step .mc-pn .mc-nm{max-width:100%}
.mc-step .mc-ps{font-family:'Chakra Petch',sans-serif;font-weight:700;font-size:1.3rem;line-height:1;text-align:center;font-variant-numeric:tabular-nums}
.mc-step .mc-ps small{display:block;margin-top:3px;font-family:'Baloo 2',sans-serif;font-size:.5em;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.7}
.mc-step .mc-shine{position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none}
.mc-step .mc-shine::before{content:'';position:absolute;top:-20%;bottom:-20%;left:-60%;width:45%;transform:skewX(-20deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.35) 30%,rgba(255,255,255,.95) 50%,rgba(255,255,255,.35) 70%,transparent);animation:mcShine 2.8s ease-in-out infinite}
.mc-step.p2 .mc-shine::before{animation-delay:.6s}.mc-step.p3 .mc-shine::before{animation-delay:1.2s}
@keyframes mcShine{0%{left:-60%}45%,100%{left:130%}}
.mc-step.me .mc-block::after{content:'YOU';position:absolute;top:-10px;right:-6px;background:#FF3DCB;color:#fff;font-weight:900;font-size:.7rem;letter-spacing:.08em;padding:3px 8px;border-radius:999px;box-shadow:0 2px 0 rgba(0,0,0,.3)}
.mc-pod.n2 .mc-step.p3,.mc-pod.n1 .mc-step.p2,.mc-pod.n1 .mc-step.p3{display:none}
.mc-rest{list-style:none;margin:6px 0 0;padding:0;text-align:left;max-height:34vh;overflow:auto;border-top:2px solid #E2C9A6}
.mc-rest li{display:flex;align-items:center;gap:10px;padding:7px 6px;border-bottom:1px solid #EFE2CD;font-weight:800;counter-increment:mcr}
.mc-rest li::before{content:counter(mcr) "";color:#5F5A66;min-width:1.6em;text-align:center}
.mc-rest{counter-reset:mcr 3}
.mc-rest li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-rest li b{font-family:'Chakra Petch',sans-serif;font-variant-numeric:tabular-nums}
.mc-rest li.me{background:#FFF2B8;border-radius:8px}
@media (prefers-reduced-motion:reduce){.mc-pod .mc-rays,.mc-step .mc-shine::before{animation:none}}
.mc-cboard{position:fixed;z-index:2147482000;width:min(230px,42vw);background:rgba(19,35,58,.86);color:#fff;border:2px solid rgba(255,255,255,.18);border-radius:14px;padding:7px 9px 8px;font:800 13px/1.25 'Baloo 2','Nunito',ui-rounded,system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.3);cursor:pointer;user-select:none;-webkit-user-select:none;backdrop-filter:blur(3px)}
.mc-cboard .h{display:flex;align-items:center;gap:6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#FFE36B}
.mc-cboard .h i{width:8px;height:8px;border-radius:50%;background:#3CD48A;box-shadow:0 0 0 3px rgba(60,212,138,.25);animation:mcPulse 1.6s infinite}
.mc-cboard .h small{margin-left:auto;background:rgba(255,255,255,.14);border-radius:999px;padding:0 7px;color:#fff;font-size:11px}
@keyframes mcPulse{50%{opacity:.35}}
.mc-cboard ol{list-style:none;margin:5px 0 0;padding:0;display:grid;gap:2px}
.mc-cboard li{display:grid;grid-template-columns:18px 1fr auto;gap:6px;align-items:center;padding:2px 5px;border-radius:7px}
.mc-cboard li b{color:#B9D3DA;text-align:center}.mc-cboard li:nth-child(1) b{color:#FFD23F}.mc-cboard li:nth-child(2) b{color:#E3E9F0}.mc-cboard li:nth-child(3) b{color:#F4C18E}
.mc-cboard li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-cboard li em{font-style:normal;color:#FFE36B;font-variant-numeric:tabular-nums}
.mc-cboard li.me{background:rgba(255,227,107,.2)}
.mc-cboard li.gap{display:block;text-align:center;padding:0;color:#B9D3DA;line-height:.8}
.mc-cboard p{margin:5px 0 0;color:#B9D3DA;font-size:12px}
.mc-cboard.mini ol,.mc-cboard.mini p{display:none}.mc-cboard.mini{width:auto}
@media (prefers-reduced-motion:reduce){.mc-veil,.mc-toast{animation:none}.mc-dots::after{animation:none;content:'...'}}
`;
  document.head.appendChild(st);
}

function toast(html, opts){
  injectCSS(); opts = opts || {};
  let wrap = document.querySelector('.mc-toasts');
  if(!wrap){ wrap = document.createElement('div'); wrap.className = 'mc-toasts mc-ui'; wrap.setAttribute('role','status'); wrap.setAttribute('aria-live','polite'); document.body.appendChild(wrap); }
  const t = document.createElement('div'); t.className = 'mc-toast'; t.innerHTML = `<span>${html}</span>`;
  (opts.actions || []).forEach(a => { const b = document.createElement('button'); b.className = 'mc-btn'; b.textContent = a.label; b.onclick = () => { t.remove(); a.onClick(); }; t.appendChild(b); });
  wrap.appendChild(t);
  const ms = opts.ms == null ? 4500 : opts.ms;
  if(ms) setTimeout(() => t.remove(), ms);
  return t;
}

function modal(inner, opts){
  injectCSS(); opts = opts || {};
  const veil = document.createElement('div'); veil.className = 'mc-veil mc-ui';
  veil.innerHTML = `<div class="mc-box" role="dialog" aria-modal="true">${opts.closable === false ? '' : '<button class="mc-x" aria-label="Close">✕</button>'}${inner}</div>`;
  document.body.appendChild(veil);
  const close = () => { veil.remove(); document.removeEventListener('keydown', onKey, true); opts.onClose && opts.onClose(); };
  const onKey = e => { if(e.key === 'Escape' && opts.closable !== false){ e.stopPropagation(); close(); } else e.stopPropagation(); };
  document.addEventListener('keydown', onKey, true);
  veil.addEventListener('keyup', e => e.stopPropagation()); veil.addEventListener('keypress', e => e.stopPropagation());
  const x = veil.querySelector('.mc-x'); if(x) x.onclick = close;
  return { el:veil, box:veil.querySelector('.mc-box'), close };
}

/* The log in / new account box. Resolves with the user, or null if closed. */
function loginModal(opts){
  opts = opts || {};
  return new Promise(resolve => {
    let done = false, mode = opts.mode || 'login';
    const m = modal(`
      <h2>${esc(opts.title || 'Your Mathcade account')}</h2>
      ${opts.reason ? `<p>${esc(opts.reason)}</p>` : '<p>Log in to save your scores and coins.</p>'}
      <div class="mc-tabs" role="tablist"><button role="tab" data-m="login">Log in</button><button role="tab" data-m="signup">New account</button></div>
      <form novalidate>
        <label class="mc-field"><span>Username</span><input name="u" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="20" required><small id="mcUHint"></small></label>
        <label class="mc-field"><span>Password</span><input name="p" type="password" autocomplete="current-password" maxlength="72" required><small></small></label>
        <label class="mc-field mc-only-signup"><span>Type the password again</span><input name="p2" type="password" autocomplete="new-password" maxlength="72"><small></small></label>
        <div class="mc-err" role="alert"></div>
        <button class="mc-btn wide" type="submit">Log in</button>
      </form>
      <p class="mc-privacy mc-only-signup">Don’t use your real name. Make up a username (letters, numbers or _). Mathcade only keeps your username, your password (scrambled) and your game scores.</p>
      <p class="mc-privacy mc-only-login">Forgotten your password? Your teacher can reset it for you.</p>`,
      { onClose(){ if(!done){ done = true; resolve(null); } } });
    const f = m.box.querySelector('form'), u = f.u, p = f.p, p2 = f.p2, err = m.box.querySelector('.mc-err'), hint = m.box.querySelector('#mcUHint'), go = f.querySelector('button[type=submit]');
    let checkT = 0, checkN = 0;
    function setMode(md){
      mode = md;
      m.box.querySelectorAll('.mc-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.m === md));
      m.box.querySelectorAll('.mc-only-signup').forEach(el => el.style.display = md === 'signup' ? '' : 'none');
      m.box.querySelectorAll('.mc-only-login').forEach(el => el.style.display = md === 'login' ? '' : 'none');
      go.textContent = md === 'signup' ? 'Create account' : 'Log in';
      p.autocomplete = md === 'signup' ? 'new-password' : 'current-password';
      err.textContent = ''; hint.textContent = ''; hint.className = '';
      if(md === 'signup' && u.value) checkName();
    }
    function checkName(){
      clearTimeout(checkT); const v = u.value.trim(), n = ++checkN;
      if(mode !== 'signup' || !v){ hint.textContent = ''; return; }
      if(!/^[A-Za-z0-9_]{3,20}$/.test(v)){ hint.textContent = '3 to 20 letters, numbers or _ (no spaces).'; hint.className = 'bad'; return; }
      hint.textContent = 'Checking…'; hint.className = '';
      checkT = setTimeout(async () => {
        try{ const r = await rpc('mc_username_check', { p_username:v }); if(n !== checkN) return;
             hint.textContent = r.ok ? 'Great, that username is free.' : r.message; hint.className = r.ok ? 'ok' : 'bad'; }
        catch(e){ if(n === checkN){ hint.textContent = ''; } }
      }, 350);
    }
    m.box.querySelectorAll('.mc-tabs button').forEach(b => b.onclick = () => setMode(b.dataset.m));
    u.addEventListener('input', checkName);
    f.addEventListener('submit', async e => {
      e.preventDefault(); err.textContent = '';
      const un = u.value.trim(), pw = p.value;
      if(!un || !pw){ err.textContent = 'Type your username and password.'; return; }
      if(mode === 'signup'){
        if(pw.length < 6){ err.textContent = 'Passwords need at least 6 characters.'; return; }
        if(pw !== p2.value){ err.textContent = 'The two passwords don’t match.'; return; }
      }
      go.disabled = true; const label = go.textContent; go.textContent = 'Please wait…';
      try{
        const user = mode === 'signup' ? await signup(un, pw) : await login(un, pw);
        done = true; m.close(); toast(`${mode === 'signup' ? 'Welcome' : 'Welcome back'}, <b>${esc(user.username)}</b>!`);
        resolve(user);
      }catch(ex){ err.textContent = ex.message; go.disabled = false; go.textContent = label; }
    });
    setMode(mode);
    setTimeout(() => u.focus(), 50);
  });
}

function passwordModal(){
  const m = modal(`<h2>Change password</h2>
    <form novalidate>
      <label class="mc-field"><span>Current password</span><input name="a" type="password" autocomplete="current-password"></label>
      <label class="mc-field"><span>New password</span><input name="b" type="password" autocomplete="new-password"></label>
      <label class="mc-field"><span>New password again</span><input name="c" type="password" autocomplete="new-password"></label>
      <div class="mc-err" role="alert"></div><button class="mc-btn wide" type="submit">Save new password</button></form>`);
  const f = m.box.querySelector('form'), err = m.box.querySelector('.mc-err');
  f.onsubmit = async e => { e.preventDefault(); err.textContent = '';
    if(f.b.value.length < 6){ err.textContent = 'Passwords need at least 6 characters.'; return; }
    if(f.b.value !== f.c.value){ err.textContent = 'The new passwords don’t match.'; return; }
    try{ await authed('mc_change_password', { p_old:f.a.value, p_new:f.b.value }); m.close(); toast('Password changed.'); }
    catch(ex){ err.textContent = ex.message; } };
}

/* ---------------------------------------------------------------------
   Saving a finished game
   --------------------------------------------------------------------- */
let GAME = null;          // the adapter registered by the current game page
let SESSION = null;       // { code, game, team, settings, status, startsAt, endsAt, offset }
function sessionCode(){ return SESSION && SESSION.game === (GAME && GAME.game) ? SESSION.code : null; }

function fmtScore(game, v){
  if(v == null) return '–';
  const g = typeof game === 'string' ? null : game;
  if(g && g.unit === 's'){ const s = +v, m = Math.floor(s / 60), r = s - m * 60; return m ? `${m}:${r.toFixed(1).padStart(4,'0')}` : `${r.toFixed(1)} s`; }
  if(g && g.unit === '$') return '$' + Math.round(+v).toLocaleString();   // Fruit Farm: money from sales
  return Math.round(+v).toLocaleString();
}

async function result(r){
  if(!GAME){ console.warn('Mathcade: result() called before register()'); return null; }
  const payload = {
    p_game: GAME.game, p_score: Math.max(0, Math.round((+r.score || 0) * 100) / 100),
    p_correct: Math.max(0, r.correct | 0), p_answered: Math.max(r.correct | 0, r.answered | 0),
    p_seconds: r.seconds == null ? null : Math.round(r.seconds), p_variant: String(r.variant || ''),
    p_qualified: r.qualified !== false, p_details: r.details || {}, p_save_score: r.save !== false,
    p_bonus_coins: Math.max(0, Math.min(200, r.bonusCoins | 0)),   // coins picked up inside a game (Speed Run); the server caps them too
    p_session_code: sessionCode(),
  };
  if(sessionCode()){ liveStop(true); if(!GAME.keepLive && !SESSION.doneShown){ SESSION.doneShown = true; lockDone(); setTimeout(() => endScreen('finished'), 4500); } }
  if(!token()){
    store.set(K.pending, JSON.stringify(Object.assign({ at:Date.now() }, payload)));
    if(configured()) toast('Log in to save this score and earn coins.', { ms:12000, actions:[{ label:'Log in', onClick:() => loginModal({ reason:'Log in or make an account to save this score.' }) }] });
    return null;
  }
  return submit(payload);
}
async function submit(payload){
  try{
    const out = await rpc('mc_submit_score', Object.assign({ p_token:token() }, payload));
    if(USER){ USER.coins = out.coins; setUser(USER); }
    const bits = [];
    if(payload.p_save_score) bits.push('Score saved');
    if(out.coins_awarded) bits.push(`<b>+${out.coins_awarded}</b> ${coinSVG(16)}`);
    else if(out.daily_cap_reached) bits.push('daily coin limit reached');
    if(payload.p_save_score && out.rank && payload.p_qualified) bits.push(`#${out.rank} on the leaderboard`);
    if(bits.length) toast(bits.join(' · '), { ms:6000 });
    return out;
  }catch(e){
    if(/already saved/i.test(e.message)) return null;
    if(e.hint === 'auth'){ store.set(K.pending, JSON.stringify(Object.assign({ at:Date.now() }, payload))); toast('Log in again to save this score.', { ms:12000, actions:[{ label:'Log in', onClick:() => loginModal() }] }); return null; }
    toast('Couldn’t save your score: ' + esc(e.message), { ms:7000 });
    return null;
  }
}
function flushPending(){
  const p = store.json(K.pending); store.set(K.pending, null);
  if(p && Date.now() - p.at < 30 * 60 * 1000){ delete p.at; submit(p); }
}

/* ---------------------------------------------------------------------
   Class games: lobby, synchronised start, live scores
   --------------------------------------------------------------------- */
let lobbyEl = null, pollT = 0, liveT = 0, liveOn = false, lastSent = '';
function serverNow(){ return Date.now() + (SESSION ? SESSION.offset : 0); }
function teamColour(name){ return ({ Alpha:'#2F6FE4', Bravo:'#E4352D', Blue:'#3E7BD6', Red:'#E2483D', Green:'#38B05B', Gold:'#C99A12', Scientists:'#3E9BDB', Zombies:'#5BAF3A', Humans:'#3E9BDB' })[name] || '#5F5A66'; }
function lobby(html){
  injectCSS();
  if(!lobbyEl){ lobbyEl = document.createElement('div'); lobbyEl.className = 'mc-lobby mc-ui'; document.body.appendChild(lobbyEl);
    ['keydown','keyup','keypress','pointerdown','mousedown','touchstart','wheel'].forEach(t => lobbyEl.addEventListener(t, e => e.stopPropagation()));
  }
  lobbyEl.innerHTML = `<div class="mc-box">${html}</div>`;
  return lobbyEl;
}
function closeLobby(){ if(lobbyEl){ lobbyEl.remove(); lobbyEl = null; } }
const home = () => ROOT + 'index.html';

async function joinFlow(code){
  code = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  lobby(`<h2>Joining game</h2><div class="mc-code">${esc(code)}</div><p class="mc-wait mc-dots">Connecting</p>`);
  if(!configured()){ lobby(`<h2>Not set up yet</h2><p>Mathcade online isn’t set up on this website yet.</p><a class="mc-btn" href="${home()}">Back to my home</a>`); return; }
  if(!token()){
    lobby(`<h2>Log in to join</h2><div class="mc-code">${esc(code)}</div><p>Log in so your score goes on the class leaderboard.</p>`);
    const u = await loginModal({ reason:'Log in to join game ' + code + '.', closable:true });
    if(!u){ lobby(`<h2>Not joined</h2><p>You need to log in to join a class game.</p><button class="mc-btn" id="mcRetry">Log in</button> <a class="mc-btn alt" href="${home()}">Back to my home</a>`);
      lobbyEl.querySelector('#mcRetry').onclick = () => joinFlow(code); return; }
  }
  let j;
  try{ j = await authed('mc_session_join', { p_code:code }); }
  catch(e){ lobby(`<h2>Couldn’t join</h2><p>${esc(e.message)}</p><a class="mc-btn" href="${home()}">Back to my home</a>`); return; }
  if(GAME && j.game !== GAME.game){ const g = gameById(j.game); if(g){ location.replace(ROOT + g.file + '?join=' + code); return; } }
  SESSION = { code:j.code, game:j.game, team:j.team, settings:j.settings || {}, status:j.status,
              startsAt:j.starts_at ? Date.parse(j.starts_at) : null, endsAt:j.ends_at ? Date.parse(j.ends_at) : null,
              offset:Date.parse(j.server_now) - Date.now(), username:j.username, started:false };
  try{ sessionStorage.setItem('mathcade_session', JSON.stringify({ code:j.code, game:j.game })); }catch(e){}
  // waiting happens on the student's home page; the game opens when the teacher presses Start
  if(j.status === 'lobby' && !CFG.allowStudentSolo){ location.replace(home() + '?wait=' + encodeURIComponent(j.code)); return; }
  waitForStart();
}
function lobbyWaiting(){
  const g = gameById(SESSION.game);
  lobby(`<h2>You’re in!</h2>
    <p>${g ? esc(g.name) : ''}</p>
    <div class="mc-code" aria-label="Game code">${esc(SESSION.code)}</div>
    <p>Playing as ${nameHTML(SESSION.username, USER && USER.look)}</p>
    ${SESSION.team ? `<div class="mc-team" style="background:${teamColour(SESSION.team)}">Team ${esc(SESSION.team)}</div>` : ''}
    <p class="mc-wait mc-dots">Waiting for your teacher to start</p>
    <p style="font-size:.9rem;color:#5F5A66;font-weight:700">Keep this page open. The game starts by itself.</p>
    <a class="mc-btn alt" href="${home()}" style="margin-top:8px">Leave</a>`);
}
async function waitForStart(){
  clearTimeout(pollT);
  if(SESSION.status === 'lobby') lobbyWaiting();
  const tick = async () => {
    try{
      const s = await authed('mc_session_update', { p_code:SESSION.code });
      SESSION.status = s.status; SESSION.settings = s.settings || SESSION.settings;
      SESSION.startsAt = s.starts_at ? Date.parse(s.starts_at) : null; SESSION.endsAt = s.ends_at ? Date.parse(s.ends_at) : null;
      SESSION.offset = Date.parse(s.server_now) - Date.now();
      if(!s.joined){ lobby(`<h2>Removed from the game</h2><p>Your teacher took you out of this game.</p><a class="mc-btn" href="${home()}">Back to my home</a>`); return; }
      if(s.status === 'ended'){ lobby(`<h2>This game has finished</h2><p>Ask your teacher for the next code.</p><a class="mc-btn" href="${home()}">Back to my home</a>`); return; }
      if(s.status === 'live'){ countdownThenStart(); return; }
    }catch(e){ if(e.hint === 'auth'){ joinFlow(SESSION.code); return; } }
    pollT = setTimeout(tick, 2000);
  };
  tick();
}
function countdownThenStart(){
  const step = () => {
    const left = Math.ceil((SESSION.startsAt - serverNow()) / 1000);
    if(left > 0){ lobby(`<p class="mc-wait">Get ready${SESSION.team ? `, Team ${esc(SESSION.team)}` : ''}!</p><div class="mc-count">${left}</div>`); pollT = setTimeout(step, 200); return; }
    closeLobby(); beginSessionGame();
  };
  step();
}
function sessionContext(){
  const remaining = SESSION.endsAt ? Math.max(10, (SESSION.endsAt - serverNow()) / 1000) : null;
  return { code:SESSION.code, team:SESSION.team, settings:Object.assign({}, SESSION.settings), username:SESSION.username,
           remainingSeconds:remaining, minutes:remaining ? Math.max(1, Math.round(remaining / 60)) : (+SESSION.settings.minutes || null) };
}
function beginSessionGame(){
  if(SESSION.started) return; SESSION.started = true;
  try{ GAME.start(sessionContext()); }
  catch(e){ console.error(e); toast('This game couldn’t start automatically. Press its Start button.', { ms:8000 }); }
  liveStart();
}
function liveStart(){
  liveOn = true; clearTimeout(liveT);
  const tick = async () => {
    if(!liveOn) return;
    let st = {};
    try{ st = (GAME.live && GAME.live()) || {}; }catch(e){}
    const args = { p_code:SESSION.code, p_score:st.score == null ? null : Math.round(+st.score * 100) / 100,
                   p_correct:st.correct == null ? null : st.correct | 0, p_answered:st.answered == null ? null : st.answered | 0,
                   p_status_text:st.status || null, p_finished:st.finished == null ? null : !!st.finished };
    const key = JSON.stringify(args);
    try{
      const s = await authed('mc_session_update', (key === lastSent || !SESSION.game) ? { p_code:SESSION.code } : args);   // after leaveSession (a solo replay) only listen
      lastSent = key;
      SESSION.offset = Date.parse(s.server_now) - Date.now();
      if(s.status === 'ended' && SESSION.status !== 'ended'){
        SESSION.status = 'ended';
        try{ GAME.onEnded && GAME.onEnded(); }catch(e){}
        endScreen('ended');
        liveOn = false; return;
      }
      if(!s.joined){ liveOn = false; endScreen('removed'); return; }
      if(st.finished && !SESSION.doneShown){ SESSION.doneShown = true; lockDone(); setTimeout(() => endScreen('finished'), 3500); }
    }catch(e){}
    liveT = setTimeout(tick, 3000);
  };
  liveT = setTimeout(tick, 1500);
}
function liveStop(sendFinal){
  if(!liveOn) return;
  clearTimeout(liveT); liveOn = false;
  if(sendFinal){ liveStart(); }   // keep checking in (slowly) so the student hears when the teacher ends the game and sees the podium
}
/* Class games: what a student sees when they've finished or the teacher has ended the game */
function endScreen(kind){
  injectCSS();
  if(kind === 'ended'){ if(CFG.allowStudentSolo){ banner('Game over! Your teacher has ended the game. Look at the big screen for the results!'); return; } showPodium(); return; }
  const t = kind === 'removed' ? ['You’ve left the game', 'Your teacher took you out of this game.']
          : ['Nice work, you’ve finished!', 'Hang tight while the rest of the class finishes. The podium will appear here when your teacher ends the game.'];
  if(CFG.allowStudentSolo){ if(kind !== 'finished') banner(t[0] + ' ' + t[1]); return; }   // solo play allowed: keep the game's own results screen usable
  lockDone();
  const old = document.querySelector('.mc-end'); if(old) old.remove();
  const el = document.createElement('div'); el.className = 'mc-lobby mc-ui mc-end';
  ['keydown','keyup','keypress','pointerdown','mousedown','touchstart','wheel'].forEach(t => el.addEventListener(t, e => e.stopPropagation()));
  let mine = '';
  if(kind === 'finished'){ try{ const st = (GAME.live && GAME.live()) || {}; if(st.score != null) mine = `<div class="mc-mine">Your result: <b>${fmtScore(gameById(SESSION.game) || {}, st.score)}</b></div>`; }catch(e){} }
  el.innerHTML = `<div class="mc-box"><h2>${t[0]}</h2><p>${esc(t[1])}</p>${mine}
    ${kind === 'finished' ? `<p class="mc-wait mc-dots" style="margin-top:10px">Waiting for the class</p>` : `<div style="display:flex;gap:10px;justify-content:center;margin-top:14px"><a class="mc-btn" href="${home()}">Back to my home</a></div>`}</div>`;
  document.body.appendChild(el);
}
/* The final podium every student sees when the teacher ends the game: the same gold, silver and bronze steps
   as the teacher's screen, then the whole class, with their own row marked. Brick is loaded on demand. */
async function showPodium(){
  lockDone();
  const old = document.querySelector('.mc-end'); if(old) old.remove();
  const el = document.createElement('div'); el.className = 'mc-lobby mc-ui mc-end mc-podscreen';
  ['keydown','keyup','keypress','pointerdown','mousedown','touchstart','wheel'].forEach(t => el.addEventListener(t, e => e.stopPropagation()));
  el.innerHTML = `<div class="mc-box mc-podbox"><h2>Final results</h2><p class="mc-wait mc-dots">Getting the results</p></div>`;
  document.body.appendChild(el);
  let b = null;
  for(let i = 0; i < 3 && !b; i++){ try{ b = await authed('mc_session_board', { p_code:SESSION.code }); }catch(e){ await sleep(1500); } }
  const box = el.querySelector('.mc-podbox');
  if(!b){ box.innerHTML = `<h2>Game over!</h2><p>Your teacher has ended the game. Look at the big screen for the results!</p><a class="mc-btn" href="${home()}">Back to my home</a>`; return; }
  const g = b.game, ranked = b.players.filter(p => p.score != null), top = ranked.slice(0, 3), SUF = ['st','nd','rd'];
  const unit = g.unit === 's' ? 'time' : (g.score_label || 'points').toLowerCase(), me = SESSION.username;
  const myRank = ranked.findIndex(p => p.username === me) + 1, myBonus = (ranked.find(p => p.username === me) || {}).bonus || 0;
  box.innerHTML = `<h2>Final results</h2><p class="mc-sub">${esc(g.name)}${myRank ? ` · you came <b>${myRank}${myRank <= 3 ? SUF[myRank - 1] : 'th'}</b>` : ''}</p>
    ${myBonus ? `<p class="mc-bonus">+${myBonus} ${coinSVG(18)} <span>${myRank && myRank <= 3 ? 'for your podium place and finishing' : 'for playing to the end'}</span></p>` : ''}
    ${top.length ? `<div class="mc-pod n${top.length}"><div class="mc-rays"></div>${top.map((p, i) => `<div class="mc-step p${i + 1}${p.username === me ? ' me' : ''}"><div class="mc-who" data-i="${i}"></div>
      <div class="mc-block"><div class="mc-shine"></div>${i === 0 ? '<svg class="mc-crown" viewBox="0 0 64 44" aria-hidden="true"><path d="M6 38 2 8l16 14L32 2l14 20L62 8l-4 30z" fill="#FFD23F" stroke="#4a2c22" stroke-width="4" stroke-linejoin="round"/><circle cx="32" cy="28" r="5" fill="#E4472D" stroke="#4a2c22" stroke-width="3"/><rect x="6" y="36" width="52" height="6" rx="3" fill="#F2B705" stroke="#4a2c22" stroke-width="3"/></svg>' : ''}
        <div class="mc-place">${i + 1}<sup>${SUF[i]}</sup></div><div class="mc-foot"><div class="mc-pn">${nameHTML(p.username, p.look, { title:false, iconSize:16 })}</div><div class="mc-ps">${fmtScore(g, p.score)}<small>${esc(unit)}</small></div>${p.bonus ? `<div class="mc-pb">+${p.bonus} ${coinSVG(14)}</div>` : ''}</div></div></div>`).join('')}</div>` : '<p>No scores this time.</p>'}
    ${ranked.length > 3 ? `<ol class="mc-rest" start="4">${ranked.slice(3).map(p => `<li class="${p.username === me ? 'me' : ''}"><span>${nameHTML(p.username, p.look)}</span><b>${fmtScore(g, p.score)}</b></li>`).join('')}</ol>` : ''}
    <a class="mc-btn" href="${home()}" style="margin-top:14px">Back to my home</a>`;
  if(top.length){
    try{ if(!window.Brick) await loadScript(ROOT + 'brick.js'); }catch(e){}
    if(window.Brick) box.querySelectorAll('.mc-who').forEach(w => { const p = top[+w.dataset.i]; try{ Brick.mount(w, Brick.normalize((p.look && p.look.brick) || {}), { animate:true, view:{ x0:-30, y0:-80, x1:270, y1:218 } }); }catch(e){} });
  }
}
function banner(text){
  injectCSS(); let b = document.querySelector('.mc-banner');
  if(!b){ b = document.createElement('div'); b.className = 'mc-banner'; b.setAttribute('role','status'); document.body.appendChild(b); }
  b.innerHTML = `<span>${esc(text)}</span><a class="mc-btn" style="padding:6px 12px;font-size:.9rem" href="${home()}">Home</a>`;
}

/* A game page calls MC.register({...}) once its own code has loaded.
   adapter = { game:'fishing', start(ctx), live():{score,correct,answered,status,finished}, onEnded(), keepLive } */
/* Games are hosted by the teacher: students only reach a game through a game code.
   Anyone else who opens a game page (not a teacher) is taken to their home page.
   (mathcade-config.js can set allowStudentSolo:true to let students play on their own.) */
function teacherOnly(){
  if(CFG.allowStudentSolo || !configured()) return;
  if(USER && USER.role === 'teacher' && token()) return;
  const root = document.documentElement, away = () => location.replace(home());
  if(!token()){ away(); return; }
  root.style.visibility = 'hidden';
  refreshMe().then(u => { if(u && u.role === 'teacher') root.style.visibility = ''; else away(); }, away);
}
function register(adapter){
  GAME = adapter;
  const params0 = new URLSearchParams(location.search);
  if(!params0.get('join')) teacherOnly();
  // a class game: cover the game's own menu straight away, before anything else runs
  if(params0.get('join') && document.body){ injectCSS(); lobby(`<h2>Joining game</h2><div class="mc-code">${esc(String(params0.get('join')).toUpperCase())}</div><p class="mc-wait mc-dots">Connecting</p>`); }
  const go = () => {
    injectCSS();
    const params = new URLSearchParams(location.search);
    const code = params.get('join');
    if(code){ studentLock(); joinFlow(code); return; }
    if(token() && USER){ setTimeout(() => toast(`Playing as ${nameHTML(USER.username, USER.look)}`, { ms:2600 }), 600); }
    if(token()) refreshMe();
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
}

/* Class games for students: no way back to the games list, and once they've finished
   no "Play again" either, just a Home button to their own home page (shop, locker, character). */
const LOCK = { on:false, done:false, obs:null, raf:0 };
const HUB_TEXT = /^\s*(\u2190\s*)?(all\s+)?games\s*$|back to (all )?games|^\s*\u2190\s*(menu|hub)\s*$/i;
const DONE_TEXT = /\bagain\b|^\s*(\u21bb\s*)?(new game|main menu|change settings|play solo)\b/i;
function studentLock(){
  if(LOCK.on || CFG.allowStudentSolo || (USER && USER.role === 'teacher')) return;
  LOCK.on = true; injectCSS();
  const sweep = () => {
    LOCK.raf = 0;
    document.querySelectorAll('a,button,[role="button"]').forEach(el => {
      if(el.closest('.mc-ui') || el.classList.contains('mc-home')) return;
      const href = el.tagName === 'A' ? (el.getAttribute('href') || '') : '';
      const txt = (el.textContent || '').trim();
      const hub = /(^|\/)(index|games)\.html(\?|#|$)/.test(href) || (href === './' || href === '../') || HUB_TEXT.test(txt);
      if(hub || (LOCK.done && DONE_TEXT.test(txt))){ if(el.style.display !== 'none'){ el.style.display = 'none'; el.setAttribute('data-mc-hidden', ''); } }
    });
  };
  LOCK.sweep = () => { if(!LOCK.raf) LOCK.raf = requestAnimationFrame(sweep); };
  sweep();
  LOCK.obs = new MutationObserver(LOCK.sweep);
  LOCK.obs.observe(document.body, { childList:true, subtree:true, characterData:true });
}
function lockDone(){
  if(!LOCK.on || LOCK.done) return;
  LOCK.done = true; LOCK.sweep();
  if(!document.querySelector('.mc-home')){
    const a = document.createElement('a'); a.className = 'mc-home'; a.href = home();
    a.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Home';
    ['pointerdown','mousedown','touchstart','keydown'].forEach(ev => a.addEventListener(ev, e => e.stopPropagation()));
    a.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); location.href = home(); });
    document.body.appendChild(a);
  }
}

/* After a class round is over, later rounds on the same page count as normal solo play. */
function leaveSession(){ if(SESSION) SESSION.game = null; }   // the check-in keeps going (to hear the game end) but sends no more scores

/* Is this page part of a class game right now? (games use this to hide their own setup) */
function inSession(){ return !!new URLSearchParams(location.search).get('join'); }


/* ---------------------------------------------------------------------
   LIVE MULTIPLAYER (Supabase Realtime broadcast, no extra libraries)
   Students send their own state to the "in" channel a few times a second.
   The teacher's host screen collects everyone and sends one combined
   snapshot to the "out" channel, which every student listens to.
   That keeps the message count to about 10 per student per second.
   --------------------------------------------------------------------- */
/* every class game has a live link: the race / platform / tank games show classmates on the same map,
   and the score games show a live class leaderboard in the corner (MC.classBoard) */
const LIVE_GAMES = ['speed-run', 'royale', 'ctf', 'lava', 'grand-prix', 'slice-rush', 'sharpshooter', 'speed-golf', 'fishing', 'treasure', 'zombie', 'hideseek', 'outbreak', 'mining'];
/* how often the teacher's screen sends the combined snapshot (ms): score-only games need far fewer messages */
const LIVE_RATE = { 'slice-rush':1000, sharpshooter:1000, 'speed-golf':1000, fishing:1000, treasure:1000 };
/* games whose live battle needs a referee on the teacher's screen (adapters/<game>-referee.js) */
const LIVE_REFEREES = ['royale', 'ctf', 'zombie', 'hideseek', 'outbreak'];
const referees = {};
function loadScript(src){ return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Couldn\u2019t load ' + src)); document.head.appendChild(s); }); }
function baseUrl(){ return (CFG.devUrl || CFG.supabaseUrl).trim().replace(/\/+$/,'').replace(/\/rest\/v1$/,''); }
function jwtKey(){ return /^eyJ/.test(CFG.supabaseKey || '') ? CFG.supabaseKey : null; }
class LiveSocket {
  constructor(){ this.ref = 0; this.topics = new Map(); this.ws = null; this.ready = null; this.closed = false; this.hb = 0; this.retry = 0; this.status = 'connecting'; this.onStatus = null; }
  url(){ return baseUrl().replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(CFG.supabaseKey || 'dev') + '&vsn=1.0.0'; }
  setStatus(s){ this.status = s; if(this.onStatus) try{ this.onStatus(s); }catch(e){} }
  connect(){
    if(this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      let ws; try{ ws = new WebSocket(this.url()); }catch(e){ reject(e); return; }
      this.ws = ws; const to = setTimeout(() => { try{ ws.close(); }catch(e){} reject(new Error('timeout')); }, 9000);
      ws.onopen = () => { clearTimeout(to); this.retry = 0; this.setStatus('open'); resolve();
        clearInterval(this.hb); this.hb = setInterval(() => this.raw({ topic:'phoenix', event:'heartbeat', payload:{}, ref:String(++this.ref) }), 25000);
        for(const [name, t] of this.topics) this.sendJoin(name, t); };
      ws.onmessage = e => { let m; try{ m = JSON.parse(e.data); }catch(err){ return; } this.onMessage(m); };
      ws.onerror = () => {};
      ws.onclose = () => { clearTimeout(to); clearInterval(this.hb); this.ready = null; reject(new Error('closed'));
        if(this.closed) return; this.setStatus('reconnecting');
        setTimeout(() => { if(!this.closed) this.connect().catch(() => {}); }, Math.min(8000, 800 * Math.pow(2, this.retry++))); };
    });
    return this.ready;
  }
  raw(m){ if(this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  sendJoin(name, t){
    const ref = String(++this.ref); t.joinRef = ref; t.joined = false;
    const payload = { config:{ broadcast:{ ack:false, self:false }, presence:{ key:'' }, postgres_changes:[], private:false } };
    if(jwtKey()) payload.access_token = jwtKey();
    this.raw({ topic:'realtime:' + name, event:'phx_join', payload, ref, join_ref:ref });
  }
  join(name, onBroadcast){
    return new Promise((resolve, reject) => {
      const t = { onBroadcast, joined:false, joinRef:null, resolve, reject };
      this.topics.set(name, t);
      const to = setTimeout(() => { if(!t.joined) reject(new Error('join timeout')); }, 9000);
      t.resolve = v => { clearTimeout(to); resolve(v); };
      this.connect().then(() => { if(!t.joinRef) this.sendJoin(name, t); }).catch(e => { clearTimeout(to); reject(e); });
    });
  }
  onMessage(m){
    const name = (m.topic || '').replace(/^realtime:/, ''), t = this.topics.get(name); if(!t) return;
    if(m.event === 'phx_reply' && m.ref === t.joinRef){
      if(m.payload && m.payload.status === 'ok'){ t.joined = true; t.resolve && t.resolve(); }
      else { this.setStatus('refused'); t.reject && t.reject(new Error('join refused: ' + JSON.stringify(m.payload && m.payload.response))); }
      return;
    }
    if(m.event === 'broadcast' && m.payload) try{ t.onBroadcast(m.payload.event, m.payload.payload); }catch(e){ console.error(e); }
  }
  send(name, event, payload){ const t = this.topics.get(name); if(!t || !t.joined) return false;
    this.raw({ topic:'realtime:' + name, event:'broadcast', payload:{ type:'broadcast', event, payload }, ref:String(++this.ref), join_ref:t.joinRef }); return true; }
  close(){ this.closed = true; clearInterval(this.hb); try{ this.ws && this.ws.close(); }catch(e){} }
}
let postBusy = false;
async function livePost(name, event, payload){
  if(postBusy) return false;                       // never queue up: a newer update replaces a slow one
  postBusy = true;
  const headers = { 'Content-Type':'application/json', apikey:CFG.supabaseKey || 'dev' };
  if(jwtKey()) headers.Authorization = 'Bearer ' + jwtKey();
  try{ const r = await fetch(baseUrl() + '/realtime/v1/api/broadcast', { method:'POST', headers,
         body:JSON.stringify({ messages:[{ topic:name, event, payload, private:false }] }) }); return r.ok; }
  catch(e){ return false; } finally{ postBusy = false; }
}
const live = {
  games:LIVE_GAMES,
  supported:id => LIVE_GAMES.includes(id),
  topics:code => ({ in:'mc-' + code + '-in', out:'mc-' + code + '-out' }),
  /* student side: onSnapshot(snapshot) gets { t, p:[players], g? } from the teacher's screen (g: the referee's shared game state) */
  async player(code, onSnapshot, onStatus){
    const T = live.topics(code), sock = new LiveSocket(); sock.onStatus = onStatus;
    try{ await sock.join(T.out, (ev, data) => { if(ev === 'snap') onSnapshot(data); }); }
    catch(e){ sock.close(); throw e; }
    return { send:state => livePost(T.in, 'state', state), close:() => sock.close(), get status(){ return sock.status; } };
  },
  referees,
  /* teacher side: relays everyone's latest state as one snapshot, 4 times a second.
     opts (optional): { game, now() (server clock), board() (the latest session board) }. For a game with a
     referee, its tick(latest, hostNow) adds a shared game state `g` (battle, roster, results) to each snapshot. */
  async host(code, onPlayers, opts){
    opts = opts || {};
    const T = live.topics(code), sock = new LiveSocket(), latest = new Map();
    let ref = null;
    if(opts.game && LIVE_REFEREES.includes(opts.game)){
      if(!referees[opts.game]) await loadScript(ROOT + 'adapters/' + opts.game + '-referee.js');
      if(referees[opts.game]) ref = referees[opts.game]({ code, now:opts.now || Date.now, board:opts.board || (() => null) });
    }
    try{
      await sock.join(T.in, (ev, data) => { if(ev === 'state' && data && data.n) latest.set(data.n, Object.assign({ at:Date.now() }, data)); });
      await sock.join(T.out, () => {});
    }catch(e){ sock.close(); throw e; }
    const timer = setInterval(() => {
      const now = Date.now(), p = [];
      for(const [n, s] of latest){ if(now - s.at > 15000) latest.delete(n); else { const c = Object.assign({}, s); delete c.at; p.push(c); } }
      let g = null;
      if(ref) try{ g = ref.tick(latest, now); }catch(e){ console.error(e); }
      if(p.length || g) sock.send(T.out, 'snap', g ? { t:now, p, g } : { t:now, p });
      if(onPlayers) try{ onPlayers(p); }catch(e){}
    }, (opts.game && LIVE_RATE[opts.game]) || 250);
    return { close(){ clearInterval(timer); sock.close(); }, get status(){ return sock.status; }, get count(){ return latest.size; },
             get info(){ try{ return ref && ref.info ? ref.info() : ''; }catch(e){ return ''; } },
             get teams(){ try{ return ref && ref.teams ? ref.teams() : null; }catch(e){ return null; } } };
  },
};

/* ---------------------------------------------------------------------
   One shared game for the whole class
   MC.seed(tag)       a repeatable random-number function for this class game: every student's iPad gets the
                      same numbers in the same order, so they build the same map / targets / customers / holes.
                      Outside a class game it is just Math.random.
   MC.withSeed(tag, fn) runs fn with Math.random swapped for MC.seed(tag) (for game code that calls Math.random).
   --------------------------------------------------------------------- */
function classCode(){ const c = new URLSearchParams(location.search).get('join'); return c ? String(c).toUpperCase().replace(/[^A-Z0-9]/g, '') : (SESSION && SESSION.code) || null; }
function hashStr(s){ let h = 1779033703 ^ s.length; for(let i = 0; i < s.length; i++){ h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return (h ^= h >>> 16) >>> 0; }
function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const MATH_RANDOM = Math.random;
function seed(tag){ const c = classCode(); return c ? mulberry(hashStr(c + '|' + (tag == null ? '' : tag))) : MATH_RANDOM; }
function withSeed(tag, fn){
  if(!classCode()) return fn();
  const was = Math.random; Math.random = seed(tag);
  try{ return fn(); } finally{ Math.random = was; }
}

/* ---------------------------------------------------------------------
   MC.classBoard(opts): a live class leaderboard in the corner of a score game
   opts = { score:() => number|null, lower:false (true when a lower score wins), fmt:v => text,
            label:'Class', pos:{ top:'70px', right:'12px' } (CSS), conn:false }
   It opens its own live link (unless opts.conn is true: then the adapter sends board.fields() in its own
   state and passes each snapshot to board.feed(snap)). Every student sends { n, s } once a second;
   the teacher's screen sends back everyone's latest score. Top 5 are shown, plus you if you're lower down.
   --------------------------------------------------------------------- */
function classBoard(opts){
  opts = Object.assign({ lower:false, fmt:v => String(Math.round(v)), label:'Class leaderboard', pos:{ top:'calc(70px + env(safe-area-inset-top,0px))', right:'12px' } }, opts || {});
  const code = classCode();
  const B = { feed, fields, el:null, rows:new Map(), conn:null, hidden:false, get list(){ return ranked(); } };
  if(!code || !(MC.live && MC.live.supported(GAME ? GAME.game : ''))) return B;
  injectCSS();
  const me = () => (SESSION && SESSION.username) || (USER && USER.username) || '';
  function myScore(){ try{ const v = opts.score(); return v == null || !isFinite(+v) ? null : +v; }catch(e){ return null; } }
  function fields(){ return { s:myScore() }; }
  function feed(snap){
    if(!snap || !Array.isArray(snap.p)) return;
    for(const p of snap.p) if(p && p.n) B.rows.set(p.n, { s:p.s == null ? null : +p.s, at:Date.now() });
    paint();
  }
  function ranked(){
    const now = Date.now(), list = [];
    B.rows.forEach((r, n) => { if(now - r.at < 20000 && r.s != null) list.push({ n, s:r.s }); });
    const mine = myScore(), m = me(); if(m){ const i = list.findIndex(x => x.n === m); if(i >= 0) list.splice(i, 1); if(mine != null) list.push({ n:m, s:mine }); }
    list.sort((a, b) => opts.lower ? a.s - b.s : b.s - a.s);
    return list;
  }
  function paint(){
    if(!B.el){
      B.el = document.createElement('div'); B.el.className = 'mc-cboard mc-ui'; B.el.setAttribute('role', 'status'); B.el.setAttribute('aria-label', 'Live class leaderboard');
      Object.assign(B.el.style, opts.pos);
      B.el.addEventListener('pointerdown', e => { e.stopPropagation(); B.hidden = !B.hidden; B.el.classList.toggle('mini', B.hidden); });
      ['touchstart', 'mousedown', 'click'].forEach(t => B.el.addEventListener(t, e => e.stopPropagation()));
      document.body.appendChild(B.el);
    }
    const list = ranked(), m = me(), at = list.findIndex(x => x.n === m), top = list.slice(0, 5);
    const row = (x, i) => `<li class="${x.n === m ? 'me' : ''}"><b>${i + 1}</b><span>${esc(x.n === m ? x.n + ' (you)' : x.n)}</span><em>${esc(opts.fmt(x.s))}</em></li>`;
    B.el.innerHTML = `<div class="h"><i></i>${esc(opts.label)}<small>${list.length}</small></div>`
      + (list.length ? `<ol>${top.map(row).join('')}${at >= 5 ? '<li class="gap">⋮</li>' + row(list[at], at) : ''}</ol>` : '<p>Waiting for scores…</p>');
  }
  if(!opts.conn){
    (async () => {
      paint();
      try{ B.conn = await MC.live.player(code, feed, () => {}); }catch(e){ console.warn('Live leaderboard unavailable', e); B.el && B.el.remove(); B.el = null; return; }
      let last = '', lastAt = 0;
      setInterval(() => {
        const n = me(); if(!n || !SESSION || !SESSION.started) return;
        const st = { n, s:myScore() }, k = JSON.stringify(st);
        if(k !== last || Date.now() - lastAt > 5000){ last = k; lastAt = Date.now(); B.conn.send(st); }
      }, 1000);
      setInterval(paint, 1000);
    })();
  }
  return B;
}

window.MC = {
  config:CFG, root:ROOT, configured, rpc, authed, token, get user(){ return USER; }, onUser, refreshMe, login, signup, logout,
  GAMES, TOPICS, gameById, fmtScore, nameHTML, iconSVG, coinSVG, esc,
  ui:{ toast, modal, loginModal, passwordModal, injectCSS, banner },
  register, result, inSession, leaveSession, live, teacherOnly, seed, withSeed, classBoard, classCode, get session(){ return SESSION; }, teamColour,
};
})();
