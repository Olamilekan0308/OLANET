(() => {
  const api = async (path, options={}) => { const r=await fetch(`/api${path}`,{credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})},...options}); const d=await r.json().catch(()=>null); if(!r.ok) throw new Error(d?.error||'Request failed'); return d; };
  const idOf = (el) => { const c=el.closest('[data-testid^="card-post-"]'); return c?.getAttribute('data-testid')?.slice('card-post-'.length)||null; };
  document.addEventListener('click', e => {
    const t=e.target instanceof Element?e.target:null; if(!t) return;
    const like=t.closest('[data-testid^="button-like-post-"]');
    if(like){ const id=idOf(like); if(id && !/^\d+$/.test(id)) api(`/posts/${id}/like`,{method:'POST'}).catch(()=>{}); return; }
    const send=t.closest('[data-testid^="button-send-comment-"]');
    if(send){ const id=idOf(send); const input=send.parentElement?.querySelector('input'); const body=input?.value?.trim(); if(id&&body&&!/^\d+$/.test(id)){api(`/posts/${id}/comments`,{method:'POST',body:JSON.stringify({body})}).then(()=>{input.value='';}).catch(()=>{});} return; }
    const share=t.closest('[data-testid^="button-share-post-"]');
    if(share){ const id=idOf(share); if(id&&!/^\d+$/.test(id)) api(`/posts/${id}/share`,{method:'POST'}).catch(()=>{}); }
  },true);
  document.addEventListener('keydown', e => { const t=e.target instanceof Element?e.target:null; if(!t||e.key!=='Enter'||!t.matches('input[data-testid^="input-comment-"]'))return; const id=idOf(t); const body=t.value.trim(); if(id&&body&&!/^\d+$/.test(id)){e.preventDefault();api(`/posts/${id}/comments`,{method:'POST',body:JSON.stringify({body})}).then(()=>{t.value='';}).catch(()=>{});} },true);
})();
