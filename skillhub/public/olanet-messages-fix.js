(() => {
  const boot = async () => {
    const root = document.getElementById('olanet-real-messages');
    if (!root) return;
    try {
      const r = await fetch('/api/auth/session', { credentials: 'include' });
      const data = await r.json();
      const userId = data?.user?.id;
      if (!userId) return;
      const paint = () => root.querySelectorAll('.om-bubble').forEach((el) => {
        const mine = el.getAttribute('data-sender') === userId;
        el.classList.toggle('om-me', mine);
        el.classList.toggle('om-them', !mine);
      });
      new MutationObserver(paint).observe(root, { childList: true, subtree: true });
      paint();
    } catch {}
  };
  setTimeout(boot, 250);
})();