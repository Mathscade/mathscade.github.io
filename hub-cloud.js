/* Games hub: account bar, leaderboard and "host with my class" links on each game card */
(function(){
  MC.teacherOnly();   // the full games list is for teachers; students join with a code
  const HUB_TO_GAME = { 'slice-rush':'slice-rush', 'tank-ctf':'ctf', 'trophy-arena':'royale', 'maths-fishing':'fishing', 'maths-dash':'speed-run',
    'lava-climb':'lava', 'treasure-isles':'treasure', 'sharpshooter':'sharpshooter', 'speed-golf':'speed-golf',
    'race-vegas':'grand-prix', 'zombie-lab':'zombie', 'hide-seek':'hideseek', 'fruit-farm':'farm', 'total-outbreak':'outbreak', 'dig-deep':'mining' };   // must match HUB_TO_GAME in tools/build_site.py (race-monza and race-spa retired 17 October 2026)
  const css = document.createElement('style');
  css.textContent = `
  .hubnav{max-width:1100px;padding-top:6px!important;margin-bottom:16px;justify-content:center}
  .hubmore{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;flex-shrink:0}
  .hubmore a{display:inline-flex;align-items:center;gap:6px;font-weight:900;font-size:.95rem;text-decoration:none;color:var(--ink);background:var(--card);border-radius:12px;padding:8px 12px;box-shadow:0 3px 0 rgba(0,0,0,.18)}
  .hubmore a svg{width:18px;height:18px}
  .hubmore a.host{background:var(--ink);color:var(--sun)}`;
  document.head.appendChild(css);
  /* Menu at the top of the orange game panel (which runs the full height again), styled like the teacher dashboard bar:
     icon tiles for Leaderboards, Shop, Locker, then the name chip. "All games" is this page and "Teacher dashboard" is in the
     name chip's menu, so neither has its own button here. The logo and 1-2-3 steps stay centred over the games. */
  css.textContent += `
  .navslot{display:flex;justify-content:center;flex:none;width:100%}
  .hubnav.mcnav{margin:0;padding:8px 12px!important;gap:10px;flex-wrap:nowrap;max-width:none;background:var(--bg-2);border-radius:18px;box-shadow:0 5px 0 rgba(0,0,0,.25)}
  .hubnav .sp{display:none}
  body > .navslot{position:absolute;top:0;left:0;right:0;justify-content:flex-end;padding:12px clamp(16px,3vw,40px) 0;width:auto}
  @media (max-width:820px),(orientation:portrait) and (max-width:1100px){ .games{padding-top:68px} }`;
  const nav = document.createElement('nav'); nav.className = 'hubnav';
  const slot = document.createElement('div'); slot.className = 'navslot'; slot.append(nav);
  /* two columns: the bar is the first thing inside the orange panel and scrolls with it (never covers the text);
     one column (portrait iPad, phone): the panel is below the games, so the bar sits top-right of the page instead */
  const detailEl = document.getElementById('detail'), oneCol = matchMedia('(max-width:820px),(orientation:portrait) and (max-width:1100px)');
  const place = () => { if(oneCol.matches){ if(slot.parentNode !== document.body) document.body.append(slot); }
                        else if(detailEl.firstChild !== slot) detailEl.prepend(slot); };
  new MutationObserver(place).observe(detailEl, { childList:true });   // renderDetail() replaces the panel's contents
  oneCol.addEventListener ? oneCol.addEventListener('change', place) : oneCol.addListener(place);
  place();
  MCNav.mount(nav, { logo:false, current:'games', bar:false });
  nav.querySelectorAll('.lk.teach').forEach(a => a.remove());
  window.hubExtra = function(g){
    const id = HUB_TO_GAME[g.id]; if(!id || !MC.configured()) return '';
    const track = g.id.startsWith('race-') ? g.id.slice(5) : null;
    const teacher = MC.user && MC.user.role === 'teacher';
    return `<div class="hubmore"><a href="leaderboards.html?game=${id}">${MCNav.ICONS.trophy}Leaderboard</a>${teacher ? `<a class="host" href="teacher.html?game=${id}${track ? '&track=' + track : ''}">${MCNav.ICONS.board}Host with my class</a>` : ''}</div>`;
  };
  let last = null;
  MC.onUser(u => { const k = u ? u.role : ''; if(k !== last){ last = k; try{ renderDetail(); }catch(e){} } });
})();
