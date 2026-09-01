(() => {
  const MEDIA_HINTS = ['photo', 'picture', 'image', 'video', 'voice', 'audio', 'file', 'attach', 'camera', 'gallery'];
  const isMediaControl = (node) => {
    const text = `${node?.textContent || ''} ${node?.getAttribute?.('aria-label') || ''} ${node?.getAttribute?.('title') || ''}`.toLowerCase();
    return MEDIA_HINTS.some((hint) => text.includes(hint));
  };
  const clean = () => {
    document.querySelectorAll('button, label, [role="button"]').forEach((node) => {
      const text = `${node.textContent || ''} ${node.getAttribute('aria-label') || ''}`.toLowerCase();
      if (!text.includes('view once')) return;
      if (isMediaControl(node.parentElement) || isMediaControl(node.previousElementSibling) || isMediaControl(node.nextElementSibling)) return;
      node.style.display = 'none';
      node.setAttribute('aria-hidden', 'true');
    });
  };
  clean();
  new MutationObserver(clean).observe(document.body, { childList: true, subtree: true });
})();
