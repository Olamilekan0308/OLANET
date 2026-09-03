(() => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ago = (value) => { const d = new Date(value); const sec = Math.max(0, Math.floor((Date.now()-d.getTime())/1000)); if(sec<60)return `${sec}s ago`; const m=Math.floor(sec/60); if(m<60)return `${m}m ago`; const h=Math.floor(m/60); if(h<24)return `${h}h ago`; return `${Math.floor(h/24)}d ago`; };
  const initials = (name) => String(name || 'OL').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'OL';
  const load = async () => {
    if (location.pathname !== '/') return;
    try {
      const r = await fetch('/api/posts', { credentials:'include' });
      if (!r.ok) return;
      const posts = await r.json();
      if (!Array.isArray(posts) || !posts.length) return;
      const cards = document.querySelectorAll('article[data-testid^="card-post-"]');
      if (!cards.length) return;
      const holder = cards[0].parentElement;
      if (!holder) return;
      holder.innerHTML = posts.map(p => {
        const author=p.author||{}; const name=author.full_name||author.username||'OLANET member';
        return `<article data-testid="card-post-${esc(p.id)}" class="lift rounded-2xl border border-[#dfd2c0] bg-[#fffaf1] p-4 shadow-[0_6px_22px_rgba(28,64,69,.035)]">
          <div class="flex items-start gap-3"><div class="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#e8c17a] flex items-center justify-center text-xs font-bold text-[#1d4348]">${esc(initials(name))}${author.avatar_url?`<img src="${esc(author.avatar_url)}" alt="" class="absolute h-9 w-9 rounded-full object-cover" onerror="this.remove()">`:''}</div><div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-2"><div><p class="text-sm font-extrabold text-[#1d4348]">${esc(name)}</p><p class="text-xs text-[#789093]">${esc(author.username?'@'+author.username:'OLANET member')} · ${esc(ago(p.created_at))}</p></div><button data-testid="button-post-menu-${esc(p.id)}" class="rounded-full p-1 text-[#789093]"><span>•••</span></button></div></div></div>
          <p class="mt-4 text-[15px] leading-7 text-[#365b60]">${esc(p.content||'')}</p>
          ${p.media_url ? (p.media_type==='video'?`<video controls class="mt-4 w-full rounded-xl" src="${esc(p.media_url)}"></video>`:`<img class="mt-4 max-h-[520px] w-full rounded-xl object-cover" src="${esc(p.media_url)}" alt="Post media" loading="lazy">`) : ''}
          <div class="mt-3 flex items-center justify-between border-b border-[#eadfce] pb-3 text-xs text-[#789093]"><span>${p.likes||0} people found this useful</span><span>${p.comments||0} comments</span></div>
          <div class="flex items-center gap-1 pt-2"><button data-testid="button-like-post-${esc(p.id)}" class="press flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold text-[#527075]">♥ Useful</button><button data-testid="button-comment-post-${esc(p.id)}" class="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold text-[#527075]">💬 Discuss</button><button data-testid="button-share-post-${esc(p.id)}" class="rounded-lg p-2 text-[#527075]">↗</button></div>
          <div class="mt-3 flex gap-2"><input data-testid="input-comment-${esc(p.id)}" placeholder="Add something useful…" class="min-w-0 flex-1 rounded-xl border border-[#dfd2c0] bg-[#f8f2e8] px-3 py-2 text-sm outline-none"><button data-testid="button-send-comment-${esc(p.id)}" class="rounded-xl bg-[#2f817d] p-2 text-white">➤</button></div>
        </article>`;
      }).join('');
      window.dispatchEvent(new Event('olanet:feed-ready'));
    } catch {}
  };
  const boot = () => setTimeout(load, 500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('popstate', boot);
})();
