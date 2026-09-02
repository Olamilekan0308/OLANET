import { useEffect, useState } from 'react';
import { ArrowLeft, MessageCircle, Search, Send, Users, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type Person = { id: string; full_name?: string | null; username?: string | null; avatar_url?: string | null; bio?: string | null };
type Chat = { id: number; sender_id: string; body: string; created_at: string };

const api = (path: string, init?: RequestInit) => fetch(`/api${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } }).then(async r => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error || 'Request failed'); return d; });

export function DirectMessageHub() {
  const { user } = useAuth();
  const [open, setOpen] = useState(() => window.location.pathname === '/messages');
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Person | null>(null);
  const [conversation, setConversation] = useState<number | null>(null);
  const [messages, setMessages] = useState<Chat[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadPeople = async (q = '') => { try { setError(''); setPeople(await api(`/people${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not find users.'); } };
  const loadMessages = async (id: number) => { try { setMessages(await api(`/conversations/${id}/messages`)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load messages.'); } };

  useEffect(() => { if (!user) return; if (open) void loadPeople(query); }, [open, user]);
  useEffect(() => { if (!user || !open) return; const t = window.setTimeout(() => void loadPeople(query), 250); return () => window.clearTimeout(t); }, [query, open, user]);
  useEffect(() => { if (!open || !conversation) return; const t = window.setInterval(() => void loadMessages(conversation), 4000); return () => window.clearInterval(t); }, [open, conversation]);

  const startChat = async (person: Person) => {
    if (busy) return;
    setBusy(true); setError('');
    try { const c = await api('/conversations', { method: 'POST', body: JSON.stringify({ user_ids: [person.id] }) }); setSelected(person); setConversation(c.id); await loadMessages(c.id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open this chat.'); }
    finally { setBusy(false); }
  };

  const send = async () => {
    if (!text.trim() || !conversation || busy) return;
    setBusy(true); setError('');
    try { const m = await api(`/conversations/${conversation}/messages`, { method: 'POST', body: JSON.stringify({ body: text.trim() }) }); setMessages(v => [...v, Array.isArray(m) ? m[0] : m]); setText(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Message could not be sent.'); }
    finally { setBusy(false); }
  };

  if (!user) return null;
  const initials = (p?: Person | null) => (p?.full_name || p?.username || 'OL').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();

  return <>
    {!open && <button aria-label="Open OLANET Direct Messages" onClick={() => setOpen(true)} className="fixed bottom-24 right-4 z-[60] grid h-14 w-14 place-items-center rounded-full bg-[#1877f2] text-white shadow-xl hover:bg-[#166fe5]"><MessageCircle size={24} /></button>}
    {open && <div className="fixed inset-0 z-[70] bg-[#f0f2f5]">
      <div className="mx-auto flex h-full max-w-5xl flex-col bg-white shadow-2xl">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#dddfe2] px-4">
          <div className="flex items-center gap-3"><button onClick={() => { setSelected(null); setConversation(null); setMessages([]); }} className="grid h-10 w-10 place-items-center rounded-full bg-[#f0f2f5]"><ArrowLeft size={20} /></button><div><h1 className="text-lg font-bold text-[#1c1e21]">Direct Messages</h1><p className="text-xs text-[#65676b]">Private one-to-one conversations</p></div></div>
          <button onClick={() => setOpen(false)} aria-label="Close direct messages" className="grid h-10 w-10 place-items-center rounded-full bg-[#f0f2f5]"><X size={20} /></button>
        </header>
        {error && <div role="alert" className="border-b border-[#f2c4bc] bg-[#fff0ed] px-4 py-2 text-xs font-bold text-[#a24f42]">{error}</div>}
        <div className="flex min-h-0 flex-1">
          <aside className={`${selected ? 'hidden sm:flex' : 'flex'} w-full shrink-0 flex-col border-r border-[#dddfe2] sm:w-80`}>
            <div className="border-b border-[#dddfe2] p-3"><div className="flex items-center gap-2 rounded-full bg-[#f0f2f5] px-4"><Search size={17} className="text-[#65676b]"/><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void loadPeople(query); }} placeholder="Search any OLANET user" className="min-w-0 flex-1 bg-transparent py-3 outline-none"/><button onClick={() => void loadPeople(query)} aria-label="Search users" className="text-[#1877f2]"><Search size={16}/></button></div></div>
            <div className="flex-1 overflow-y-auto p-2">{people.map(p => <button key={p.id} onClick={() => void startChat(p)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[#f0f2f5]"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[#d8eaff] font-bold text-[#1877f2]">{p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover"/> : initials(p)}</div><div className="min-w-0"><p className="truncate font-bold text-[#1c1e21]">{p.full_name || p.username || 'OLANET user'}</p><p className="truncate text-xs text-[#65676b]">@{p.username || 'member'}{p.bio ? ` · ${p.bio}` : ''}</p></div></button>)}{!people.length && <div className="p-8 text-center text-sm text-[#65676b]"><Users className="mx-auto mb-2" size={22}/>{query ? 'No matching users found.' : 'No other users found yet.'}</div>}</div>
          </aside>
          <main className={`${selected ? 'flex' : 'hidden sm:flex'} min-w-0 flex-1 flex-col`}>
            {selected ? <><header className="flex items-center gap-3 border-b border-[#dddfe2] p-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[#d8eaff] font-bold text-[#1877f2]">{initials(selected)}</div><div><p className="font-bold text-[#1c1e21]">{selected.full_name || selected.username || 'OLANET user'}</p><p className="text-xs text-[#65676b]">Private chat. No AI.</p></div></header><div className="flex-1 space-y-2 overflow-y-auto bg-[#f0f2f5] p-4">{messages.map(m => <div key={m.id} className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${m.sender_id === user.id ? 'ml-auto bg-[#1877f2] text-white' : 'bg-white text-[#1c1e21]'}`}>{m.body}</div>)}{!messages.length && <div className="flex h-full items-center justify-center text-sm text-[#65676b]">Start the conversation.</div>}</div><div className="border-t border-[#dddfe2] bg-white p-3"><div className="flex gap-2"><input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void send(); }} placeholder="Write a message…" className="min-w-0 flex-1 rounded-full bg-[#f0f2f5] px-4 py-3 outline-none"/><button onClick={() => void send()} disabled={!text.trim() || busy} aria-label="Send message" className="grid h-11 w-11 place-items-center rounded-full bg-[#1877f2] text-white disabled:opacity-50"><Send size={18}/></button></div></div></> : <div className="hidden flex-1 flex-col items-center justify-center text-center sm:flex"><MessageCircle className="mb-3 text-[#1877f2]" size={42}/><h2 className="text-xl font-bold">Select a person</h2><p className="mt-1 max-w-sm text-sm text-[#65676b]">Search registered OLANET users and open a private one-to-one chat.</p></div>}
          </main>
        </div>
      </div>
    </div>}
  </>;
}
