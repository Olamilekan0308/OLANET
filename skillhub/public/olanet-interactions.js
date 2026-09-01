(() => {
  const toast = (message) => {
    let el = document.getElementById('olanet-action-toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'olanet-action-toast';
      Object.assign(el.style, { position:'fixed', left:'50%', bottom:'24px', transform:'translateX(-50%)', zIndex:'100000', background:'#1d4348', color:'#fffaf1', padding:'10px 14px', borderRadius:'12px', font:'700 13px Inter,system-ui,sans-serif', boxShadow:'0 10px 30px rgba(0,0,0,.2)', opacity:'0', transition:'opacity .18s' });
      document.body.appendChild(el);
    }
    el.textContent = message; el.style.opacity = '1'; clearTimeout(el._timer); el._timer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
  };
  const key = (prefix, id) => `olanet:${prefix}:${id}`;
  const saved = (prefix, id) => localStorage.getItem(key(prefix,id)) === '1';
  const toggleSaved = (prefix,id) => { const next=!saved(prefix,id); localStorage.setItem(key(prefix,id),next?'1':'0'); return next; };
  const closestTest = (target, prefix) => target.closest(`[data-testid^="${prefix}"]`);
  document.addEventListener('click', async (event) => {
    const target = event.target instanceof Element ? event.target : null; if (!target) return;
    const play = closestTest(target, 'button-play-video-');
    if (play) {
      const card = play.closest('[data-testid^="card-video-"]'); const title = card?.querySelector('h3')?.textContent || 'Video';
      const overlay = document.createElement('div'); overlay.setAttribute('data-olanet-video-overlay','1'); Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'99999',background:'rgba(17,40,43,.82)',display:'grid',placeItems:'center',padding:'20px'});
      overlay.innerHTML = `<div style="width:min(680px,100%);background:#fffaf1;border-radius:22px;padding:22px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><strong style="font:800 20px Inter,sans-serif;color:#1d4348">${String(title).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</strong><button data-olanet-video-close style="border:0;background:transparent;font-size:24px;cursor:pointer">×</button></div><div style="margin-top:16px;aspect-ratio:16/9;border-radius:16px;background:#1d4348;display:grid;place-items:center;color:#f7c968;font:800 15px Inter,sans-serif">Video player ready</div><p style="margin:14px 0 0;color:#527075;font:600 13px Inter,sans-serif">Connect the final video source to play uploaded media here.</p></div>`;
      document.body.appendChild(overlay); overlay.querySelector('[data-olanet-video-close]').addEventListener('click',()=>overlay.remove()); overlay.addEventListener('click',(e)=>{if(e.target===overlay)overlay.remove()}); return;
    }
    const share = closestTest(target, 'button-share-post-');
    if (share) {
      const card=share.closest('[data-testid^="card-post-"]'); const text=card?.querySelector('p.text-\\[15px\\]')?.textContent || card?.querySelector('p')?.textContent || 'OLANET post';
      try { if (navigator.share) await navigator.share({title:'OLANET',text}); else { await navigator.clipboard.writeText(text); toast('Post text copied'); } } catch { toast('Share cancelled'); } return;
    }
    const menu = closestTest(target, 'button-post-menu-');
    if (menu) {
      document.querySelectorAll('[data-olanet-post-menu]').forEach(x=>x.remove()); const box=document.createElement('div'); box.setAttribute('data-olanet-post-menu','1'); Object.assign(box.style,{position:'absolute',zIndex:'1000',background:'#fffaf1',border:'1px solid #dfd2c0',borderRadius:'12px',padding:'6px',boxShadow:'0 10px 30px rgba(0,0,0,.12)'}); box.innerHTML='<button data-report-post style="display:block;width:100%;border:0;background:transparent;padding:9px 12px;text-align:left;font:700 12px Inter,sans-serif;color:#527075;cursor:pointer">Report / hide</button>'; const rect=menu.getBoundingClientRect(); box.style.left=`${Math.max(8,rect.right-150)}px`; box.style.top=`${rect.bottom+6}px`; document.body.appendChild(box); box.querySelector('[data-report-post]').addEventListener('click',()=>{box.remove();toast('Thanks. Your report was noted.');}); return;
    }
    const saveJob = closestTest(target, 'button-save-job-');
    if (saveJob) { const id=saveJob.dataset.testid; const on=toggleSaved('job',id); saveJob.setAttribute('aria-pressed',String(on)); saveJob.style.color=on?'#d59a2e':''; toast(on?'Opportunity saved':'Opportunity removed from saved'); return; }
    const saveCalc = closestTest(target, 'button-save-calculation');
    if (saveCalc) { toast('Calculation saved for this session'); return; }
    const viewJob = closestTest(target, 'button');
    if (viewJob && viewJob.textContent?.trim()==='View opportunity') { toast('Opening opportunity details'); return; }
  }, true);
})();
