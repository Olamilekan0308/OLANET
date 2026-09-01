import { useEffect, useState } from 'react';
import { Bot, Calculator, X, Delete } from 'lucide-react';
import { CircleAiPanel } from '@/components/circle-ai-panel';

const circleMap: Record<string, { id: number; name: string }> = {
  electrical: { id: 1, name: 'Electrical Engineering' }, civil: { id: 2, name: 'Civil Engineering' }, mechanical: { id: 3, name: 'Mechanical Engineering' }, 'computer-science': { id: 4, name: 'Computer Science' }, 'phone-repair': { id: 5, name: 'Phone Repair' }, fashion: { id: 6, name: 'Fashion' }, carpentry: { id: 7, name: 'Carpentry' }, agriculture: { id: 8, name: 'Agriculture' }, catering: { id: 9, name: 'Catering' },
};

export function CircleAiLauncher() {
  const [open, setOpen] = useState(false), [calculator, setCalculator] = useState(false), [expression, setExpression] = useState('');
  const [path, setPath] = useState(() => typeof window === 'undefined' ? '' : window.location.pathname);
  useEffect(() => { const refresh=()=>setPath(window.location.pathname); const timer=window.setInterval(refresh,300); window.addEventListener('popstate',refresh); return()=>{window.clearInterval(timer);window.removeEventListener('popstate',refresh)}; }, []);
  const match=path.match(/^\/circles\/([^/]+)/); const slug=match?decodeURIComponent(match[1]):''; const circle=circleMap[slug];
  useEffect(()=>{if(!circle){setOpen(false);setCalculator(false)}},[slug]);
  if(!circle)return null;
  const add=(v:string)=>setExpression(x=>x+v);
  const calculate=()=>{try{if(!/^[0-9+\-*/().%\s]+$/.test(expression))throw new Error(); const value=Function(`"use strict";return (${expression})`)(); if(!Number.isFinite(value))throw new Error(); setExpression(String(value));}catch{setExpression('Error')}};
  return <>
    <div className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-white p-1.5 shadow-lg ring-1 ring-[#e4e6eb]">
      <button data-testid="button-open-circle-ai" onClick={()=>setOpen(true)} aria-label={`Open ${circle.name} AI`} className="inline-flex items-center gap-2 rounded-full bg-[#1877f2] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#166fe5]"><Bot size={18}/> AI</button>
      <button data-testid="button-open-circle-calculator" onClick={()=>setCalculator(true)} aria-label={`Open calculator for ${circle.name}`} className="grid h-11 w-11 place-items-center rounded-full bg-[#f0f2f5] text-[#1c1e21] transition hover:bg-[#e4e6eb]"><Calculator size={19}/></button>
    </div>
    {open&&<div className="fixed inset-0 z-[55] overflow-y-auto bg-black/35 p-2 sm:p-6"><div className="mx-auto max-w-3xl pb-6"><div className="flex justify-end"><button data-testid="button-close-circle-ai" onClick={()=>setOpen(false)} className="mb-2 rounded-full bg-white p-2 text-[#1c1e21] shadow-lg"><X size={20}/></button></div><CircleAiPanel circleId={circle.id} circleName={circle.name}/></div></div>}
    {calculator&&<div className="fixed inset-0 z-[56] flex items-end justify-center bg-black/35 p-3 sm:items-center"><div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold text-[#65676b]">{circle.name}</p><h3 className="text-xl font-bold text-[#1c1e21]">Calculator</h3></div><button onClick={()=>setCalculator(false)} className="rounded-full p-2 hover:bg-[#f0f2f5]"><X size={20}/></button></div><div className="mb-3 flex items-center gap-2"><input readOnly value={expression} placeholder="0" className="min-w-0 flex-1 rounded-xl bg-[#f0f2f5] p-3 text-right text-xl font-bold outline-none"/><button onClick={()=>setExpression('')} className="rounded-xl bg-[#f0f2f5] p-3" aria-label="Clear calculator"><Delete size={18}/></button></div><div className="grid grid-cols-4 gap-2">{['7','8','9','/','4','5','6','*','1','2','3','-','0','.','%','+'].map(v=><button key={v} onClick={()=>add(v)} className="rounded-xl bg-[#f0f2f5] p-3 text-lg font-bold text-[#1c1e21] hover:bg-[#e4e6eb]">{v}</button>)}<button onClick={()=>setExpression(x=>x.slice(0,-1))} className="rounded-xl bg-[#f0f2f5] p-3 font-bold">⌫</button><button onClick={calculate} className="col-span-3 rounded-xl bg-[#1877f2] p-3 font-bold text-white">=</button></div></div></div>}
  </>;
}
