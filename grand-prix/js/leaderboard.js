/* =====================================================================
   LEADERBOARD: one end-of-round screen shared by every game.
   Solo games: a podium for the top three, then everyone else in a scrolling list.
   Team games: one column per team with its total, a crown on the winners, and every player's score.
   showLeaderboard({
     title, subtitle, note,
     entries:[{ name, display, sub, colour, img, initial, you, tag }],     // already sorted, best first
     teams:[{ name, colour, total, winner, entries:[...] }],               // use instead of entries for team games
     actions:[{ label, primary, onClick, href }]
   })
   ===================================================================== */
(function(){
  const css = `
.lb-ov{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(8,14,24,.72);font-family:'Nunito',ui-rounded,'Segoe UI',system-ui,sans-serif}
.lb{width:min(560px,100%);max-height:100%;display:flex;flex-direction:column;background:#1B2232;color:#fff;border-radius:26px;border:3px solid #22303A;box-shadow:0 14px 0 rgba(0,0,0,.35);overflow:hidden;animation:lbIn .35s cubic-bezier(.2,1.3,.5,1)}
.lb.teams{width:min(1100px,100%)}
@keyframes lbIn{from{transform:translateY(20px) scale(.96);opacity:0}}
.lb-head{padding:16px 20px 6px;text-align:center}
.lb-head h2{margin:0;font-family:'Lilita One','Trebuchet MS',system-ui,sans-serif;font-weight:400;font-size:clamp(1.6rem,4vw,2.2rem);letter-spacing:.02em}
.lb-head p{margin:4px 0 0;color:#9AA8BD;font-weight:800;font-size:.9rem}
.lb-body{flex:1;min-height:0;overflow:auto;padding:6px 16px 10px}
.lb-podium{display:grid;grid-template-columns:1fr 1.15fr 1fr;align-items:end;gap:10px;margin:86px 0 14px}
.lb-step{position:relative;background:#262F45;border-radius:20px 20px 14px 14px;text-align:center;padding:56px 8px 14px}
.lb-step.p1{padding-top:66px;padding-bottom:26px;background:#2C3650}
.lb-step .av{position:absolute;left:50%;top:0;transform:translate(-50%,-48%)}
.lb-step .nm{font-weight:900;font-size:1rem;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-step .val{font-family:'Lilita One',system-ui,sans-serif;font-size:1.7rem;line-height:1.1;margin-top:2px}
.lb-step.p1 .val{font-size:2.05rem;color:#FFC23D}.lb-step.p2 .val{color:#4DA3FF}.lb-step.p3 .val{color:#3CCB6E}
.lb-step .sub{color:#8E9BB0;font-size:.75rem;font-weight:800;margin-top:2px}
.lb-step.you{box-shadow:inset 0 0 0 3px #FFC23D}
.lb-av{position:relative;border-radius:50%;display:grid;place-items:center;font-weight:900;color:#fff;border:4px solid var(--ring,#fff);box-shadow:0 0 0 3px #22303A;background:var(--fill,#3A465C)}
.lb-av img{width:78%;height:78%;object-fit:contain;filter:drop-shadow(1.5px 0 0 #22303A) drop-shadow(-1.5px 0 0 #22303A) drop-shadow(0 1.5px 0 #22303A) drop-shadow(0 -1.5px 0 #22303A)}
.lb-av .rk{position:absolute;left:50%;bottom:-11px;transform:translateX(-50%);width:24px;height:24px;border-radius:50%;background:var(--ring);color:#1B2232;font-size:.78rem;font-weight:900;display:grid;place-items:center;border:2px solid #22303A}
.lb-crown{position:absolute;left:50%;top:-34px;transform:translateX(-50%);width:44px;height:32px}
.lb-list{background:#212A3D;border-radius:20px;padding:4px 6px}
.lb-row{display:flex;align-items:center;gap:12px;padding:9px 8px;border-bottom:1px solid #2E3850}
.lb-row:last-child{border-bottom:0}
.lb-row .pos{width:26px;text-align:center;font-weight:900;color:#8E9BB0}
.lb-row .who{flex:1;min-width:0}
.lb-row .who b{display:block;font-size:.98rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lb-row .who small{color:#8E9BB0;font-weight:800;font-size:.74rem}
.lb-row .v{font-weight:900;font-size:1.05rem}
.lb-row.you{background:rgba(255,194,61,.12);border-radius:12px;box-shadow:inset 0 0 0 2px #FFC23D}
.lb-row .tag,.lb-step .tag{display:inline-block;font-size:.68rem;font-weight:900;background:#FFC23D;color:#1B2232;border-radius:999px;padding:1px 7px;margin-left:6px;vertical-align:2px}
.lb-teams{display:grid;gap:14px;margin-top:30px}
.lb-team{position:relative;background:#212A3D;border-radius:20px;border:3px solid var(--tc);display:flex;flex-direction:column;min-height:0}
.lb-team.win{box-shadow:0 0 0 3px #FFC23D,0 0 26px rgba(255,194,61,.35)}
.lb-team .th{text-align:center;padding:16px 10px 10px;border-bottom:1px solid #2E3850}
.lb-team .th .tn{font-family:'Lilita One',system-ui,sans-serif;font-size:1.3rem;color:var(--tc)}
.lb-team .th .tt{font-family:'Lilita One',system-ui,sans-serif;font-size:2.2rem;line-height:1}
.lb-team .th small{color:#8E9BB0;font-weight:800}
.lb-team .lb-crown{top:-30px}
.lb-team .rows{max-height:min(46vh,420px);overflow:auto;padding:4px 6px}
.lb-note{margin:10px 4px 0;color:#7F8CA2;font-size:.75rem;font-weight:800;text-align:center}
.lb-foot{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:12px 16px 16px;border-top:1px solid #2A3348}
.lb-foot button,.lb-foot a{font:inherit;font-weight:900;font-size:.95rem;border:0;cursor:pointer;text-decoration:none;border-radius:14px;padding:10px 18px 13px;background:#33405A;color:#fff;box-shadow:inset 0 -4px 0 #232C40}
.lb-foot .primary{background:#2E9E5B;box-shadow:inset 0 -4px 0 #1F7542}
.lb-foot :focus-visible{outline:3px solid #FFE07A;outline-offset:2px}
@media (max-width:520px){.lb-podium{gap:6px}.lb-step .val{font-size:1.3rem}.lb-step.p1 .val{font-size:1.6rem}}
@media (prefers-reduced-motion:reduce){.lb{animation:none}}`;
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CROWN=`<svg class="lb-crown" viewBox="0 0 44 32" aria-hidden="true"><path d="M4 26 L2 7 L13 15 L22 3 L31 15 L42 7 L40 26 Z" fill="#FFC23D" stroke="#22303A" stroke-width="3" stroke-linejoin="round"/><rect x="4" y="25" width="36" height="5" rx="2" fill="#F0A81C" stroke="#22303A" stroke-width="3"/><circle cx="22" cy="17" r="3" fill="#E4352D" stroke="#22303A" stroke-width="2"/></svg>`;
  const RING=['#FFC23D','#4DA3FF','#3CCB6E'];
  function avatar(e,size,rank){
    const ring = rank ? RING[rank-1] : (e.colour||'#5A6680');
    const inner = e.img ? `<img src="${e.img}" alt="">` : `<span style="font-size:${Math.round(size*0.4)}px">${esc(e.initial||(e.name||'?').trim().charAt(0).toUpperCase())}</span>`;
    return `<div class="lb-av av" style="width:${size}px;height:${size}px;--ring:${ring};--fill:${e.colour||'#3A465C'}">${inner}${rank?`<span class="rk">${rank}</span>`:''}</div>`;
  }
  const row=(e,i)=>`<div class="lb-row ${e.you?'you':''}"><span class="pos">${i+1}</span>${avatar(e,44)}<div class="who"><b>${esc(e.name)}${e.tag?`<span class="tag">${esc(e.tag)}</span>`:''}</b><small>${esc(e.sub||'')}</small></div><span class="v">${esc(e.display)}</span></div>`;
  function podium(top){
    // order on screen: 2nd, 1st (raised, with the crown above its avatar), 3rd
    const step=(e,r)=> e ? `<div class="lb-step p${r} ${e.you?'you':''}">${r===1?CROWN.replace('class="lb-crown"','class="lb-crown" style="top:-80px"'):''}${avatar(e,r===1?86:70,r)}<div class="nm">${esc(e.name)}${e.tag?`<span class="tag">${esc(e.tag)}</span>`:''}</div><div class="val">${esc(e.display)}</div><div class="sub">${esc(e.sub||'')}</div></div>` : '<div></div>';
    return `<div class="lb-podium">${step(top[1],2)}${step(top[0],1)}${step(top[2],3)}</div>`;
  }
  window.showLeaderboard=function(cfg){
    document.querySelectorAll('.lb-ov').forEach(n=>n.remove());
    const ov=document.createElement('div'); ov.className='lb-ov'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label',cfg.title||'Leaderboard');
    let body='';
    if(cfg.teams){
      const n=cfg.teams.length;
      body=`<div class="lb-teams" style="grid-template-columns:repeat(${n},minmax(0,1fr))">${cfg.teams.map(t=>`<div class="lb-team ${t.winner?'win':''}" style="--tc:${t.colour}">${t.winner?CROWN:''}
        <div class="th"><div class="tn">${esc(t.name)}</div><div class="tt">${esc(t.total)}</div><small>${esc(t.totalLabel||'')}</small></div>
        <div class="rows">${t.entries.map(row).join('')||'<div class="lb-row"><div class="who"><small>No players</small></div></div>'}</div></div>`).join('')}</div>`;
    } else {
      const e=cfg.entries||[];
      body=podium(e.slice(0,3)) + (e.length>3?`<div class="lb-list">${e.slice(3).map((x,i)=>row(x,i+3)).join('')}</div>`:'');
    }
    ov.innerHTML=`<div class="lb ${cfg.teams?'teams':''}"><div class="lb-head"><h2>${esc(cfg.title||'Leaderboard')}</h2>${cfg.subtitle?`<p>${esc(cfg.subtitle)}</p>`:''}</div>
      <div class="lb-body">${body}${cfg.note?`<div class="lb-note">${esc(cfg.note)}</div>`:''}</div>
      <div class="lb-foot">${(cfg.actions||[]).map((a,i)=>a.href?`<a href="${a.href}"  ${a.primary?'class="primary"':''}>${esc(a.label)}</a>`:`<button data-i="${i}" ${a.primary?'class="primary"':''}>${esc(a.label)}</button>`).join('')}</div></div>`;
    ov.addEventListener('click',e=>{ const b=e.target.closest('.lb-foot button'); if(!b) return; const a=cfg.actions[+b.dataset.i]; if(a.close!==false) ov.remove(); a.onClick&&a.onClick(); });
    document.body.appendChild(ov);
    setTimeout(()=>(ov.querySelector('.lb-foot .primary')||ov.querySelector('.lb-foot button'))?.focus({preventScroll:true}),60);
    return ov;
  };
  /* sample classmates for games that have no live opponents yet */
  const NAMES=['Ava','Leo','Mia','Noah','Zara','Eli','Ivy','Kai','Ruby','Finn','Isla','Omar','Grace','Theo','Lily','Arlo','Maya','Jack','Chloe','Ezra','Willow','Hugo','Nina','Felix','Sofia','Max','Aria','Sam','Poppy','Ben','Layla','Oscar','Emily','Tom','Hana'];
  const COLS=['#E4352D','#2F7BE4','#3CB563','#F0A81C','#9A4FE0','#E86FA6','#1BAFB0','#8A5A2B'];
  window.sampleClass=function(n, make){ const used=new Set(), out=[]; for(let i=0;i<n;i++){ let nm; do{ nm=NAMES[Math.floor(Math.random()*NAMES.length)]; }while(used.has(nm)&&used.size<NAMES.length); used.add(nm); out.push({ name:nm, colour:COLS[i%COLS.length], ...make(i) }); } return out; };
})();

