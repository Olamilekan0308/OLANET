(() => {
  const getPostId = (button) => button?.closest('[data-testid^="card-post-"]')?.getAttribute('data-testid')?.replace('card-post-', '');
  const showToast = (message) => {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;padding:10px 16px;border-radius:999px;background:#1d4348;color:#fffaf1;font:700 13px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.2);';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
  };

  document.addEventListener('click', async (event) => {
    const button = event.target?.closest?.('[data-testid^="button-share-post-"]');
    if (!button || button.dataset.olanetShareBusy === '1') return;
    event.preventDefault();
    event.stopPropagation();

    const postId = getPostId(button);
    if (!postId) return;
    button.dataset.olanetShareBusy = '1';
    button.disabled = true;

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
      });
      if (!response.ok) throw new Error(`Share failed (${response.status})`);

      const current = button.textContent || '';
      const count = current.match(/\d+/);
      button.textContent = count ? current.replace(count[0], String(Number(count[0]) + 1)) : 'Share 1';
      showToast('Post shared');
    } catch (_) {
      showToast('Could not share this post');
    } finally {
      button.disabled = false;
      button.dataset.olanetShareBusy = '0';
    }
  }, true);
})();
