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
    if (loading || location.pathname === '/messages') return;
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

  function goToMessenger(person) {
    if (!person?.id) return;
    const target = `/messages?user=${encodeURIComponent(person.id)}`;
    if (location.pathname === '/messages') {
      history.replaceState({}, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }
    history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  async function handleFriend(btn, person) {
    btn.disabled = true; const old = btn.textContent; btn.textContent = 'Sending…';
    try {
      const s = await api('/friends/request', { method: 'POST', body: JSON.stringify({ addressee_id: person.id }) });
      btn.textContent = s.status === 'accepted' ? 'Friends' : s.incoming ? 'Accept' : 'Requested';
      toast(s.status === 'accepted' ? 'You are now friends.' : 'Friend request saved.');
    } catch (e) { btn.disabled = false; btn.textContent = old || 'Add Friend'; toast(e.message, true); }
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
    if (isFriend) await handleFriend(btn, person); else goToMessenger(person);
  }

  document.addEventListener('click', handleClick, true);
  refreshPeople();
  setInterval(refreshPeople, 5000);
})();
