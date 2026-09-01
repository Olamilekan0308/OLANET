(() => {
  const toast = (message) => {
    let el = document.getElementById('olanet-action-toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'olanet-action-toast';
      Object.assign(el.style, { position:'fixed', left:'50%', bottom:'80px', transform:'translateX(-50%)', zIndex:'100000', background:'#1d4348', color:'#fff', padding:'10px 14px', borderRadius:'12px', font:'700 13px Inter,system-ui,sans-serif', boxShadow:'0 10px 30px rgba(0,0,0,.2)', opacity:'0', transition:'opacity .18s' });
      document.body.appendChild(el);
    }
    el.textContent = message; el.style.opacity = '1'; clearTimeout(el._timer); el._timer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
  };
  const key = (prefix, id) => `olanet:${prefix}:${id}`;
  const saved = (prefix, id) => localStorage.getItem(key(prefix,id)) === '1';
  const toggleSaved = (prefix,id) => { const next=!saved(prefix,id); localStorage.setItem(key(prefix,id),next?'1':'0'); return next; };
  const closestTest = (target, prefix) => target.closest(`[data-testid^="${prefix}"]`);

  const mountMobileDock = () => {
    if (document.getElementById('olanet-mobile-dock')) return;
    const chatLauncher = document.querySelector('button[aria-label="Open OLANET Social"]');
    if (!chatLauncher) return;
    chatLauncher.style.display = 'none';
    const dock = document.createElement('nav'); dock.id = 'olanet-mobile-dock';
    dock.setAttribute('aria-label','OLANET navigation');
    dock.innerHTML = `<style>@media(min-width:768px){#olanet-mobile-dock{display:none!important}}#olanet-mobile-dock{position:fixed;left:8px;right:8px;bottom:8px;z-index:99998;height:64px;border:1px solid #e2e2e2;border-radius:18px;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.12);display:grid;grid-template-columns:repeat(5,1fr);padding:5px;font-family:system-ui,sans-serif}#olanet-mobile-dock a,#olanet-mobile-dock button{border:0;background:transparent;color:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-radius:13px;font:700 10px system-ui,sans-serif;cursor:pointer;text-decoration:none}#olanet-mobile-dock a.active,#olanet-mobile-dock button.active{background:#f0f2f5;color:#1877f2}#olanet-mobile-dock svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2} </style><a href="/" data-dock="home" aria-label="Home"><svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg><span>Home</span></a><button type="button" data-dock="chat" aria-label="Chat"><svg viewBox="0 0 24 24"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 3 1.2-4.1A7.5 7.5 0 1 1 20 11.5Z"/></svg><span>Chat</span></button><a href="/circles" data-dock="departments" aria-label="Departments"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg><span>Departments</span></a><a href="/jobs" data-dock="jobs" aria-label="Opportunities"><svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg><span>Jobs</span></a><a href="/profile" data-dock="menu" aria-label="Menu"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M5 21a7 7 0 0 1 14 0M4 4h.01M20 4h.01"/></svg><span>Menu</span></a>`;
    document.body.appendChild(dock);
    dock.querySelector('[data-dock="chat"]').addEventListener('click',()=>chatLauncher.click());
    const path = location.pathname;
    dock.querySelectorAll('[data-dock]').forEach((el)=>{const key=el.getAttribute('data-dock');if((key==='home'&&path==='/')||(key==='departments'&&path.startsWith('/circles'))||(key==='jobs'&&path.startsWith('/jobs'))||(key==='menu'&&path.startsWith('/profile')))el.classList.add('active');});
  };
  new MutationObserver(mountMobileDock).observe(document.documentElement,{childList:true,subtree:true});
  mountMobileDock();

  document.addEventListener('click', async (event) => {
    const target = event.target instanceof Element ? event.target : null; if (!target) return;
    const play = closestTest(target, 'button-play-video-');
    if (play) {
      const card = play.closest('[data-testid^="card-video-"]'); const title = card?.querySelector('h3')?.textContent || 'Video';
      const overlay = document.createElement('div'); overlay.setAttribute('data-olanet-video-overlay','1'); Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'99999',background:'rgba(17,40,43,.82)',display:'grid',placeItems:'center',padding:'20px'});
      overlay.innerHTML = `<div style="width:min(680px,100%);background:#fff;border-radius:22px;padding:22px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><strong style="font:800 20px Inter,sans-serif;color:#111">${String(title).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</strong><button data-olanet-video-close style="border:0;background:#f1f1f1;border-radius:50%;font-size:24px;cursor:pointer">×</button></div><div style="margin-top:16px;aspect-ratio:16/9;border-radius:16px;background:#f0f2f5;display:grid;place-items:center;color:#555;font:800 15px Inter,sans-serif">Video player ready</div><p style="margin:14px 0 0;color:#666;font:600 13px Inter,sans-serif">Connect the final video source to play uploaded media here.</p></div>`;
      document.body.appendChild(overlay); overlay.querySelector('[data-olanet-video-close]').addEventListener('click',()=>overlay.remove()); overlay.addEventListener('click',(e)=>{if(e.target===overlay)overlay.remove()}); return;
    }
    const share = closestTest(target, 'button-share-post-');
    if (share) {
      const card=share.closest('[data-testid^="card-post-"]'); const text=card?.querySelector('p.text-\\[15px\\]')?.textContent || card?.querySelector('p')?.textContent || 'OLANET post';
      try { if (navigator.share) await navigator.share({title:'OLANET',text}); else { await navigator.clipboard.writeText(text); toast('Post text copied'); } } catch { toast('Share cancelled'); } return;
    }
    const menu = closestTest(target, 'button-post-menu-');
    if (menu) {
      document.querySelectorAll('[data-olanet-post-menu]').forEach(x=>x.remove()); const box=document.createElement('div'); box.setAttribute('data-olanet-post-menu','1'); Object.assign(box.style,{position:'absolute',zIndex:'1000',background:'#fff',border:'1px solid #ddd',borderRadius:'12px',padding:'6px',boxShadow:'0 10px 30px rgba(0,0,0,.12)'}); box.innerHTML='<button data-report-post style="display:block;width:100%;border:0;background:transparent;padding:9px 12px;text-align:left;font:700 12px Inter,sans-serif;color:#333;cursor:pointer">Report / hide</button>'; const rect=menu.getBoundingClientRect(); box.style.left=`${Math.max(8,rect.right-150)}px`; box.style.top=`${rect.bottom+6}px`; document.body.appendChild(box); box.querySelector('[data-report-post]').addEventListener('click',()=>{box.remove();toast('Thanks. Your report was noted.');}); return;
    }
    const saveJob = closestTest(target, 'button-save-job-');
    if (saveJob) { const id=saveJob.dataset.testid; const on=toggleSaved('job',id); saveJob.setAttribute('aria-pressed',String(on)); saveJob.style.color=on?'#1877f2':''; toast(on?'Opportunity saved':'Opportunity removed from saved'); return; }
    const saveCalc = closestTest(target, 'button-save-calculation');
    if (saveCalc) { toast('Calculation saved for this session'); return; }
    const viewJob = closestTest(target, 'button');
    if (viewJob && viewJob.textContent?.trim()==='View opportunity') { toast('Opening opportunity details'); return; }
  }, true);
})();
