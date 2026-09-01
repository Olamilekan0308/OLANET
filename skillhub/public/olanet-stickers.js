(() => {
  const packs = [
    ['😀','😂','😍','😭','😎','🥳','😅','🤔','😮','😴','🙏','❤️'],
    ['👍','👏','🔥','💯','🎉','💪','🙌','👀','✅','⭐','🚀','💡'],
    ['🤣','😢','😡','🤗','😇','🤩','😱','🤝','❤️‍🔥','✨','🫡','🥹']
  ];
  const css = `#olanet-sticker-pop{position:absolute;bottom:56px;left:0;width:min(330px,calc(100vw - 34px));background:#fff;border:1px solid #e1e4e7;border-radius:18px;box-shadow:0 14px 40px #0003;padding:10px;z-index:100002}#olanet-sticker-pop .sp-tabs{display:flex;gap:5px;margin-bottom:8px}#olanet-sticker-pop .sp-tab{border:0;background:#f1f3f5;border-radius:10px;padding:7px 10px;cursor:pointer;font-size:16px}.sp-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:4px}.sp-emoji{border:0;background:transparent;border-radius:10px;font-size:25px;padding:7px;cursor:pointer}.sp-emoji:hover{background:#f1f3f5}.olanet-sticker-anchor{position:relative;display:inline-flex}.olanet-sticker-btn{border:1px solid #dfd2c0;background:#fff;border-radius:12px;padding:8px 10px;cursor:pointer;font-size:18px}.olanet-sticker-btn:hover{background:#f1e4cc}`;
  function mount(){
    if(document.getElementById('olanet-sticker-style')) return;
    const style=document.createElement('style');style.id='olanet-sticker-style';style.textContent=css;document.head.appendChild(style);
  }
  function findComposer(){
    const inputs=[...document.querySelectorAll('input,textarea')];
    return inputs.find(el=>{const p=(el.getAttribute('placeholder')||'').toLowerCase();return p.includes('write a message')||p.includes('message…')||p.includes('message...')});
  }
  function mountPicker(){
    const input=findComposer(); if(!input||document.getElementById('olanet-sticker-anchor')) return;
    const row=input.parentElement; if(!row) return;
    const anchor=document.createElement('div');anchor.id='olanet-sticker-anchor';anchor.className='olanet-sticker-anchor';
    const btn=document.createElement('button');btn.type='button';btn.className='olanet-sticker-btn';btn.title='Stickers';btn.setAttribute('aria-label','Open stickers');btn.textContent='😊';
    const pop=document.createElement('div');pop.id='olanet-sticker-pop';pop.style.display='none';
    const tabs=document.createElement('div');tabs.className='sp-tabs';packs.forEach((pack,i)=>{const t=document.createElement('button');t.type='button';t.className='sp-tab';t.textContent=pack[i]||'😊';t.onclick=()=>render(i);tabs.appendChild(t)});
    const grid=document.createElement('div');grid.className='sp-grid';pop.append(tabs,grid);anchor.append(btn,pop);row.insertBefore(anchor,input);
    function render(i){grid.innerHTML='';packs[i].forEach(emoji=>{const b=document.createElement('button');b.type='button';b.className='sp-emoji';b.textContent=emoji;b.title='Send sticker';b.onclick=()=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set||Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set;if(setter)setter.call(input,emoji);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.focus();pop.style.display='none';const send=[...row.querySelectorAll('button')].find(x=>x!==btn&&((x.getAttribute('aria-label')||'').toLowerCase().includes('send')||x.textContent.trim()===''));if(send)send.click();};grid.appendChild(b)})}
    render(0);btn.onclick=e=>{e.stopPropagation();pop.style.display=pop.style.display==='none'?'block':'none'};
    document.addEventListener('click',e=>{if(!anchor.contains(e.target))pop.style.display='none'},{capture:true});
  }
  mount();new MutationObserver(mountPicker).observe(document.documentElement,{childList:true,subtree:true});mountPicker();
})();