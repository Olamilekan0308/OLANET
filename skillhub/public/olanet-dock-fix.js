(() => {
  const bind = () => {
    const button = document.querySelector('#olanet-mobile-dock [data-dock="chat"]');
    if (!button || button.dataset.olanetBound === '1') return;
    button.dataset.olanetBound = '1';
    button.addEventListener('click', (event) => {
      const launcher = document.querySelector('button[aria-label="Open OLANET Direct Messages"]');
      if (launcher) {
        event.preventDefault();
        launcher.click();
        return;
      }
      if (location.pathname !== '/messages') location.href = '/messages';
    });
  };
  new MutationObserver(bind).observe(document.documentElement, { childList: true, subtree: true });
  bind();
})();
