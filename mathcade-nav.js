/* Top bar shared by the hub and the Mathcade website pages: join a game, leaderboards, shop, account. */
(function(){
'use strict';
const MC = window.MC, esc = MC.esc;
const css = `
.mcnav{line-height:1.36;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 0 6px;font-family:'Baloo 2','Nunito',ui-rounded,'Segoe UI',system-ui,sans-serif}
.mcnav .logo{font-family:'Bungee',Impact,sans-serif;font-size:1.35rem;color:#FFE36B;text-decoration:none;letter-spacing:.05em;text-shadow:0 3px 0 #B4261C;margin-right:6px}
.mcnav form{display:flex;align-items:center;gap:0;background:#FFE36B;border-radius:14px;box-shadow:0 4px 0 #D9A21F;padding:4px;flex:0 1 auto}
.mcnav form label{font-weight:900;font-size:.85rem;color:#4A2606;padding:0 8px 0 8px;white-space:nowrap}
.mcnav form input{width:7.2em;font:inherit;font-family:'Chakra Petch',Impact,sans-serif;font-size:1.05rem;letter-spacing:.12em;text-transform:uppercase;padding:6px 8px;border-radius:10px;border:2px solid #D9A21F;background:#fff;color:#1E2433;font-weight:700}
.mcnav form input::placeholder{letter-spacing:.04em;color:#B9A27A;font-family:'Baloo 2','Nunito',ui-rounded,'Segoe UI',system-ui,sans-serif;font-weight:800;text-transform:none;font-size:.95rem}
.mcnav form button{margin-left:4px;font:inherit;font-weight:900;border:0;border-radius:10px;padding:8px 12px;background:#1E2433;color:#FFE36B;cursor:pointer}
.mcnav .sp{flex:1}
.mcnav a.lk,.mcnav button.lk{display:inline-flex;align-items:center;gap:6px;font:inherit;font-weight:900;font-size:.92rem;color:#F6F1E7;text-decoration:none;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.14);border-radius:12px;padding:6px 10px;cursor:pointer}
.mcnav a.lk:hover,.mcnav button.lk:hover{background:rgba(255,255,255,.16)}
.mcnav a.lk[aria-current="page"]{border-color:#FFE36B;color:#FFE36B}
.mcnav .lk svg{width:18px;height:18px;flex:none}
.mcnav .me{display:inline-flex;align-items:center;gap:8px;background:#FFF8EE;color:#1E2433;border:0;border-radius:12px;padding:6px 10px;font:inherit;font-weight:900;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.2);max-width:260px}
.mcnav .me .coins{display:inline-flex;align-items:center;gap:3px;background:#F6E7D3;border-radius:8px;padding:2px 7px}
.mcnav .login{background:#2EC4B6;color:#0E2A33;border:0;border-radius:12px;padding:8px 14px;font:inherit;font-weight:900;cursor:pointer;box-shadow:inset 0 -4px 0 #1A8C82}
.mcmenu{position:absolute;z-index:50;background:#FFF8EE;border-radius:14px;box-shadow:0 8px 0 rgba(0,0,0,.2);padding:6px;min-width:190px;font-family:'Baloo 2','Nunito',ui-rounded,'Segoe UI',system-ui,sans-serif}
.mcmenu a,.mcmenu button{display:block;width:100%;text-align:left;font:inherit;font-weight:900;color:#1E2433;text-decoration:none;background:none;border:0;border-radius:10px;padding:9px 12px;cursor:pointer}
.mcmenu a:hover,.mcmenu button:hover{background:#F6E7D3}
/* one navy bar like the teacher dashboard: icon-only tiles (name on hover / for screen readers), then the name chip */
.mcnav [hidden]{display:none!important}
.mcnav.bar{background:#1D3352;border-radius:18px;padding:8px 14px;margin-top:12px;gap:10px;flex-wrap:nowrap;box-shadow:0 5px 0 rgba(0,0,0,.25)}
.mcnav .lk span{display:none}
.mcnav a.lk,.mcnav button.lk{width:44px;height:44px;justify-content:center;padding:0}
.mcnav .lk svg{width:22px;height:22px}
.mcnav .who{flex:none;padding-left:12px;border-left:2px solid rgba(255,255,255,.15)}
.mcnav .who:empty{display:none}
.mcnav .homebtn{display:inline-flex;align-items:center;gap:6px;flex:none;font-weight:900;font-size:1rem;color:#1E2433;text-decoration:none;background:#FFE36B;border-radius:12px;padding:0 14px;height:44px;box-shadow:0 3px 0 #D9A21F}
.mcnav .homebtn svg{width:20px;height:20px}
.mcnav .homebtn:hover{background:#FFEC94}
@media (max-width:520px){.mcnav .homebtn span{display:none}.mcnav .homebtn{padding:0 12px}.mcnav .homebtn + .logo{display:none}}
@media (max-width:520px){.mcnav.bar{flex-wrap:wrap}.mcnav.bar .who{border-left:0;padding-left:0;margin-left:auto}}

@media (max-width:640px){.mcnav .lk span{display:none}.mcnav form{flex:1 1 100%;order:5}.mcnav form input{flex:1;width:auto}}
`;
const ICONS = {
  trophy:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v4a5 5 0 0 1-10 0z" fill="#FFD23F" stroke="currentColor" stroke-width="2"/><path d="M7 5H3.5a3.5 3.5 0 0 0 4 4M17 5h3.5a3.5 3.5 0 0 1-4 4M12 12v4M8 21h8l-1-5H9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  bag:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 13H6z" fill="#FF9F2E" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 10V6a3 3 0 0 1 6 0v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  board:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2" fill="#2EC4B6" stroke="currentColor" stroke-width="2"/><path d="M12 17v4M8 21h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  locker:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2.5" fill="#2EC4B6" stroke="currentColor" stroke-width="2"/><path d="M8.5 6h7M8.5 8.5h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><rect x="14" y="13.5" width="2.2" height="4.5" rx="1" fill="#FFD23F"/></svg>',
  games:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="7" width="19" height="11" rx="5" fill="#8A4FD8" stroke="currentColor" stroke-width="2"/><path d="M7.5 10.5v4M5.5 12.5h4" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="11.5" r="1.3" fill="#fff"/><circle cx="18" cy="14" r="1.3" fill="#fff"/></svg>',
};
function mount(el, opts){
  opts = opts || {};
  MC.ui.injectCSS();
  if(!document.getElementById('mcnav-css')){ const s = document.createElement('style'); s.id = 'mcnav-css'; s.textContent = css; document.head.appendChild(s); }
  const R = MC.root, here = opts.current || '';
  el.classList.add('mcnav');
  el.innerHTML = `
    ${opts.home ? `<a class="homebtn" href="${R}index.html"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H6M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Home</span></a>` : ''}
    ${opts.logo === false ? '' : `<a class="logo" href="${R}index.html">MATHCADE</a>`}
    ${opts.title ? `<h1 class="navtitle">${esc(opts.title)}</h1>` : !opts.join ? '' : `<form class="join" autocomplete="off"><label for="mcJoinCode">Join a game</label><input id="mcJoinCode" name="code" maxlength="6" placeholder="Code" aria-label="Game code" inputmode="text" autocapitalize="characters" spellcheck="false"><button type="submit">Join</button></form>`}
    <span class="sp"></span>
    <a class="lk teach" href="${R}games.html" ${here==='games'?'aria-current="page"':''} hidden>${ICONS.games}<span>All games</span></a>
    <a class="lk" href="${R}leaderboards.html" ${here==='leaderboards'?'aria-current="page"':''}>${ICONS.trophy}<span>Leaderboards</span></a>
    <a class="lk" href="${R}shop.html" ${here==='shop'?'aria-current="page"':''}>${ICONS.bag}<span>Shop</span></a>
    <a class="lk" href="${R}locker.html" ${here==='locker'?'aria-current="page"':''}>${ICONS.locker}<span>Locker</span></a>
    ${here==='teacher' ? '' : `<a class="lk teach" href="${R}teacher.html" hidden>${ICONS.board}<span>Teacher</span></a>`}
    <span class="who"></span>`;
  if(opts.bar !== false) el.classList.add('bar');
  el.querySelectorAll('.lk').forEach(a => { const t = a.textContent.trim(); a.title = t; a.setAttribute('aria-label', t); });
  const form = el.querySelector('form.join') || document.createElement('form'), input = form.code || document.createElement('input');
  input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const code = input.value.trim();
    if(code.length < 6){ MC.ui.toast('Game codes have 6 letters and numbers.'); input.focus(); return; }
    if(!MC.token()){ const u = await MC.ui.loginModal({ reason:'Log in to join game ' + code + '.' }); if(!u) return; }
    const btn = form.querySelector('button'); btn.disabled = true; btn.textContent = '…';
    try{
      const j = await MC.authed('mc_session_join', { p_code:code });
      const g = MC.gameById(j.game);
      location.href = R + g.file + '?join=' + encodeURIComponent(j.code);
    }catch(ex){ MC.ui.toast(esc(ex.message), { ms:6000 }); btn.disabled = false; btn.textContent = 'Join'; }
  });
  const who = el.querySelector('.who'), teachEls = el.querySelectorAll('.teach');
  MC.onUser(u => {
    teachEls.forEach(t => t.hidden = !(u && u.role === 'teacher'));
    // homeOnly (leaderboards, 22 Oct 2026): a student's only way out of this page is the Home button
    if(opts.homeOnly){ const st = !(u && u.role === 'teacher'); el.querySelectorAll('.lk:not(.teach)').forEach(t => t.hidden = st); who.style.display = st ? 'none' : ''; }
    if(!MC.configured()){ who.innerHTML = ''; form.style.display = 'none'; return; }
    if(!u){ who.innerHTML = `<button class="login" type="button">Log in</button>`; who.firstChild.onclick = () => MC.ui.loginModal(); return; }
    who.innerHTML = `<button class="me" type="button" aria-haspopup="menu">${MC.nameHTML(u.username, u.look, { title:false })}<span class="coins">${MC.coinSVG(16)}${(u.coins||0).toLocaleString()}</span></button>`;
    who.firstChild.onclick = ev => menu(ev.currentTarget, u);
  });
  if(MC.token()) MC.refreshMe();
}
function menu(btn, u){
  // tap to open, tap the same button again to close
  const open = document.querySelector('.mcmenu');
  if(open){ const mine = open._btn === btn; open._close(); if(mine) return; }
  const r = btn.getBoundingClientRect(), m = document.createElement('div');
  m.className = 'mcmenu'; m.setAttribute('role', 'menu');
  m.innerHTML = `<a role="menuitem" href="${MC.root}account.html">My scores and account</a><a role="menuitem" href="${MC.root}shop.html">Shop</a><a role="menuitem" href="${MC.root}locker.html">Locker</a>
    ${u.role === 'teacher' ? `<a role="menuitem" href="${MC.root}teacher.html">Teacher dashboard</a>` : ''}
    <button role="menuitem" data-a="pw">Change password</button><button role="menuitem" data-a="out">Log out</button>`;
  document.body.appendChild(m);
  const close = () => { m.remove(); btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', off); document.removeEventListener('keydown', esc); };
  const off = e => { if(!m.contains(e.target) && !btn.contains(e.target)) close(); };
  const esc = e => { if(e.key === 'Escape'){ close(); btn.focus(); } };
  m._btn = btn; m._close = close; btn.setAttribute('aria-expanded', 'true');
  m.style.top = (r.bottom + scrollY + 6) + 'px';
  m.style.left = Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + 'px';
  m.querySelector('[data-a=out]').onclick = async () => { close(); await MC.logout(); MC.ui.toast('Logged out.'); };
  m.querySelector('[data-a=pw]').onclick = () => { close(); MC.ui.passwordModal(); };
  setTimeout(() => { document.addEventListener('click', off); document.addEventListener('keydown', esc); }, 0);
}
window.MCNav = { mount, ICONS };
})();
