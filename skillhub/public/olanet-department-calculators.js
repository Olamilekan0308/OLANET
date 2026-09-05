(() => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mount = async () => {
    if (location.pathname !== '/circles' || document.getElementById('olanet-live-calculators')) return;
    try {
      const r = await fetch('/api/circles', { credentials: 'include' });
      const data = await r.json().catch(() => null);
      if (!r.ok || !Array.isArray(data?.circles)) return;
      const host = document.createElement('section'); host.id = 'olanet-live-calculators';
      host.style.cssText = 'margin:24px auto;max-width:1100px;padding:20px;border:1px solid #dfd2c0;border-radius:22px;background:#fffaf1;font-family:system-ui,sans-serif;box-shadow:0 8px 30px rgba(29,67,72,.06)';
      host.innerHTML = `<div style="display:flex;justify-content:space-between;gap:12px;align-items:end;flex-wrap:wrap"><div><div style="font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#2f817d">Level 8 · live tools</div><h2 style="margin:6px 0 0;font-size:28px;line-height:1.1;color:#1d4348">Department calculators</h2><p style="margin:7px 0 0;font-size:13px;color:#789093">Choose a department and use its real calculator catalog.</p></div><span style="font-size:11px;font-weight:700;color:#789093">Connected to OLANET</span></div><div id="olanet-calc-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-top:18px"></div>`;
      const main = document.querySelector('main'); if (!main) return; main.appendChild(host);
      const grid = host.querySelector('#olanet-calc-grid');
      data.circles.forEach(circle => {
        const card = document.createElement('article'); card.style.cssText='border:1px solid #eadfce;border-radius:16px;padding:15px;background:#f8f2e8';
        card.innerHTML=`<div style="font-weight:800;color:#1d4348">${esc(circle.name)}</div><div style="margin-top:4px;font-size:11px;color:#789093">${Number(circle.memberCount||0).toLocaleString()} members · ${circle.isMember?'Joined':'Not joined'}</div><button type="button" data-circle-id="${esc(circle.id)}" style="margin-top:12px;width:100%;border:0;border-radius:10px;padding:10px;background:#1d4348;color:#fffaf1;font-weight:800;cursor:pointer">View calculators</button>`;
        card.querySelector('button').addEventListener('click', async () => {
          const btn = card.querySelector('button'); btn.disabled=true; btn.textContent='Loading…';
          try {
            const cr = await fetch(`/api/circles/${encodeURIComponent(circle.id)}/calculators`, {credentials:'include'}); const cd=await cr.json().catch(()=>null); if(!cr.ok) throw new Error(cd?.error||'Unable to load calculators');
            const list=Array.isArray(cd?.calculators)?cd.calculators:[];
            card.insertAdjacentHTML('beforeend', `<div style="margin-top:12px;display:grid;gap:7px">${list.length ? list.map(x=>`<div style="padding:10px;border-radius:10px;background:#fffaf1;border:1px solid #dfd2c0"><div style="font-size:12px;font-weight:800;color:#1d4348">${esc(x.name)}</div><div style="margin-top:3px;font-size:11px;color:#789093">${esc(x.description)}</div></div>`).join('') : '<div style="font-size:11px;color:#789093">No calculator catalog yet for this department.</div>'}</div>`);
            btn.remove();
          } catch(e) { btn.disabled=false; btn.textContent='Retry'; }
        });
        grid.appendChild(card);
      });
    } catch (_) {}
  };
  const observer = new MutationObserver(() => mount()); observer.observe(document.documentElement,{childList:true,subtree:true}); mount();
})();
