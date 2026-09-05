(() => {
  const toast = (message) => {
    let el = document.getElementById('olanet-feed-toast');
    if (!el) { el = document.createElement('div'); el.id = 'olanet-feed-toast'; Object.assign(el.style, { position: 'fixed', left: '50%', bottom: '88px', zIndex: '100001', background: '#1d4348', color: '#fffaf1', padding: '10px 14px', borderRadius: '12px', font: '700 13px system-ui,sans-serif', boxShadow: '0 10px 30px rgba(0,0,0,.2)' }); document.body.appendChild(el); }
    el.textContent = message; el.style.opacity = '1'; clearTimeout(el._timer); el._timer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
  };
  const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const cards = () => [...document.querySelectorAll('[data-testid^="card-post-"]')].filter(x => !x.closest('[data-testid^="card-post-301"]'));
  const applyPost = (card, post) => {
    card.setAttribute('data-testid', `card-post-${post.id}`);
    const author = card.querySelector('[data-testid^="text-post-author-"]');
    if (author) { author.setAttribute('data-testid', `text-post-author-${post.id}`); author.textContent = post.author?.full_name || post.author?.username || 'OLANET member'; }
    const paragraphs = [...card.querySelectorAll('p')];
    const body = paragraphs.find(p => p.className.includes('text-[15px]')) || paragraphs.find(p => p !== author);
    if (body && post.content) body.textContent = post.content;
    const existingMedia = card.querySelector('[data-olanet-post-media]');
    if (post.media_url) {
      const media = existingMedia || document.createElement('img');
      media.setAttribute('data-olanet-post-media', '1'); media.src = post.media_url; media.alt = 'Post image'; media.style.cssText = 'display:block;width:100%;max-height:420px;object-fit:cover;border-radius:14px;margin-top:12px';
      if (!existingMedia) (body?.parentElement || card).appendChild(media);
    } else if (existingMedia) existingMedia.remove();
    const stats = card.querySelectorAll('.border-b');
    const stat = stats[0];
    if (stat) { const spans = stat.querySelectorAll('span'); if (spans[0]) spans[0].textContent = `${post.likes ?? 0} people found this useful`; if (spans[1]) spans[1].textContent = `${post.comments ?? 0} comments`; }
    const like = card.querySelector('[data-testid^="button-like-post-"]');
    if (like) { like.setAttribute('data-testid', `button-like-post-${post.id}`); like.dataset.liveLiked = post.liked ? '1' : '0'; like.classList.toggle('bg-[#f8dfd8]', !!post.liked); like.classList.toggle('text-[#b45243]', !!post.liked); }
    const comment = card.querySelector('[data-testid^="button-comment-post-"]'); if (comment) comment.setAttribute('data-testid', `button-comment-post-${post.id}`);
    const share = card.querySelector('[data-testid^="button-share-post-"]'); if (share) share.setAttribute('data-testid', `button-share-post-${post.id}`);
  };
  const load = async () => {
    try {
      const response = await fetch('/api/feed?limit=30', { credentials: 'include' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.posts)) return;
      const list = cards(); payload.posts.slice(0, list.length).forEach((post, i) => applyPost(list[i], post));
    } catch (_) {}
  };
  const observe = new MutationObserver(() => { if (document.querySelector('[data-testid^="card-post-"]')) { void load(); observe.disconnect(); } });
  observe.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => void load(), 500);

  document.addEventListener('change', (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (!input || input.type !== 'file' || !input.files?.[0]) return;
    const file = input.files[0];
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) { toast('Choose a JPG, PNG or WebP image.'); input.value = ''; return; }
    if (file.size > 1600000) { toast('Image is too large. Please choose one under 1.6 MB.'); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      const modal = input.closest('.sheet-card'); if (!modal || typeof reader.result !== 'string') return;
      modal.dataset.olanetImage = reader.result;
      let preview = modal.querySelector('[data-olanet-image-preview]');
      if (!preview) { preview = document.createElement('img'); preview.setAttribute('data-olanet-image-preview','1'); preview.style.cssText='display:block;width:100%;max-height:220px;object-fit:cover;border-radius:14px;margin-top:10px'; input.parentElement?.after(preview); }
      preview.src = reader.result;
    };
    reader.readAsDataURL(file);
  }, true);

  document.addEventListener('click', async (event) => {
    const target = event.target instanceof Element ? event.target : null; if (!target) return;
    const like = target.closest('[data-testid^="button-like-post-"]');
    if (like) {
      const match = like.getAttribute('data-testid')?.match(/button-like-post-(.+)$/); const postId = match?.[1];
      if (!postId || like.dataset.liveBusy === '1') return;
      event.preventDefault(); event.stopImmediatePropagation(); like.dataset.liveBusy = '1';
      try {
        const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/like`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
        const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error || 'Unable to update reaction');
        const card = like.closest('[data-testid^="card-post-"]'); const stat = card?.querySelector('.border-b'); const spans = stat?.querySelectorAll('span');
        if (spans?.[0] && Number.isFinite(Number(data.likes))) spans[0].textContent = `${data.likes} people found this useful`;
        like.dataset.liveLiked = data.liked ? '1' : '0'; like.classList.toggle('bg-[#f8dfd8]', !!data.liked); like.classList.toggle('text-[#b45243]', !!data.liked);
        const icon = like.querySelector('svg'); if (icon) icon.setAttribute('fill', data.liked ? 'currentColor' : 'none');
      } catch (error) { toast(error instanceof Error ? error.message : 'Unable to update reaction'); }
      finally { like.dataset.liveBusy = '0'; }
      return;
    }

    const publish = target.closest('[data-testid="button-publish-note"]');
    if (publish) {
      const modal = publish.closest('.sheet-card'); const textarea = modal?.querySelector('[data-testid="textarea-create-post"]'); const content = textarea?.value?.trim(); const media_url = modal?.dataset.olanetImage || '';
      if ((!content && !media_url) || publish.dataset.liveBusy === '1') return;
      event.preventDefault(); event.stopImmediatePropagation(); publish.dataset.liveBusy = '1'; publish.disabled = true;
      try {
        const response = await fetch('/api/feed', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, media_url }) });
        const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error || 'Unable to publish post');
        toast('Post published'); window.location.reload();
      } catch (error) { publish.disabled = false; publish.dataset.liveBusy = '0'; toast(error instanceof Error ? error.message : 'Unable to publish post'); }
    }
  }, true);
})();
