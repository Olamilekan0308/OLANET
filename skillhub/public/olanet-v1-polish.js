(() => {
  const snapTerms = ['snap & solve', 'snap and solve'];
  const callTerms = ['call', 'voice call', 'video call', 'start call'];

  function hideV2Entries() {
    document.querySelectorAll('a,button,[role="button"]').forEach((el) => {
      const text = (el.textContent || '').trim().toLowerCase();
      const href = (el.getAttribute('href') || '').toLowerCase();
      if (href.includes('/snap-solve') || snapTerms.some((term) => text === term || text.includes(term))) {
        el.style.setProperty('display', 'none', 'important');
      }
    });
  }

  function hideUnfinishedCalls() {
    document.querySelectorAll('button,a,[role="button"]').forEach((el) => {
      const text = (el.textContent || '').trim().toLowerCase();
      const label = `${text} ${(el.getAttribute('aria-label') || '').toLowerCase()} ${(el.getAttribute('title') || '').toLowerCase()}`;
      if (callTerms.some((term) => label === term || label.includes(term))) {
        el.style.setProperty('display', 'none', 'important');
      }
    });
  }

  function addPeopleNavigation() {
    if (window.location.pathname === '/people') return;
    if (document.querySelector('a[href="/people"], [data-olanet-people-link]')) return;
    const candidates = [...document.querySelectorAll('nav,aside,header')];
    const host = candidates.find((el) => el.querySelector('a[href="/"],a[href="/circles"],a[href="/messages"]')) || candidates[0];
    if (!host) return;
    const link = document.createElement('a');
    link.href = '/people';
    link.setAttribute('data-olanet-people-link', 'true');
    link.textContent = 'People';
    link.className = 'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#2f817d] hover:bg-[#e8f1ef] transition';
    const messageLink = host.querySelector('a[href="/messages"]');
    if (messageLink?.parentElement) messageLink.parentElement.insertBefore(link, messageLink);
    else host.appendChild(link);
  }

  const n = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const fmt = (value, digits = 2) => Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });

  function selectedTool() {
    const buttons = [...document.querySelectorAll('[data-testid^="button-tool-"]')];
    const active = buttons.find((button) => (button.className || '').includes('bg-[#1d4348]'));
    return active ? active.getAttribute('data-testid').replace('button-tool-', '') : '';
  }

  function calculator() {
    const result = document.querySelector('[data-testid="text-tool-result"]');
    if (!result) return;
    const inputs = [...document.querySelectorAll('[data-testid^="input-tool-"]')];
    const tool = selectedTool();
    const values = inputs.map((input) => n(input.value));
    let output = '';
    let formula = '';

    switch (tool) {
      case 'ohm': {
        const voltage = values[0] ?? 0;
        const resistance = values[1] ?? 0;
        const current = resistance ? voltage / resistance : 0;
        const power = voltage * current;
        output = `${fmt(current * 1000, 2)} mA • ${fmt(power, 2)} W`;
        formula = `I = V/R; P = VI = ${fmt(power, 2)} W.`;
        break;
      }
      case 'three': {
        const voltage = values[0] ?? 0;
        const current = values[1] ?? 0;
        const pf = values[2] ?? 0;
        const kw = Math.sqrt(3) * voltage * current * pf / 1000;
        const kva = Math.sqrt(3) * voltage * current / 1000;
        const kvar = Math.sqrt(Math.max(0, kva * kva - kw * kw));
        output = `${fmt(kw, 2)} kW • ${fmt(kva, 2)} kVA • ${fmt(kvar, 2)} kVAr`;
        formula = `P = √3VI·PF; S = √3VI; Q = √(S²−P²).`;
        break;
      }
      case 'rc': {
        const resistance = values[0] ?? 0;
        const capacitance = values[1] ?? 0;
        const tau = resistance * capacitance;
        output = `${fmt(tau, 4)} s • 5τ = ${fmt(tau * 5, 4)} s`;
        formula = `τ = RC; ≈63.2% at 1τ, ≈99.3% at 5τ.`;
        break;
      }
      case 'lumen': {
        const lumens = values[0] ?? 0;
        const lamps = values[1] ?? 0;
        const total = lumens * lamps;
        output = `${fmt(total, 0)} lm`;
        formula = `Total lumens = lumens per lamp × number of lamps.`;
        break;
      }
      case 'awg': {
        const area = values[0] ?? 0;
        const awg = area <= 1.5 ? 16 : area <= 2.5 ? 14 : area <= 4 ? 12 : area <= 6 ? 10 : area <= 10 ? 8 : 6;
        output = `${awg} AWG (approx.)`;
        formula = `Approximate cross-section mapping. Verify cable ampacity against conductor, insulation and installation conditions.`;
        break;
      }
      case 'hp': {
        const hp = values[0] ?? 0;
        const kw = hp * 0.746;
        output = `${fmt(kw, 3)} kW`;
        formula = `kW = HP × 0.746.`;
        break;
      }
      case 'feet': {
        const metres = values[0] ?? 0;
        const feet = metres * 3.28084;
        output = `${fmt(feet, 3)} ft`;
        formula = `ft = m × 3.28084.`;
        break;
      }
      case 'cost': {
        const unit = values[0] ?? 0;
        const quantity = values[1] ?? 0;
        const labour = values[2] ?? 0;
        const total = unit * quantity + labour;
        output = `₦${fmt(total, 2)}`;
        formula = `Total = unit cost × quantity + labour.`;
        break;
      }
      case 'general':
        output = fmt((values[0] ?? 0) + (values[1] ?? 0), 4);
        formula = `Result = first number + second number.`;
        break;
      case 'resistor':
        output = '470 Ω ±5%';
        formula = 'Yellow–Violet–Brown–Gold = 47 × 10¹ Ω ±5%.';
        break;
      default:
        return;
    }

    result.textContent = output;
    let helper = document.querySelector('[data-olanet-calculator-formula]');
    if (!helper) {
      helper = document.createElement('p');
      helper.setAttribute('data-olanet-calculator-formula', 'true');
      helper.className = 'mt-2 text-xs leading-5 text-[#b9d0cc]';
      result.parentElement?.appendChild(helper);
    }
    helper.textContent = formula;
  }

  function bind() {
    hideV2Entries();
    hideUnfinishedCalls();
    addPeopleNavigation();
    calculator();
  }

  document.addEventListener('input', (event) => {
    if (event.target && event.target.matches('[data-testid^="input-tool-"]')) calculator();
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-testid^="button-tool-"]')) setTimeout(calculator, 0);
  });

  const observer = new MutationObserver(() => bind());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', bind);
  setInterval(() => { hideV2Entries(); hideUnfinishedCalls(); addPeopleNavigation(); }, 1000);
})();
