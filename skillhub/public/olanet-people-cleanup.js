(() => {
  function cleanPeopleCards() {
    if (!location.pathname.includes('/people')) return;
    document.querySelectorAll('p,small,span,div').forEach((el) => {
      const text = (el.textContent || '').trim();
      if (text === '@member' || text === 'OLANET member') el.style.display = 'none';
    });
  }
  const observer = new MutationObserver(cleanPeopleCards);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', cleanPeopleCards);
  setInterval(cleanPeopleCards, 1000);
})();
