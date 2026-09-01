(() => {
  const KEY = 'olanet-theme';
  const root = document.documentElement;
  const style = document.createElement('style');
  style.textContent = `
    :root{--olanet-bg:#fffaf1;--olanet-surface:#fffaf1;--olanet-surface-2:#f8f2e8;--olanet-text:#1d4348;--olanet-muted:#527075;--olanet-border:#dfd2c0;--olanet-hover:#f0e5d2;--olanet-primary:#2f817d}
    html[data-olanet-theme="dark"]{--olanet-bg:#18191a;--olanet-surface:#242526;--olanet-surface-2:#3a3b3c;--olanet-text:#e4e6eb;--olanet-muted:#b0b3b8;--olanet-border:#3a3b3c;--olanet-hover:#303031;--olanet-primary:#2f817d;color-scheme:dark}
    html[data-olanet-theme="dark"],html[data-olanet-theme="dark"] body{background:var(--olanet-bg)!important;color:var(--olanet-text)!important}
    html[data-olanet-theme="dark"] [class*="bg-[#fffaf1]"],html[data-olanet-theme="dark"] [class*="bg-[#f8f2e8]"],html[data-olanet-theme="dark"] [class*="bg-white"]{background:var(--olanet-surface)!important}
    html[data-olanet-theme="dark"] [class*="text-[#1d4348]"],html[data-olanet-theme="dark"] [class*="text-[#365b60]"],html[data-olanet-theme="dark"] [class*="text-[#527075]"],html[data-olanet-theme="dark"] [class*="text-[#789093]"],html[data-olanet-theme="dark"] [class*="text-[#70878a]"],html[data-olanet-theme="dark"] [class*="text-[#52666a]"]{color:var(--olanet-text)!important}
    html[data-olanet-theme="dark"] [class*="border-[#dfd2c0]"],html[data-olanet-theme="dark"] [class*="border-[#eadfce]"],html[data-olanet-theme="dark"] [class*="border-[#ddceba]"],html[data-olanet-theme="dark"] [class*="border-[#d8c9b3]"]{border-color:var(--olanet-border)!important}
    html[data-olanet-theme="dark"] input,html[data-olanet-theme="dark"] textarea,html[data-olanet-theme="dark"] select{background:var(--olanet-surface-2)!important;color:var(--olanet-text)!important;border-color:#4b4c4d!important}
    html[data-olanet-theme="dark"] input::placeholder,html[data-olanet-theme="dark"] textarea::placeholder{color:#b0b3b8!important}
    html[data-olanet-theme="dark"] button:hover,html[data-olanet-theme="dark"] a:hover{background-color:var(--olanet-hover)}
    .olanet-theme-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:12px;border:1px solid var(--olanet-border);border-radius:14px;background:var(--olanet-surface);color:var(--olanet-text)}
    .olanet-theme-label{font-size:14px;font-weight:700}.olanet-theme-toggle{display:flex;border-radius:999px;padding:3px;background:#e4e6eb}
    .olanet-theme-toggle button{border:0!important;border-radius:999px!important;padding:7px 12px!important;font-size:12px!important;font-weight:700!important;cursor:pointer!important;background:transparent!important;color:#52666a!important}
    .olanet-theme-toggle button.active{background:#fff!important;color:#1d4348!important;box-shadow:0 1px 4px rgba(0,0,0,.12)}
    html[data-olanet-theme="dark"] .olanet-theme-toggle{background:#18191a}html[data-olanet-theme="dark"] .olanet-theme-toggle button{color:#b0b3b8!important}html[data-olanet-theme="dark"] .olanet-theme-toggle button.active{background:#3a3b3c!important;color:#fff!important}
    html[data-olanet-theme="dark"] #olanet-mobile-dock{background:#242526!important;border-color:#3a3b3c!important;box-shadow:0 8px 30px rgba(0,0,0,.45)!important}
    html[data-olanet-theme="dark"] #olanet-mobile-dock a,html[data-olanet-theme="dark"] #olanet-mobile-dock button{color:#e4e6eb!important;background:transparent!important}
    html[data-olanet-theme="dark"] #olanet-mobile-dock a.active,html[data-olanet-theme="dark"] #olanet-mobile-dock button.active{background:#3a3b3c!important;color:#459d99!important}
  `;
  document.head.appendChild(style);
  const apply=(theme)=>{const value=theme==='dark'?'dark':'light';root.dataset.olanetTheme=value;root.classList.toggle('dark',value==='dark');localStorage.setItem(KEY,value);document.querySelectorAll('.olanet-theme-toggle button').forEach(b=>b.classList.toggle('active',b.dataset.theme===value));};
  apply(localStorage.getItem(KEY)||'light');
  const addControl=()=>{if(document.querySelector('.olanet-theme-row'))return;const settings=[...document.querySelectorAll('button,h2,h3,p,div')].find(el=>el.textContent?.trim()==='Settings'&&el.closest('aside,[role="dialog"],.sheet-card'));const panel=settings?.closest('aside,[role="dialog"],.sheet-card');if(!panel)return;const row=document.createElement('div');row.className='olanet-theme-row';row.innerHTML='<span class="olanet-theme-label">Appearance</span><div class="olanet-theme-toggle"><button type="button" data-theme="light">Light</button><button type="button" data-theme="dark">Dark</button></div>';row.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>apply(b.dataset.theme)));panel.appendChild(row);apply(localStorage.getItem(KEY)||'light');};
  new MutationObserver(addControl).observe(document.body,{childList:true,subtree:true});setTimeout(addControl,500);
})();