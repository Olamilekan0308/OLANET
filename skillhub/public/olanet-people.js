(() => {
  const API = (path, init = {}) => fetch(`/api${path}`, { ...init, credentials: 'include', headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) } }).then(async r => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error || 'Request failed'); return d; });
  const esc = s => String(s || '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const initials = p => (p.full_name || p.username || 'OL').split(/\s+/).map(x => x[0]).join('').slice(0,2).toUpperCase();
  const card = p => `<article class="olanet-person-card" data-id="${esc(p.id)}"><div class="olanet-person-main">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="" class="olanet-person-avatar">` : `<div class="olanet-person-avatar olenet-avatar-fallback">${esc(initials(p))}</div>`}<div class="olanet-person-copy"><h3>${esc(p.full_name || p.username || 'OLANET user')}</h3><p>@${esc(p.username || 'member')}</p>${p.bio ? `<span>${esc(p.bio)}</span>` : ''}</div></div><div class="olanet-person-actions"><button class="olanet-add-friend" data-user="${esc(p.id)}">Add Friend</button><button class="olanet-message-person" data-user="${esc(p.id)}">Message</button></div></article>`;
  const css = document.createElement('style');
  css.textContent = `
    #olanet-people-page{min-height:100vh;background:#f0f2f5;color:#1c1e21;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding-bottom:48px}
    .olanet-people-top{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid #dddfe2;padding:14px 20px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    .olanet-people-top-inner{max-width:1100px;margin:auto;display:flex;align-items:center;gap:14px}.olanet-people-logo{font-weight:900;font-size:22px;color:#2f817d}.olanet-people-back{border:0;background:#f0f2f5;border-radius:50%;width:40px;height:40px;font-size:22px;cursor:pointer}.olanet-people-search{flex:1;max-width:560px;background:#f0f2f5;border:0;border-radius:999px;padding:12px 18px;font-size:15px;outline:none}.olanet-people-wrap{max-width:1100px;margin:24px auto;padding:0 16px}.olanet-people-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:18px}.olanet-people-head h1{margin:0;font-size:28px}.olanet-people-head p{margin:5px 0 0;color:#65676b}.olanet-people-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.olanet-person-card{background:#fff;border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,.12);padding:16px}.olanet-person-main{display:flex;gap:12px;align-items:center}.olanet-person-avatar{width:72px;height:72px;border-radius:50%;object-fit:cover;flex:none}.olnet-avatar-fallback,.olnet-avatar-fallback{display:grid;place-items:center;background:#d8eaff;color:#1d4348;font-weight:900;font-size:20px}.olanet-person-copy{min-width:0}.olanet-person-copy h3{margin:0;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.olanet-person-copy p{margin:4px 0;color:#65676b;font-size:13px}.olanet-person-copy span{display:block;color:#65676b;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.olanet-person-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.olanet-person-actions button{border:0;border-radius:7px;padding:10px 8px;font-weight:700;cursor:pointer}.olanet-add-friend{background:#2f817d;color:#fff}.olanet-message-person{background:#e7f3ff;color:#216763}.olanet-add-friend[disabled],.olanet-message-person[disabled]{opacity:.6;cursor:default}.olanet-people-empty{background:#fff;border-radius:12px;padding:50px;text-align:center;color:#65676b}.olanet-people-status{margin-bottom:14px;color:#b42318;font-size:14px}.olanet-people-tabs{display:flex;gap:8px;margin-bottom:16px}.olanet-people-tabs button{border:0;background:#fff;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer}.olanet-people-tabs button.active{background:#2f817d;color:#fff}@media(max-width:800px){.olanet-people-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.olanet-people-grid{grid-template-columns:1fr}.olanet-people-head{display:block}.olanet-people-search{max-width:none}.olanet-people-top-inner{flex-wrap:wrap}}
  `;
  document.head.appendChild(css);

  async function renderPeoplePage() {
    if (location.pathname !== '/people' || document.getElementById('olanet-people-page')) return;
    document.body.innerHTML = `<div id="olanet-people-page"><header class="olanet-people-top"><div class="olanet-people-top-inner"><button class="olanet-people-back" id="olanet-people-back" aria-label="Back">‹</button><div class="olanet-people-logo">OLANET</div><input id="olanet-people-search" class="olanet-people-search" placeholder="Search people by name or username" autocomplete="off"></div></header><main class="olanet-people-wrap"><div class="olanet-people-head"><div><h1>People you may know</h1><p>Connect with students, professionals and builders on OLANET.</p></div></div><div class="olanet-people-tabs"><button class="active" data-mode="suggested">Suggested for you</button><button data-mode="all">All people</button></div><div id="olanet-people-status" class="olanet-people-status"></div><section id="olanet-people-grid" class="olanet-people-grid"><div class="olanet-people-empty">Loading people…</div></section></main></div>`;
    document.getElementById('olanet-people-back').onclick = () => history.back();
    const search = document.getElementById('olanet-people-search');
    const grid = document.getElementById('olanet-people-grid');
    const status = document.getElementById('olanet-people-status');
    let all = [];
    let mode = 'suggested';
    const load = async () => {
      try {
        status.textContent = '';
        const q = search.value.trim();
        const data = await API(`/people${q ? `?q=${encodeURIComponent(q)}` : ''}`);
        all = Array.isArray(data) ? data : [];
        grid.innerHTML = all.length ? all.map(card).join('') : `<div class="olanet-people-empty">No OLANET users found.</div>`;
        bind();
      } catch (e) { status.textContent = e.message || 'Could not load OLANET users.'; grid.innerHTML = `<div class="olanet-people-empty">People could not be loaded right now.</div>`; }
    };
    const bind = () => {
      document.querySelectorAll('.olanet-add-friend').forEach(btn => btn.onclick = async () => {
        btn.disabled = true; btn.textContent = 'Sending…';
        try { await API('/friends/request', { method:'POST', body:JSON.stringify({ addressee_id: btn.dataset.user }) }); btn.textContent = 'Request Sent'; } catch(e) { btn.disabled=false; btn.textContent='Add Friend'; status.textContent=e.message || 'Could not send friend request.'; }
      });
      document.querySelectorAll('.olanet-message-person').forEach(btn => btn.onclick = async () => {
        btn.disabled=true; btn.textContent='Opening…';
        try { const c=await API('/conversations',{method:'POST',body:JSON.stringify({user_ids:[btn.dataset.user]})}); location.href=`/messages?conversation=${encodeURIComponent(c.id)}`; } catch(e) { btn.disabled=false; btn.textContent='Message'; status.textContent=e.message || 'Could not open chat.'; }
      });
    };
    let timer;
    search.oninput = () => { clearTimeout(timer); timer=setTimeout(load,250); };
    document.querySelectorAll('.olanet-people-tabs button').forEach(b => b.onclick=()=>{document.querySelectorAll('.olanet-people-tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');mode=b.dataset.mode;load();});
    await load();
  }

  function addPeopleLink() {
    if (document.querySelector('[data-olanet-people-link]')) return;
    const links = [...document.querySelectorAll('a,button')];
    const host = links.find(x => /find people|people/i.test((x.textContent||'').trim()) && !/search/i.test((x.textContent||'')));
    if (host && host.tagName === 'A') { host.setAttribute('href','/people'); host.setAttribute('data-olanet-people-link','1'); }
    else if (host) { host.onclick=()=>location.href='/people'; host.setAttribute('data-olanet-people-link','1'); }
  }
  window.addEventListener('popstate', renderPeoplePage);
  const boot = () => { renderPeoplePage(); addPeopleLink(); };
  boot();
  new MutationObserver(() => { renderPeoplePage(); addPeopleLink(); }).observe(document.body,{childList:true,subtree:true});
})();