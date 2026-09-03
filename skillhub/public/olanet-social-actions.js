(() => {
  const api = async (path, options = {}) => {
    const r = await fetch('/api' + path, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error(data?.error || 'Request failed');
    return data;
  };
  const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  let people = [];
  let loading = false;
  let searchTimer = null;

  async function refreshPeople(query = '') {
    if (loading || location.pathname === '/messages') return [];
    loading = true;
    try {
      const suffix = query ? '?q=' + encodeURIComponent(query) : '';
      const data = await api('/people' + suffix);
      people = Array.isArray(data) ? data : [];
      return people;
    } catch (_) { return []; } finally { loading = false; }
  }

  function buttonText(btn) { return (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function findPerson(btn) {
    const card = btn.closest('[data-testid^="card"], article, li, section, div');
    const text = norm(card?.textContent || '');
    return people.find(p => p.full_name && text.includes(norm(p.full_name))) || people.find(p => p.username && text.includes('@' + norm(p.username))) || null;
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

  function goToMessenger(person) {
    if (!person?.id) return;
    history.pushState({}, '', '/messages?user=' + encodeURIComponent(person.id));
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  async function handleFriend(btn, person) {
    btn.disabled = true; const old = btn.textContent;
    btn.textContent = 'Sending…';
    try {
      const s = await api('/friends/request', { method: 'POST', body: JSON.stringify({ addressee_id: person.id }) });
      btn.textContent = s.status === 'accepted' ? 'Friends' : s.incoming ? 'Accept' : 'Requested';
      toast(s.status === 'accepted' ? 'You are now friends.' : 'Friend request saved.');
    } catch (e) { btn.disabled = false; btn.textContent = old || 'Add Friend'; toast(e.message, true); }
  }

  function escapeHtml(value) { return String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }
  function closeSearch() { document.getElementById('olanet-global-search-results')?.remove(); }

  function renderSearchResults(results) {
    closeSearch();
    const box = document.createElement('div');
    box.id = 'olanet-global-search-results';
    box.style.cssText = 'position:fixed;top:58px;right:72px;width:min(360px,calc(100vw - 24px));max-height:420px;overflow:auto;z-index:100000;background:#fff;border:1px solid #dddfe2;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.16);padding:6px';
    if (!results.length) {
      box.innerHTML = '<div style="padding:14px;color:#65676b;font:600 13px system-ui">No OLANET users found.</div>';
    } else results.slice(0, 8).forEach(person => {
      const row = document.createElement('button');
      row.type = 'button'; row.dataset.olanetSearchResult = '1';
      row.style.cssText = 'display:flex;width:100%;align-items:center;gap:10px;padding:10px;border:0;border-radius:9px;background:transparent;text-align:left;cursor:pointer';
      const name = person.full_name || person.username || 'OLANET user';
      const initials = name.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
      row.innerHTML = '<span style="width:38px;height:38px;border-radius:50%;background:#e7f3ff;color:#1877f2;display:flex;align-items:center;justify-content:center;font:800 12px system-ui">' + initials + '</span><span style="min-width:0"><strong style="display:block;color:#1c1e21;font:700 14px system-ui">' + escapeHtml(name) + '</strong>' + (person.username ? '<small style="color:#65676b;font:500 12px system-ui">@' + escapeHtml(person.username) + '</small>' : '') + '</span><span style="margin-left:auto;color:#1877f2;font:700 12px system-ui">Message</span>';
      row.addEventListener('click', () => goToMessenger(person));
      box.appendChild(row);
    });
    document.body.appendChild(box);
  }

  function bindSearch() {
    const input = document.querySelector('input[data-testid="input-global-search"]');
    if (!input || input.dataset.olanetSearchBound === '1') return;
    input.dataset.olanetSearchBound = '1';
    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = input.value.trim();
      if (!q) { closeSearch(); return; }
      searchTimer = setTimeout(async () => renderSearchResults(await refreshPeople(q)), 250);
    });
    input.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });
  }

  async function handleClick(e) {
    if (location.pathname === '/messages') return;
    const btn = e.target.closest('button'); if (!btn) return;
    const text = buttonText(btn);
    const isFriend = ['add friend','addfriend','request friend','request'].includes(text);
    const isMessage = ['message','send message','chat'].includes(text);
    if (!isFriend && !isMessage) return;
    const person = findPerson(btn); if (!person) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (isFriend) await handleFriend(btn, person); else goToMessenger(person);
  }

  document.addEventListener('click', handleClick, true);
  bindSearch();
  new MutationObserver(bindSearch).observe(document.documentElement, { childList: true, subtree: true });
  refreshPeople();
  setInterval(() => { bindSearch(); refreshPeople(); }, 5000);
})();
