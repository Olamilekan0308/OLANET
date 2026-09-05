import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Calculator, Check, ChevronRight, Users, Zap } from 'lucide-react';

type Circle = { id: number; name: string; description?: string | null; memberCount: number; isMember: boolean };
type CalculatorItem = { id: string; name: string; description: string };
type Member = { id: string; full_name?: string | null; username?: string | null; avatar_url?: string | null; role?: string };

const colors = ['#e8c17a','#d5a46c','#a5b5d5','#8eb6a5','#e5a49a','#d8b8c9','#c99e7b','#b4c78f','#edc08f'];

export default function DepartmentHub() {
  const path = window.location.pathname;
  const detailId = path.match(/^\/circles\/(\d+)$/)?.[1];
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selected, setSelected] = useState<Circle | null>(null);
  const [calculators, setCalculators] = useState<CalculatorItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { void loadCircles(); }, []);
  useEffect(() => { if (detailId) void loadDetail(Number(detailId)); }, [detailId]);

  async function loadCircles() {
    try { setLoading(true); const r = await fetch('/api/circles', { credentials: 'include' }); const d = await r.json(); if (!r.ok) throw new Error(d?.error || 'Unable to load departments'); setCircles(d.circles ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load departments'); }
    finally { setLoading(false); }
  }
  async function loadDetail(id: number) {
    try { setError(''); const [detailR, calcR, membersR] = await Promise.all([fetch(`/api/circles/${id}`, { credentials:'include' }), fetch(`/api/circles/${id}/calculators`, { credentials:'include' }), fetch(`/api/circles/${id}/members`, { credentials:'include' })]); const detail = await detailR.json(); const calc = await calcR.json(); const mem = await membersR.json(); if (!detailR.ok) throw new Error(detail?.error || 'Department not found'); setSelected(detail); setCalculators(calc.calculators ?? []); setMembers(mem.members ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load department'); }
  }
  async function toggleJoin(circle: Circle) {
    const r = await fetch(`/api/circles/${circle.id}/join`, { method: circle.isMember ? 'DELETE' : 'POST', credentials:'include' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d?.error || 'Unable to update membership'); return; }
    const joined = !circle.isMember; setSelected((s) => s ? {...s, isMember: joined, memberCount: Math.max(0, s.memberCount + (joined ? 1 : -1))} : s); setCircles((xs) => xs.map(x => x.id === circle.id ? {...x, isMember: joined, memberCount: Math.max(0, x.memberCount + (joined ? 1 : -1))} : x));
  }
  const filtered = useMemo(() => circles.filter(c => c.name.toLowerCase().includes(query.toLowerCase())), [circles, query]);

  if (detailId) return <div className="min-h-[100dvh] bg-[#f8f2e8] p-4 text-[#1d4348] sm:p-8"><div className="mx-auto max-w-5xl"><a href="/circles" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[#527075]"><ArrowLeft size={16}/> All departments</a>{error && <Notice text={error}/>} {!selected ? <Loading/> : <><div className="overflow-hidden rounded-[24px] border border-[#dfd2c0] bg-[#fffaf1]"><div className="p-7" style={{background:`linear-gradient(135deg, ${colors[selected.id % colors.length]}, #fffaf1)`}}><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fffaf1]/80"><Zap size={27}/></div><h1 className="mt-5 text-3xl font-bold">{selected.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#527075]">{selected.description || 'A practical OLANET department for learning, collaboration and real-world work.'}</p></div><div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-5"><Stat icon={Users} value={selected.memberCount.toLocaleString()} label="members"/><Stat icon={Calculator} value={String(calculators.length)} label="calculators"/></div><button onClick={() => void toggleJoin(selected)} className="rounded-xl bg-[#2f817d] px-5 py-3 text-sm font-bold text-white">{selected.isMember ? 'Joined' : 'Join department'}</button></div></div><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]"><section className="rounded-2xl border border-[#dfd2c0] bg-[#fffaf1] p-5"><h2 className="text-xl font-bold">Department calculators</h2><p className="mt-1 text-sm text-[#789093]">Tools specific to {selected.name}. No giant junk drawer of unrelated calculators.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{calculators.map(c => <div key={c.id} className="rounded-xl border border-[#eadfce] bg-[#f8f2e8] p-4"><div className="flex items-start gap-3"><div className="rounded-xl bg-[#e5f0e9] p-2 text-[#2f817d]"><Calculator size={17}/></div><div><h3 className="font-bold">{c.name}</h3><p className="mt-1 text-xs leading-5 text-[#789093]">{c.description}</p></div></div></div>)}</div></section><aside className="rounded-2xl border border-[#dfd2c0] bg-[#fffaf1] p-5"><h2 className="text-xl font-bold">Members</h2><div className="mt-4 space-y-3">{members.slice(0,12).map(m => <div key={m.id} className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#dceceb] text-xs font-bold text-[#2f817d]">{m.avatar_url ? <img src={m.avatar_url} alt="" className="h-full w-full object-cover"/> : (m.full_name || m.username || '?').slice(0,2).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-bold">{m.full_name || m.username || 'OLANET member'}</p><p className="text-[10px] text-[#789093]">{m.role || 'member'}</p></div></div>)}{!members.length && <p className="text-sm text-[#789093]">No members to display yet.</p>}</div></aside></div></>}</div></div>;

  return <div className="min-h-[100dvh] bg-[#f8f2e8] p-4 text-[#1d4348] sm:p-8"><div className="mx-auto max-w-6xl"><div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><a href="/" className="text-xs font-bold text-[#527075]">OLANET</a><p className="mt-4 text-[10px] font-bold uppercase tracking-[.2em] text-[#2f817d]">Find your people</p><h1 className="mt-2 text-4xl font-bold">Departments & Circles</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#70878a]">Join a department, meet people in your field and use calculators built for that discipline.</p></div><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search departments" className="rounded-xl border border-[#dfd2c0] bg-[#fffaf1] px-4 py-3 text-sm outline-none focus:border-[#2f817d] sm:w-64"/></div>{error && <Notice text={error}/>} {loading ? <Loading/> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((c,i)=><a href={`/circles/${c.id}`} key={c.id} className="rounded-2xl border border-[#dfd2c0] bg-[#fffaf1] p-5 shadow-sm transition hover:-translate-y-0.5"><div className="flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{backgroundColor:colors[i%colors.length]}}><Zap size={23}/></div><ChevronRight size={18} className="text-[#9ab0ad]"/></div><h2 className="mt-5 text-xl font-bold">{c.name}</h2><p className="mt-2 text-sm leading-6 text-[#70878a]">{c.description || 'Learn, collaborate and build practical skills with this department.'}</p><div className="mt-5 flex items-center justify-between border-t border-[#eadfce] pt-4 text-xs font-bold text-[#789093]"><span>{c.memberCount.toLocaleString()} members</span><span className="flex items-center gap-1 text-[#2f817d]">{c.isMember ? <><Check size={14}/> Joined</> : 'Join'} <ArrowRight size={14}/></span></div></a>)}</div>}{!loading && !filtered.length && <div className="rounded-2xl border border-dashed border-[#cbbda9] bg-[#fffaf1] p-12 text-center text-sm text-[#789093]">No department matches that search.</div>}</div></div>;
}
function Loading(){return <div className="rounded-2xl border border-[#dfd2c0] bg-[#fffaf1] p-12 text-center text-sm text-[#789093]">Loading departments…</div>}
function Notice({text}:{text:string}){return <div className="mb-4 rounded-xl border border-[#e8b4a8] bg-[#f9e6e1] px-4 py-3 text-sm font-bold text-[#9b4337]">{text}</div>}
function Stat({icon:Icon,value,label}:{icon:typeof Users;value:string;label:string}){return <div className="flex items-center gap-2"><Icon size={16} className="text-[#2f817d]"/><div><p className="font-bold">{value}</p><p className="text-[10px] text-[#789093]">{label}</p></div></div>}
