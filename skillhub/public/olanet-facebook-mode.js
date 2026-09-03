(() => {
  const VERSION = 'olanet-facebook-ui-v2';
  try {
    if (localStorage.getItem('olanet-ui-version') !== VERSION) {
      localStorage.setItem('olanet-ui-version', VERSION);
      localStorage.setItem('olanet-theme', 'light');
    }
    document.documentElement.dataset.olanetTheme = localStorage.getItem('olanet-theme') === 'dark' ? 'dark' : 'light';
  } catch {}
})();
