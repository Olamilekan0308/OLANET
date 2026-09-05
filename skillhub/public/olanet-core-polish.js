(() => {
  const esc = (value) => String(value ?? '').replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[c]));
  const toast = (message) => {
    let el = document.getElementById('olanet-polish-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'olanet-polish-toast';
      Object.assign(el.style, { position: 'fixed', left: '50%', bottom: '82px', transform: 'translateX(-50%)', zIndex: '100001', background: '#1d4348', color: '#fffaf1', padding: '10px 14px', borderRadius: '12px', font: '700 13px system-ui', boxShadow: '0 10px 30px rgba(0,0,0,.2)', opacity: '0', transition: 'opacity .18s' });
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
  };

  const mountMessagePicker = () => {
    const button = document.querySelector('[data-testid="button-new-message"]');
    if (!button || button.dataset.polishBound === '1') return;
    button.dataset.polishBound = '1';
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const existing = document.getElementById('olanet-message-picker');
      if (existing) return;
      const overlay = document.createElement('div');
      overlay.id = 'olanet-message-picker';
      Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '100000', background: 'rgba(17,40,43,.42)', display: 'grid', placeItems: 'center', padding: '16px' });
      overlay.innerHTML = `<div style="width:min(460px,100%);max-height:80vh;overflow:auto;background:#fffaf1;border:1px solid #dfd2c0;border-radius:22px;padding:18px;box-shadow:0 20px 60px rgba(29,67,72,.25)"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><div style="font:800 20px system-ui;color:#1d4348">New message</div><div style="margin-top:3px;font:500 12px system-ui;color:#789093">Find an OLANET member to start a conversation.</div></div><button data-close style="border:0;background:#f1e4cc;color:#1d4348;border-radius:50%;width:34px;height:34px;font-size:22px;cursor:pointer">×</button></div><input data-message-search autofocus placeholder="Search by name or username" style="box-sizing:border-box;width:100%;margin-top:16px;border:1px solid #dfd2c0;border-radius:12px;background:#f8f2e8;padding:12px;outline:none;font:500 13px system-ui;color:#1d4348"><div data-message-results style="margin-top:10px"></div></div>`;
      document.body.appendChild(overlay);
      const input = overlay.querySelector('[data-message-search]');
      const results = overlay.querySelector('[data-message-results]');
      const close = () => overlay.remove();
      overlay.querySelector('[data-close]').addEventListener('click', close);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      let timer = 0;
      const search = async () => {
        const q = input.value.trim();
        if (!q) { results.innerHTML = '<div style="padding:18px;text-align:center;font:600 12px system-ui;color:#789093">Start typing to find a member.</div>'; return; }
        results.innerHTML = '<div style="padding:14px;font:600 12px system-ui;color:#789093">Searching…</div>';
        try {
          const r = await fetch('/api/people?q=' + encodeURIComponent(q), { credentials: 'include' });
          const data = await r.json().catch(() => []);
          if (!r.ok) throw new Error(data?.error || 'Search failed');
          if (!Array.isArray(data) || !data.length) { results.innerHTML = '<div style="padding:18px;text-align:center;font:600 12px system-ui;color:#789093">No member found.</div>'; return; }
          results.innerHTML = data.slice(0, 20).map((p) => `<button data-user-id="${esc(p.id)}" style="width:100%;display:flex;align-items:center;gap:10px;border:0;background:transparent;border-radius:12px;padding:10px;text-align:left;cursor:pointer"><div style="width:38px;height:38px;border-radius:50%;overflow:hidden;background:#e8c17a;display:grid;place-items:center;font:800 12px system-ui;color:#1d4348">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="" style="width:100%;height:100%;object-fit:cover">` : esc((p.full_name || p.username || 'OM').split(/\s+/).map((x) => x[0]).join('').slice(0,2).toUpperCase())}</div><div style="min-width:0;flex:1"><div style="font:800 13px system-ui;color:#1d4348">${esc(p.full_name || p.username || 'OLANET member')}</div><div style="font:500 11px system-ui;color:#789093">${esc(p.username ? '@' + p.username : 'OLANET member')}</div></div><span style="font:800 11px system-ui;color:#2f817d">Message</span></button>`).join('');
          results.querySelectorAll('[data-user-id]').forEach((item) => item.addEventListener('click', async () => {
            const userId = item.getAttribute('data-user-id');
            if (!userId) return;
            item.disabled = true;
            try {
              const response = await fetch('/api/messages/conversations', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_ids: [userId] }) });
              const payload = await response.json().catch(() => null);
              if (!response.ok) throw new Error(payload?.error || 'Could not start conversation');
              window.location.href = '/messages';
            } catch (error) {
              item.disabled = false;
              toast(error instanceof Error ? error.message : 'Could not start conversation');
            }
          }));
        } catch (error) {
          results.innerHTML = `<div style="padding:14px;color:#a24f42;font:700 12px system-ui">${esc(error instanceof Error ? error.message : 'Search failed')}</div>`;
        }
      };
      input.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(search, 180); });
      search();
    }, true);
  };

  const refreshCommentCounts = () => {
    document.querySelectorAll('[data-testid^="card-post-"]').forEach(async (card) => {
      const id = card.getAttribute('data-testid')?.replace('card-post-', '');
      if (!id || card.dataset.interactionsLoaded === '1') return;
      card.dataset.interactionsLoaded = '1';
      try {
        const r = await fetch('/api/posts/' + encodeURIComponent(id) + '/interactions', { credentials: 'include' });
        const data = await r.json();
        if (!r.ok) return;
        const spans = card.querySelectorAll('div.mt-3.flex.items-center.justify-between span');
        if (spans[0] && typeof data.likes === 'number') spans[0].textContent = data.likes + ' people found this useful';
        if (spans[1] && typeof data.comments === 'number') spans[1].textContent = data.comments + ' comments';
      } catch {}
    });
  };

  const observer = new MutationObserver(() => { mountMessagePicker(); refreshCommentCounts(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  mountMessagePicker();
  refreshCommentCounts();
})();
