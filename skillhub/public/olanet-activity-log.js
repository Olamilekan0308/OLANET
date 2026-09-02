(() => {
  const send = (action, entityId, metadata = {}) => {
    fetch('/api/activity', {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type':'application/json'},
      keepalive: true,
      body: JSON.stringify({action, entity_type:'post', entity_id:entityId, metadata})
    }).catch(() => {});
  };
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const like = target.closest('[data-testid^="button-like-post-"]');
    if (like) { send('post_like', like.getAttribute('data-testid')?.replace('button-like-post-','') || null); return; }
    const share = target.closest('[data-testid^="button-share-post-"]');
    if (share) { send('post_share', share.getAttribute('data-testid')?.replace('button-share-post-','') || null); return; }
    const comment = target.closest('[data-testid^="button-send-comment-"]');
    if (comment) {
      const id = comment.getAttribute('data-testid')?.replace('button-send-comment-','') || null;
      const card = comment.closest('[data-testid^="card-post-"]');
      const input = card?.querySelector('[data-testid^="input-comment-"]');
      send('post_comment', id, {has_text: Boolean(input?.value?.trim())});
    }
  }, true);
})();