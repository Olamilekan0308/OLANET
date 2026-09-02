import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MessageCircle, Search, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type Person = { id: string; full_name?: string | null; username?: string | null; avatar_url?: string | null; bio?: string | null };

export function PeopleDiscovery() {
  const { status } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const visible = useMemo(() => {
    const seen = new Set<string>();
    return people.filter((person) => {
      const key = `${person.id}|${person.username ?? ''}|${person.full_name ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [people]);

  async function loadPeople(search = '') {
    if (status !== 'authenticated') return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/people${search ? `?q=${encodeURIComponent(search)}` : ''}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data?.error || `Could not load people (${response.status})`);
      setPeople(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load people.');
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === 'authenticated') loadPeople();
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const timer = window.setTimeout(() => loadPeople(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query, status]);

  async function addFriend(id: string) {
    setBusy(id);
    setError('');
    try {
      const response = await fetch('/api/friends/request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressee_id: id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Could not send friend request.');
      setPeople((current) => current.filter((person) => person.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send friend request.');
    } finally {
      setBusy(null);
    }
  }

  async function message(id: string) {
    setBusy(id);
    setError('');
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: [id] }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Could not open private chat.');
      window.location.assign(`/messages?conversation=${encodeURIComponent(data.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open private chat.');
      setBusy(null);
    }
  }

  if (status === 'loading') {
    return <main className="min-h-screen bg-[#f0f2f5] p-6"><div className="mx-auto max-w-5xl rounded-2xl bg-[#fffaf1] p-10 text-center text-[#527075]">Loading OLANET…</div></main>;
  }

  if (status !== 'authenticated') {
    return <main className="min-h-screen bg-[#f0f2f5] p-6"><div className="mx-auto max-w-lg rounded-2xl bg-[#fffaf1] p-10 text-center"><h1 className="display text-2xl font-bold text-[#1d4348]">Log in to discover people</h1><p className="mt-2 text-sm text-[#70878a]">Your OLANET session is not active on this browser.</p><button className="mt-5 rounded-xl bg-[#2f817d] px-5 py-3 font-bold text-white" onClick={() => window.location.assign('/login')}>Log in</button></div></main>;
  }

  return <main className="min-h-screen bg-[#f0f2f5] text-[#1d4348]">
    <header className="sticky top-0 z-20 border-b border-[#ddd] bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <button aria-label="Back to OLANET home" onClick={() => window.location.assign('/?from=people')} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef1f1] text-[#1d4348]"><ArrowLeft size={20} /></button>
        <div className="text-xl font-black text-[#2f817d]">OLANET</div>
        <div className="relative ml-2 max-w-xl flex-1">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#70878a]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people by name or username" className="w-full rounded-full bg-[#f0f2f5] py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#2f817d]/30" />
        </div>
      </div>
    </header>

    <section className="mx-auto max-w-6xl px-4 py-7">
      <h1 className="display text-3xl font-black">People you may know</h1>
      <p className="mt-1 text-sm text-[#70878a]">Find students, professionals and builders on OLANET.</p>
      {error && <div className="mt-4 rounded-xl bg-[#fff0ed] p-3 text-sm font-semibold text-[#b42318]">{error}</div>}
      {loading ? <div className="mt-6 rounded-2xl bg-[#fffaf1] p-12 text-center text-[#70878a]">Finding people…</div> : visible.length === 0 ? <div className="mt-6 rounded-2xl bg-[#fffaf1] p-12 text-center text-[#70878a]">No other OLANET users found.</div> : <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((person) => <article key={person.id} className="rounded-2xl border border-[#dfd2c0] bg-[#fffaf1] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          {person.avatar_url ? <img src={person.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-full bg-[#dceceb] text-lg font-black text-[#1d4348]">{(person.full_name || person.username || 'OL').split(/\\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div>}
          <div className="min-w-0"><h2 className="truncate font-extrabold">{person.full_name || person.username || 'OLANET user'}</h2><p className="truncate text-sm text-[#70878a]">@{person.username || 'member'}</p></div>
        </div>
        <p className="mt-3 min-h-10 text-sm text-[#527075]">{person.bio || 'OLANET member'}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button disabled={busy === person.id} onClick={() => addFriend(person.id)} className="flex items-center justify-center gap-2 rounded-xl bg-[#2f817d] px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"><UserPlus size={16} />{busy === person.id ? 'Working…' : 'Add Friend'}</button>
          <button disabled={busy === person.id} onClick={() => message(person.id)} className="flex items-center justify-center gap-2 rounded-xl bg-[#e7f3ff] px-3 py-2.5 text-sm font-bold text-[#216763] disabled:opacity-50"><MessageCircle size={16} />Message</button>
        </div>
      </article>)}</div>}
    </section>
  </main>;
}
