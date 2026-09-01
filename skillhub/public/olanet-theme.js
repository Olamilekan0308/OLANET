(() => {
  const KEY = 'olanet-theme';
  const root = document.documentElement;
  const style = document.createElement('style');
  style.textContent = `
    html[data-olanet-theme="dark"],html[data-olanet-theme="dark"] body{background:#18191a!important;color:#e4e6eb!important}
    html[data-olanet-theme="dark"] [class*="bg-[#fffaf1]"],html[data-olanet-theme="dark"] [class*="bg-[#f8f2e8]"]{background:#242526!important}
    html[data-olanet-theme="dark"] [class*="text-[#1d4348]"],html[data-olanet-theme="dark"] [class*="text-[#365b60]"],html[data-olanet-theme="dark"] [class*="text-[#527075]"],html[data-olanet-theme="dark"] [class*="text-[#789093"]{color:#e4e6eb!important}
    html[data-olanet-theme="dark"] [class*="border-[#dfd2c0]"],html[data-olanet-theme="dark"] [class*="border-[#eadfce]"],html[data-olanet-theme="dark"] [class*="border-[#ddceba"]{border-color:#3a3b3c!important}
    html[data-olanet-theme="dark"] input,html[data-olanet-theme="dark"] textarea{background:#3a3b3c!important;color:#e4e6eb!important;border-color:#4b4c4d!important}
    html[data-olanet-theme="dark"] .olanet-mobile-nav{background:#242526!important;border-color:#3a3b3c!important}
    .olanet-theme-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:12px;border:1px solid #dfd2c0;border-radius:14px;background:#fffaf1}
    html[data-olanet-theme="dark"] .olanet-theme-row{background:#242526;border-color:#3a3b3c;color:#e4e6eb}
    .olanet-theme-label{font-size:14px;font-weight:700}.olanet-theme-toggle{display:flex;border-radius:999px;padding:3px;background:#e4e6eb}
    .olanet-theme-toggle button{border:0;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;background:transparent;color:#52666a}
    .olanet-theme-toggle button.active{background:#fff;color:#1d4348;box-shadow:0 1px 4px rgba(0,0,0,.12)}
    html[data-olanet-theme="dark"] .olanet-theme-toggle{background:#18191a}html[data-olanet-theme="dark"] .olanet-theme-toggle button{color:#b0b3b8}html[data-olanet-theme="dark"] .olanet-theme-toggle button.active{background:#3a3b3c;color:#fff}
  `;
  document.head.appendChild(style);
  const apply=(theme)=>{const value=theme==='dark'?'dark':'light';root.dataset.olanetTheme=value;root.classList.toggle('dark',value==='dark');localStorage.setItem(KEY,value);document.querySelectorAll('.olanet-theme-toggle button').forEach(b=>b.classList.toggle('active',b.dataset.theme===value));};
  apply(localStorage.getItem(KEY)||'light');
  const addControl=()=>{if(document.querySelector('.olanet-theme-row'))return;const candidates=[...document.querySelectorAll('button,h2,h3,p,div')];const settings=candidates.find(el=>el.textContent?.trim()==='Settings'&&el.closest('aside,[role="dialog"],.sheet-card'));const panel=settings?.closest('aside,[role="dialog"],.sheet-card');if(!panel)return;const row=document.createElement('div');row.className='olanet-theme-row';row.innerHTML='<span class="olanet-theme-label">Appearance</span><div class="olanet-theme-toggle"><button type="button" data-theme="light">Light</button><button type="button" data-theme="dark">Dark</button></div>';row.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>apply(b.dataset.theme)));panel.appendChild(row);apply(localStorage.getItem(KEY)||'light');};
  new MutationObserver(addControl).observe(document.body,{childList:true,subtree:true});setTimeout(addControl,500);
})();
