(() => {
  const api = async (path, options = {}) => {
    const r = await fetch(`/api${path}`, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error(data?.error || 'Request failed');
    return data;
  };
  const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  let people = [];
  let loading = false;

  async function refreshPeople() {
    if (loading) return;
    loading = true;
    try {
      const data = await api('/people');
      people = Array.isArray(data) ? data : [];
    } catch (_) {} finally { loading = false; }
  }

  function buttonText(btn) { return (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function findPerson(btn) {
    const card = btn.closest('[data-testid^="card"], article, li, section, div');
    const text = norm(card?.textContent || '');
    return people.find(p => p.full_name && text.includes(norm(p.full_name))) || people.find(p => p.username && text.includes(`@${norm(p.username)}`)) || null;
  }

  function toast(message, error = false) {
    let el = document.getElementById('olanet-action-toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'olanet-action-toast';
      el.style.cssText = 'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:100001;padding:11px 16px;border-radius:12px;background:#173f40;color:#fff;font:700 13px system-ui;box-shadow:0 8px 30px rgba(0,0,0,.18);max-width:90vw;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = message; el.style.background = error ? '#9b5148' : '#173f40';
    clearTimeout(el._timer); el._timer = setTimeout(() => el.remove(), 2200);
  }

  function openChat(person) {
    if (document.getElementById('olanet-action-chat')) return;
    const root = document.createElement('div'); root.id = 'olanet-action-chat';
    root.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.28);font-family:system-ui,-apple-system,sans-serif';
    root.innerHTML = `<div style="position:absolute;right:16px;bottom:16px;width:min(430px,calc(100vw - 32px));height:min(650px,calc(100vh - 32px));background:#fff;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden"><header style="padding:14px 16px;border-bottom:1px solid #dbe6e3;display:flex;align-items:center;gap:10px"><div style="width:42px;height:42px;border-radius:50%;background:#dcefeb;color:#2f817d;display:grid;place-items:center;font-weight:850" data-avatar></div><div style="min-width:0;flex:1"><div style="font-weight:850;color:#173f40" data-name></div><div style="font-size:11px;color:#718182">Private conversation</div></div><button data-close style="border:0;background:#eef4f2;border-radius:10px;padding:9px;cursor:pointer">✕</button></header><div data-log style="flex:1;overflow:auto;padding:16px;background:#f6f9f8"></div><form data-form style="display:flex;gap:8px;padding:11px;border-top:1px solid #dbe6e3"><input data-input placeholder="Write a message…" style="min-width:0;flex:1;border:0;outline:0;background:#f1f5f4;border-radius:13px;padding:12px"><button style="width:46px;border:0;border-radius:12px;background:#2f817d;color:#fff;font-weight:900;cursor:pointer">➤</button></form></div>`;
    document.body.appendChild(root);
    root.querySelector('[data-name]').textContent = person.full_name || person.username || 'OLANET user';
    const initials = (person.full_name || person.username || 'OL').split(/\s+/).map(x => x[0]).join('').slice(0,2).toUpperCase();
    root.querySelector('[data-avatar]').textContent = initials;
    const log = root.querySelector('[data-log]'), input = root.querySelector('[data-input]');
    let conversation = null, timer = null, busy = false;
    const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
    const render = async () => { if (!conversation) return; try { const data = await api(`/conversations/${conversation}/messages`); const list = Array.isArray(data) ? data : []; const me = list.length ? null : null; log.innerHTML = list.length ? list.map(m => `<div style="display:flex;justify-content:flex-end;margin:0 0 7px" data-message="${esc(m.sender_id)}"><div style="max-width:78%;padding:9px 13px;border-radius:17px;background:#2f817d;color:#fff;font-size:13px;line-height:1.5">${esc(m.body)}</div></div>`).join('') : '<div style="text-align:center;color:#718182;padding:30px 10px;font-size:13px">Start your private conversation.</div>'; log.scrollTop = log.scrollHeight; } catch (e) { log.innerHTML = `<div style="text-align:center;color:#9b5148;padding:30px 10px;font-size:13px">${esc(e.message)}</div>`; } };
    const close = () => { clearInterval(timer); root.remove(); };
    root.querySelector('[data-close]').onclick = close;
    root.onclick = e => { if (e.target === root) close(); };
    root.querySelector('[data-form]').onsubmit = async e => { e.preventDefault(); const text = input.value.trim(); if (!text || !conversation || busy) return; busy = true; try { await api(`/conversations/${conversation}/messages`, { method:'POST', body:JSON.stringify({body:text}) }); input.value=''; await render(); } catch (err) { toast(err.message, true); } finally { busy=false; } };
    (async () => { try { const c = await api('/conversations', { method:'POST', body:JSON.stringify({user_ids:[person.id]}) }); conversation = c.id; await render(); timer=setInterval(render,4000); input.focus(); } catch (e) { log.innerHTML=`<div style="text-align:center;color:#9b5148;padding:30px 10px;font-size:13px">${esc(e.message)}</div>`; } })();
  }

  async function handleFriend(btn, person) {
    btn.disabled = true; const old = btn.textContent; btn.textContent = 'Sending…';
    try { const s = await api('/friends/request', { method:'POST', body:JSON.stringify({addressee_id:person.id}) }); btn.textContent = s.status === 'accepted' ? 'Friends' : s.incoming ? 'Accept' : 'Requested'; toast(s.status === 'accepted' ? 'You are now friends.' : 'Friend request saved.'); }
    catch (e) { btn.disabled=false; btn.textContent=old || 'Add Friend'; toast(e.message, true); }
  }

  async function handleClick(e) {
    if (location.pathname === '/messages') return;
    const btn = e.target.closest('button'); if (!btn) return;
    const text = buttonText(btn);
    const isFriend = ['add friend','addfriend','request friend','request'].includes(text);
    const isMessage = ['message','send message','chat'].includes(text);
    if (!isFriend && !isMessage) return;
    const person = findPerson(btn);
    if (!person) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (isFriend) await handleFriend(btn, person); else openChat(person);
  }

  document.addEventListener('click', handleClick, true);
  refreshPeople();
  setInterval(() => { if (location.pathname !== '/messages') refreshPeople(); }, 5000);
})();
