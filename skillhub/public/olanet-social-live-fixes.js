(() => {
  const esc = (value) => String(value ?? '').replace(/[&<>\"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  const findPostId = (url) => {
    const m = String(url || '').match(/\/api\/posts\/([^/]+)\/(comments|share)(?:\?|$)/);
    return m ? decodeURIComponent(m[1]) : null;
  };

  const findCard = (postId) => document.querySelector(`[data-testid="card-post-${CSS.escape(postId)}"]`) || document.querySelector(`[data-testid^="card-post-"] [data-post-id="${CSS.escape(postId)}"]`)?.closest('[data-testid^="card-post-"]');

  const addLocalComment = (postId, body) => {
    const input = document.querySelector(`[data-testid="input-comment-${CSS.escape(postId)}"]`);
    if (!input) return;
    const card = findCard(postId);
    if (!card) return;
    let list = card.querySelector('[data-olanet-live-comments]');
    if (!list) {
      list = document.createElement('div');
      list.setAttribute('data-olanet-live-comments', '1');
      list.style.cssText = 'display:grid;gap:7px;margin:8px 0 10px;';
      input.closest('form')?.before(list) || input.parentElement?.before(list);
    }
    const item = document.createElement('div');
    item.style.cssText = 'padding:8px 10px;border-radius:12px;background:var(--olanet-hover,#f0f2f5);font:600 13px system-ui,sans-serif;color:var(--olanet-text,#333);';
    item.innerHTML = `<strong style="font-weight:800">You</strong><div style="margin-top:2px;white-space:pre-wrap;overflow-wrap:anywhere">${esc(body)}</div>`;
    list.appendChild(item);
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const incrementShare = (postId) => {
    const card = findCard(postId);
    if (!card) return;
    const button = card.querySelector(`[data-testid="button-share-post-${CSS.escape(postId)}"]`);
    if (!button || button.dataset.olanetShareUpdated === '1') return;
    button.dataset.olanetShareUpdated = '1';
    const text = button.textContent || '';
    const match = text.match(/(\d+)/);
    if (match) button.textContent = text.replace(match[1], String(Number(match[1]) + 1));
    else button.textContent = `${text.trim()} 1`.trim();
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const request = args[0];
      const url = typeof request === 'string' ? request : request?.url;
      const method = String(args[1]?.method || request?.method || 'GET').toUpperCase();
      if (response.ok && method === 'POST') {
        const postId = findPostId(url);
        if (postId && String(url).includes('/comments')) {
          const payload = args[1]?.body;
          let body = null;
          try { body = payload ? JSON.parse(payload)?.body : null; } catch (_) {}
          if (body) addLocalComment(postId, body);
        } else if (postId && String(url).includes('/share')) {
          incrementShare(postId);
        }
      }
    } catch (_) {}
    return response;
  };
})();
