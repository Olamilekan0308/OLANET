(() => {
  let root = null;
  let sessionToken = '';
  let currentUserId = null;
  let conversation = null;
  let timer = null;
  let busy = false;
  let booting = false;

  const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const api = async (path, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
    const r = await fetch(`/api${path}`, { credentials: 'include', cache: 'no-store', ...options, headers });
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error(data?.error || data?.details || `Request failed (${r.status})`);
    return data;
  };

  const loadSession = async () => {
    const d = await fetch('/api/auth/session-token', { credentials: 'include', cache: 'no-store' }).then(async r => {
      const x = await r.json().catch(() => null);
      if (!r.ok) throw new Error(x?.error || `Session failed (${r.status})`);
      return x;
    });
    sessionToken = d?.access_token || '';
    currentUserId = d?.user?.id || null;
    window.__olanetUserId = currentUserId;
    if (!sessionToken || !currentUserId) throw new Error('Your OLANET session could not be restored.');
  };

  const destroy = () => {
    clearInterval(timer);
    timer = null;
    conversation = null;
    busy = false;
    if (root) root.remove();
    root = null;
  };

  const openChatFromQuery = async (list) => {
    const id = new URLSearchParams(location.search).get('user');
    if (!id) return;
    const person = list.find(p => String(p.id) === String(id));
    if (person) await openChat(person);
  };

  const boot = async () => {
    if (location.pathname !== '/messages' || root || booting) return;
    booting = true;
    root = document.createElement('div');
    root.id = 'olanet-real-messages';
    root.innerHTML = `<style>#olanet-real-messages{position:fixed;inset:0;z-index:100000;background:#eef2f5;font-family:Inter,system-ui,-apple-system,sans-serif;color:#1c1e21}#olanet-real-messages *{box-sizing:border-box}.om-shell{height:100%;max-width:1180px;margin:auto;background:#fff;display:flex;flex-direction:column;box-shadow:0 2px 18px rgba(0,0,0,.12)}.om-head{height:64px;flex:none;border-bottom:1px solid #dddfe2;display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#fff}.om-title{font-weight:800;font-size:18px}.om-sub{font-size:11px;color:#65676b;margin-top:2px}.om-actions{display:flex;gap:8px}.om-btn{border:0;background:#e4e6eb;color:#050505;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer}.om-btn:hover{background:#d8dadf}.om-body{display:flex;min-height:0;flex:1}.om-list{width:360px;flex:none;border-right:1px solid #dddfe2;display:flex;flex-direction:column}.om-search{padding:12px;border-bottom:1px solid #eee;display:flex;gap:8px}.om-search input{min-width:0;flex:1;border:0;outline:0;background:#f0f2f5;border-radius:20px;padding:11px 14px;font-size:13px}.om-search button{border:0;background:#1877f2;color:#fff;border-radius:8px;padding:0 14px;font-weight:700;cursor:pointer}.om-people{overflow:auto;padding:10px}.om-person{border-bottom:1px solid #eee;padding:12px 4px}.om-row{display:flex;align-items:center;gap:10px}.om-avatar{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#e4e6eb;color:#1877f2;font-weight:800;overflow:hidden;flex:none}.om-avatar img{width:100%;height:100%;object-fit:cover}.om-name{font-size:13px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.om-user{font-size:11px;color:#65676b;margin-top:2px}.om-actions2{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.om-actions2 button{border:0;border-radius:7px;padding:8px;font-size:11px;font-weight:750;cursor:pointer}.om-add{background:#1877f2;color:#fff}.om-msg{background:#e4e6eb;color:#050505}.om-actions2 button:disabled{opacity:.55;cursor:not-allowed}.om-empty{padding:35px 20px;text-align:center;color:#65676b;font-size:13px}.om-chat{min-width:0;flex:1;display:flex;flex-direction:column;background:#f0f2f5}.om-chathead{flex:none;background:#fff;border-bottom:1px solid #dddfe2;padding:11px 16px;display:flex;align-items:center;gap:10px}.om-messages{min-height:0;flex:1;overflow:auto;padding:18px}.om-bubble{max-width:75%;padding:9px 13px;border-radius:18px;margin-bottom:7px;font-size:13px;line-height:1.45;box-shadow:0 1px 2px rgba(0,0,0,.06);overflow-wrap:anywhere}.om-me{margin-left:auto;background:#1877f2;color:#fff;border-bottom-right-radius:5px}.om-them{background:#fff;color:#050505;border-bottom-left-radius:5px}.om-compose{flex:none;background:#fff;border-top:1px solid #dddfe2;padding:10px;display:flex;gap:8px}.om-compose input{min-width:0;flex:1;border:0;outline:0;background:#f0f2f5;border-radius:20px;padding:12px 15px;font-size:13px}.om-compose button{width:46px;border:0;border-radius:50%;background:#1877f2;color:#fff;font-weight:900;cursor:pointer}.om-compose button:disabled{opacity:.5;cursor:not-allowed}.om-back{display:none}@media(max-width:700px){.om-list{width:100%;border-right:0}.om-chat{display:none}.om-shell.chat-open .om-list{display:none}.om-shell.chat-open .om-chat{display:flex}.om-back{display:inline-grid}.om-head{height:60px}.om-messages{padding:14px}}</style><div class="om-shell"><header class="om-head"><div><div class="om-title">OLANET Messages</div><div class="om-sub">Private conversations</div></div><div class="om-actions"><button class="om-btn" data-close>Back to OLANET</button></div></header><div class="om-body"><aside class="om-list"><div class="om-search"><input data-search placeholder="Search people on OLANET"><button data-search-btn>Search</button></div><div class="om-people" data-people><div class="om-empty">Loading OLANET people…</div></div></aside><main class="om-chat"><div class="om-chathead"><button class="om-btn om-back" data-back>People</button><div class="om-avatar" data-chat-avatar>OL</div><div><div class="om-name" data-chat-name>Select a person</div><div class="om-sub">Private conversation</div></div></div><div class="om-messages" data-messages><div class="om-empty">Choose a person to start chatting.</div></div><div class="om-compose"><input data-compose placeholder="Write a message…" disabled><button data-send disabled aria-label="Send message">➤</button></div></main></div></div>`;
    document.body.appendChild(root);
    const shell = root.querySelector('.om-shell');
    const peopleBox = root.querySelector('[data-people]');
    const search = root.querySelector('[data-search]');
    const searchBtn = root.querySelector('[data-search-btn]');
    const msgBox = root.querySelector('[data-messages]');
    const compose = root.querySelector('[data-compose]');
    const sendBtn = root.querySelector('[data-send]');

    const initials = p => (p.full_name || p.username || 'OL').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
    const loadPeople = async () => {
      peopleBox.innerHTML = '<div class="om-empty">Searching…</div>';
      try {
        const q = search.value.trim();
        const data = await api(`/people${q ? `?q=${encodeURIComponent(q)}` : ''}`);
        const list = Array.isArray(data) ? data : [];
        if (!list.length) { peopleBox.innerHTML = `<div class="om-empty">${q ? 'No matching OLANET users.' : 'No other OLANET users found.'}</div>`; return list; }
        peopleBox.innerHTML = list.map(p => `<div class="om-person" data-id="${esc(p.id)}"><div class="om-row"><div class="om-avatar">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="">` : esc(initials(p))}</div><div style="min-width:0"><div class="om-name">${esc(p.full_name || p.username || 'OLANET user')}</div><div class="om-user">@${esc(p.username || 'member')}</div></div></div><div class="om-actions2"><button class="om-add" data-add>Add friend</button><button class="om-msg" data-message>Message</button></div></div>`).join('');
        [...peopleBox.querySelectorAll('.om-person')].forEach(card => wirePerson(card, list.find(p => String(p.id) === String(card.dataset.id))));
        return list;
      } catch (e) { peopleBox.innerHTML = `<div class="om-empty">${esc(e.message || 'Could not load people.')}</div>`; return []; }
    };

    const wirePerson = async (card, p) => {
      if (!p) return;
      const add = card.querySelector('[data-add]');
      const message = card.querySelector('[data-message]');
      try {
        const s = await api(`/friends/status/${encodeURIComponent(p.id)}`);
        if (s.status === 'accepted') { add.textContent = 'Friends'; add.disabled = true; }
        else if (s.status === 'pending' && s.incoming) { add.textContent = 'Accept'; add.onclick = async () => { try { const r = await api(`/friends/${encodeURIComponent(s.requestId)}`, { method:'PATCH', body:JSON.stringify({status:'accepted'}) }); if (r) { add.textContent='Friends'; add.disabled=true; } } catch(e){ alert(e.message); } }; }
        else if (s.status === 'pending') { add.textContent = 'Requested'; add.disabled = true; }
      } catch {}
      add.onclick = add.onclick || (async () => { if (busy) return; busy=true; try { const s=await api('/friends/request',{method:'POST',body:JSON.stringify({addressee_id:p.id})}); add.textContent=s.status==='pending'?'Requested':'Friends'; add.disabled=true; } catch(e){alert(e.message)} finally{busy=false} });
      message.onclick = () => openChat(p);
    };

    const loadMessages = async () => {
      if (!conversation) return;
      try {
        const data = await api(`/conversations/${encodeURIComponent(conversation)}/messages`);
        const list = Array.isArray(data) ? data : [];
        msgBox.innerHTML = list.length ? list.map(m => `<div class="om-bubble ${m.sender_id === currentUserId ? 'om-me' : 'om-them'}" data-sender="${esc(m.sender_id)}">${esc(m.body)}</div>`).join('') : '<div class="om-empty">Start your private conversation.</div>';
        msgBox.scrollTop = msgBox.scrollHeight;
      } catch (e) { if (!msgBox.querySelector('.om-bubble')) msgBox.innerHTML = `<div class="om-empty">${esc(e.message || 'Could not load messages.')}</div>`; }
    };

    window.__olanetOpenChat = async (p) => openChat(p);
    async function openChat(p) {
      if (!p || busy) return;
      busy = true;
      shell.classList.add('chat-open');
      root.querySelector('[data-chat-name]').textContent = p.full_name || p.username || 'OLANET user';
      root.querySelector('[data-chat-avatar]').innerHTML = p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="">` : esc(initials(p));
      compose.disabled = true; sendBtn.disabled = true;
      msgBox.innerHTML = '<div class="om-empty">Opening conversation…</div>';
      try {
        const c = await api('/conversations', { method:'POST', body:JSON.stringify({user_ids:[p.id]}) });
        conversation = c?.id;
        if (!conversation) throw new Error('The chat did not return a conversation ID.');
        await loadMessages();
        clearInterval(timer); timer = setInterval(loadMessages, 4000);
        compose.disabled = false; sendBtn.disabled = false; compose.focus();
      } catch (e) {
        msgBox.innerHTML = `<div class="om-empty">${esc(e.message || 'Could not open this chat.')}</div>`;
        compose.disabled = true; sendBtn.disabled = true;
      } finally { busy = false; }
    }

    const send = async () => {
      const text = compose.value.trim();
      if (!text || !conversation || busy) return;
      busy=true; sendBtn.disabled=true;
      try { await api(`/conversations/${encodeURIComponent(conversation)}/messages`, { method:'POST', body:JSON.stringify({body:text}) }); compose.value=''; await loadMessages(); }
      catch(e){ alert(e.message); }
      finally{ busy=false; sendBtn.disabled=!conversation; }
    };

    root.querySelector('[data-close]').onclick = () => { destroy(); history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); };
    root.querySelector('[data-back]').onclick = () => { shell.classList.remove('chat-open'); history.replaceState({}, '', '/messages'); window.dispatchEvent(new PopStateEvent('popstate')); };
    searchBtn.onclick = loadPeople;
    search.addEventListener('keydown', e => { if (e.key === 'Enter') loadPeople(); });
    sendBtn.onclick = send;
    compose.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

    try {
      await loadSession();
      const list = await loadPeople();
      await openChatFromQuery(list);
    } catch (e) {
      peopleBox.innerHTML = `<div class="om-empty">${esc(e.message || 'Please log in again.')}</div>`;
    } finally { booting = false; }
  };

  window.addEventListener('popstate', () => {
    if (location.pathname === '/messages') boot(); else destroy();
  });
  boot();
})();
