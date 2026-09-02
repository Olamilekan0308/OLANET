(() => {
  const send = (action, entityId = null, metadata = {}) => {
    fetch('/api/activity', {method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({action,entity_type:metadata.entity_type||'social',entity_id:entityId,metadata})}).catch(() => {});
  };
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const input = args[0];
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input?.url || '');
      const method = String((args[1]?.method || (input instanceof Request ? input.method : 'GET'))).toUpperCase();
      if (response.ok && url.includes('/api/') && !url.includes('/api/activity')) {
        if (url.includes('/api/friends/request') && method === 'POST') send('friend_request', null, {entity_type:'friendship'});
        else if (/\/api\/conversations\/\d+\/messages/.test(url) && method === 'POST') send('chat_message', url.match(/\/conversations\/(\d+)\/messages/)?.[1] || null, {entity_type:'conversation'});
        else if (url.endsWith('/api/conversations') && method === 'POST') send('chat_open', null, {entity_type:'conversation'});
      }
    } catch {}
    return response;
  };
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const like = target.closest('[data-testid^="button-like-post-"]');
    if (like) { send('post_like', like.getAttribute('data-testid')?.replace('button-like-post-','') || null, {entity_type:'post'}); return; }
    const share = target.closest('[data-testid^="button-share-post-"]');
    if (share) { send('post_share', share.getAttribute('data-testid')?.replace('button-share-post-','') || null, {entity_type:'post'}); return; }
    const comment = target.closest('[data-testid^="button-send-comment-"]');
    if (comment) {
      const id = comment.getAttribute('data-testid')?.replace('button-send-comment-','') || null;
      const card = comment.closest('[data-testid^="card-post-"]');
      const input = card?.querySelector('[data-testid^="input-comment-"]');
      send('post_comment', id, {entity_type:'post',has_text:Boolean(input?.value?.trim())});
    }
  }, true);
})();