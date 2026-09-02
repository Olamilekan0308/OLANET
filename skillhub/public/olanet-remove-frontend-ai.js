(() => {
  const block = () => {
    if (window.location.pathname === '/snap-solve') window.history.replaceState({}, '', '/');
    const text = (el) => (el?.textContent || '').trim().toLowerCase();
    document.querySelectorAll('a,button').forEach((el) => {
      const t = text(el);
      if (t.includes('snap & solve') || t.includes('solve this with me') || t.includes('solution studio')) {
        if (el.tagName === 'A') el.remove(); else el.style.display = 'none';
      }
    });
  };
  block();
  new MutationObserver(block).observe(document.documentElement, { childList: true, subtree: true });
})();
