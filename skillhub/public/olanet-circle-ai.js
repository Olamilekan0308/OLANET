(() => {
  const CIRCLES = {
    electrical: { id: 1, name: 'Electrical Engineering' },
    civil: { id: 2, name: 'Civil Engineering' },
    mechanical: { id: 3, name: 'Mechanical Engineering' },
    'computer-science': { id: 4, name: 'Computer Science' },
    'phone-repair': { id: 5, name: 'Phone Repair' },
    fashion: { id: 6, name: 'Fashion' },
    carpentry: { id: 7, name: 'Carpentry' },
    agriculture: { id: 8, name: 'Agriculture' },
    catering: { id: 9, name: 'Catering' }
  };
  const slug = () => { const m = location.pathname.match(/^\/circles\/([^/]+)/); return m ? decodeURIComponent(m[1]) : null; };
  const mount = () => {
    const key = slug(), circle = key && CIRCLES[key];
    if (!circle || document.getElementById('olanet-circle-ai')) return;
    const root = document.createElement('div'); root.id = 'olanet-circle-ai';
    root.innerHTML = `<style>
      #olanet-circle-ai{position:fixed;top:78px;right:14px;z-index:99999;font-family:system-ui,-apple-system,sans-serif}
      #oca-actions{display:flex;gap:8px;padding:7px;border:1px solid #e1e4e7;border-radius:18px;background:#fff;box-shadow:0 7px 25px #0002}
      #olanet-circle-ai button,#olanet-circle-ai a{cursor:pointer}
      .oca-action{display:inline-flex;align-items:center;gap:7px;border:0;border-radius:13px;background:#f1f3f5;color:#182126;padding:10px 13px;font-size:13px;font-weight:800;text-decoration:none}
      .oca-action.ai{background:#1877f2;color:#fff}.oca-action:hover{filter:brightness(.97)}
      #oca-panel{display:none;width:min(390px,calc(100vw - 28px));height:min(600px,calc(100vh - 150px));margin-top:10px;border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 20px 60px #0003;border:1px solid #ddd}
      #oca-head{display:flex;justify-content:space-between;align-items:center;padding:15px;background:#fff;color:#111;font-weight:800;border-bottom:1px solid #eee}
      #oca-head button{border:0;background:#f1f1f1;color:#111;border-radius:999px;width:32px;height:32px}
      #oca-msg{height:calc(100% - 124px);overflow:auto;padding:14px;background:#fafafa}.m{max-width:86%;padding:10px 12px;margin-bottom:10px;border-radius:14px;white-space:pre-wrap;font-size:14px;line-height:1.5}.u{margin-left:auto;background:#1877f2;color:#fff}.b{background:#f0f0f0;color:#222}
      #oca-form{display:flex;gap:8px;padding:10px;border-top:1px solid #eee}#oca-in{flex:1;min-width:0;border:1px solid #ccc;border-radius:18px;padding:10px;resize:none}#oca-send{border:0;border-radius:18px;background:#1877f2;color:#fff;padding:0 14px;font-weight:800}
      @media(max-width:640px){#olanet-circle-ai{top:74px;left:10px;right:10px}#oca-actions{justify-content:center}.oca-action{flex:1;justify-content:center}.oca-action span{display:none}}
    </style>
    <div id="oca-actions"><button class="oca-action ai" id="oca-launch">🤖 <span>AI Assistant</span></button><a class="oca-action" href="/department-calculator.html?department=${encodeURIComponent(key)}">🧮 <span>Calculator</span></a></div>
    <div id="oca-panel"><div id="oca-head"><span>🤖 OLANET AI · ${circle.name}</span><button id="oca-close">×</button></div><div id="oca-msg"><div class="m b">I’m the OLANET AI for ${circle.name}. Ask a question about this department.</div></div><form id="oca-form"><textarea id="oca-in" rows="1" placeholder="Ask about ${circle.name}…"></textarea><button id="oca-send">Send</button></form></div>`;
    document.body.appendChild(root);
    const panel=root.querySelector('#oca-panel'), launch=root.querySelector('#oca-launch'), close=root.querySelector('#oca-close'), msg=root.querySelector('#oca-msg'), form=root.querySelector('#oca-form'), input=root.querySelector('#oca-in');
    let sessionId=null; const history=[];
    const add=(text,user=false)=>{const e=document.createElement('div');e.className=`m ${user?'u':'b'}`;e.textContent=text;msg.appendChild(e);msg.scrollTop=msg.scrollHeight;return e};
    launch.onclick=()=>{panel.style.display='block';launch.style.display='none';input.focus()};
    close.onclick=()=>{panel.style.display='none';launch.style.display='inline-flex'};
    form.onsubmit=async e=>{e.preventDefault();const text=input.value.trim();if(!text)return;input.value='';add(text,true);history.push({role:'user',content:text});const p=add('Thinking…');try{const r=await fetch('/api/ai/circle',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({circleId:circle.id,message:text,sessionId,history:history.slice(-12)})});const d=await r.json().catch(()=>({}));p.remove();if(!r.ok)throw new Error(d.error||'OLANET AI could not answer right now.');sessionId=d.sessionId||sessionId;const answer=d.response||'No response received.';add(answer);history.push({role:'assistant',content:answer});if(history.length>24)history.splice(0,history.length-24);}catch(err){history.pop();p.textContent=err instanceof Error?err.message:'OLANET AI is unavailable.'}};
  };
  new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true}); mount();
})();