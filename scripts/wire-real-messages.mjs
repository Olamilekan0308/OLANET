import fs from 'node:fs';

const path = 'skillhub/src/App.tsx';
const source = fs.readFileSync(path, 'utf8');
const start = source.indexOf('function MessagesPage() {');
if (start < 0) throw new Error('MessagesPage function not found');
const end = source.indexOf('\nfunction ', start + 'function MessagesPage() {'.length);
if (end < 0) throw new Error('Next top-level function after MessagesPage not found');

const replacement = String.raw`function MessagesPage() {
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadConversations = async () => {
    try {
      setError('');
      const response = await fetch('/api/messages/conversations', { credentials: 'include' });
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data?.error || 'Unable to load conversations');
      setConversations(Array.isArray(data) ? data : []);
      setSelected((current) => Math.min(current, Math.max(0, (Array.isArray(data) ? data.length : 1) - 1)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const response = await fetch('/api/messages/conversations/' + encodeURIComponent(conversationId), { credentials: 'include' });
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data?.error || 'Unable to load messages');
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load messages');
      setMessages([]);
    }
  };

  useEffect(() => { void loadConversations(); }, []);
  useEffect(() => {
    const conversationId = conversations[selected]?.conversation_id;
    if (!conversationId) { setMessages([]); return; }
    void loadMessages(conversationId);
    const timer = window.setInterval(() => void loadMessages(conversationId), 5000);
    return () => window.clearInterval(timer);
  }, [selected, conversations]);

  const send = async () => {
    const text = message.trim();
    const conversationId = conversations[selected]?.conversation_id;
    if (!text || !conversationId || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/messages/conversations/' + encodeURIComponent(conversationId) + '/messages', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Unable to send message');
      setMessage('');
      setMessages((current) => [...current, data]);
      void loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message');
    } finally {
      setSending(false);
    }
  };

  const startConversation = async () => {
    const userId = window.prompt('Enter the OLANET user ID to message');
    if (!userId?.trim()) return;
    try {
      const response = await fetch('/api/messages/conversations', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Unable to start conversation');
      await loadConversations();
      const index = conversations.findIndex((item) => item.conversation_id === data?.conversation_id);
      if (index >= 0) setSelected(index);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start conversation');
    }
  };

  const active = conversations[selected];
  const activeProfile = active?.other_user;
  const displayName = activeProfile?.full_name || activeProfile?.username || 'Conversation';
  const initials = displayName.split(/\\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase() || 'DM';

  return <div className="page-enter mx-auto max-w-5xl">
    <div className="mb-6"><p className="mono mb-2 text-[10px] uppercase tracking-[.2em] text-[#2f817d]">Keep the loop open</p><h2 className="display text-4xl font-bold">Messages</h2></div>
    {error && <div className="mb-4 rounded-xl border border-[#e8b4a8] bg-[#f9e6e1] px-4 py-3 text-sm font-bold text-[#9b4337]">{error}</div>}
    <div className="grid overflow-hidden rounded-[24px] border border-[#dfd2c0] bg-[#fffaf1] lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="border-b border-[#eadfce] p-3 lg:border-b-0 lg:border-r">
        <div className="mb-3 flex items-center justify-between px-2"><p className="text-sm font-extrabold">Conversations</p><button data-testid="button-new-message" onClick={startConversation} className="rounded-lg p-2 text-[#2f817d] hover:bg-[#e5f0e9]"><Plus size={17} /></button></div>
        <div className="space-y-1">
          {loading && <p className="px-3 py-6 text-xs text-[#789093]">Loading conversations…</p>}
          {!loading && !conversations.length && <p className="px-3 py-6 text-xs leading-5 text-[#789093]">No conversations yet. Use + to start a direct message.</p>}
          {conversations.map((conversation, i) => { const profile = conversation.other_user || {}; const name = profile.full_name || profile.username || 'OLANET member'; const initials = name.split(/\\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase(); return <button data-testid={`button-chat-${conversation.conversation_id}`} key={conversation.conversation_id} onClick={() => setSelected(i)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ${selected === i ? 'bg-[#e5f0e9]' : 'hover:bg-[#f6eddf]'}`}><Avatar initials={initials || 'DM'} src={profile.avatar_url} size="sm" /><div className="min-w-0 flex-1"><p className="text-xs font-bold">{name}</p><p className="truncate text-[11px] text-[#789093]">{conversation.last_message?.body || 'No messages yet'}</p></div></button>; })}
        </div>
      </div>
      <div className="flex min-h-[530px] flex-col">
        <div className="flex items-center justify-between border-b border-[#eadfce] p-4"><div className="flex items-center gap-3"><Avatar initials={active ? initials : 'DM'} src={activeProfile?.avatar_url} size="sm" /><div><p className="text-sm font-bold">{active ? displayName : 'Direct messages'}</p><p className="text-[11px] text-[#2f817d]">{active ? 'Connected through OLANET' : 'Select a conversation'}</p></div></div><div className="flex gap-1"><button data-testid="button-call-audio" className="rounded-xl p-2.5 text-[#527075] hover:bg-[#e5f0e9]"><Phone size={17} /></button><button data-testid="button-call-video" className="rounded-xl p-2.5 text-[#527075] hover:bg-[#e5f0e9]"><Video size={17} /></button></div></div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {!active && <div className="flex h-full min-h-[350px] items-center justify-center text-center text-sm text-[#789093]">Your real conversations will appear here.</div>}
          {messages.map((item) => <div key={item.id} className={`flex gap-2 ${item.sender_id === activeProfile?.id ? '' : 'justify-end'}`}><div className={`max-w-[75%] rounded-2xl p-3 text-sm leading-6 ${item.sender_id === activeProfile?.id ? 'rounded-tl-sm bg-[#f1e4cc] text-[#365b60]' : 'rounded-tr-sm bg-[#2f817d] text-white'}`}>{item.body}<p className="mt-1 text-[10px] opacity-60">{item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p></div></div>)}
        </div>
        <div className="border-t border-[#eadfce] p-3"><div className="flex items-center gap-2 rounded-xl bg-[#f6eddf] p-1"><button data-testid="button-attach-message" className="rounded-lg p-2 text-[#789093]"><Paperclip size={17} /></button><input data-testid="input-message" value={message} disabled={!active || sending} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} placeholder={active ? 'Write a message…' : 'Select a conversation…'} className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" /><button data-testid="button-send-message" disabled={!active || sending || !message.trim()} onClick={() => void send()} className="rounded-lg bg-[#2f817d] p-2.5 text-white disabled:opacity-50"><Send size={16} /></button></div></div>
      </div>
    </div>
  </div>;
}`;

fs.writeFileSync(path, source.slice(0, start) + replacement + source.slice(end), 'utf8');
console.log('Replaced demo MessagesPage with API-backed implementation.');
