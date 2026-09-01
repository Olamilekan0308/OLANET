import { useEffect, useState } from 'react';
import { Bot, Check, Loader2, Save, Send, Settings2, Sparkles } from 'lucide-react';

type Config = { ai_name: string; instructions: string; knowledge: string; enabled: boolean; updated_at?: string };
type Props = { circleId: number; circleName: string };

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function CircleAiPanel({ circleId, circleName }: Props) {
  const [config, setConfig] = useState<Config>({ ai_name: 'OLANET AI', instructions: '', knowledge: '', enabled: true });
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/ai/circle/config?circleId=${circleId}`, { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Unable to load Circle AI settings.');
        if (!active) return;
        setConfig(data.config);
        setIsAdmin(Boolean(data.admin));
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Unable to load Circle AI settings.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [circleId]);

  async function saveSettings() {
    setSaving(true); setError(''); setSaved(false);
    try {
      const response = await fetch('/api/ai/circle/config', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ circleId, aiName: config.ai_name, instructions: config.instructions, knowledge: config.knowledge, enabled: config.enabled }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to save settings.');
      setConfig(data.config); setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save settings.'); }
    finally { setSaving(false); }
  }

  async function sendMessage() {
    const text = message.trim();
    if (!text || chatLoading || !config.enabled) return;
    const nextChat = [...chat, { role: 'user' as const, content: text }];
    setChat(nextChat); setMessage(''); setChatLoading(true); setError('');
    try {
      const response = await fetch('/api/ai/circle', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ circleId, message: text, history: chat }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'The Circle AI could not answer right now.');
      setChat([...nextChat, { role: 'assistant', content: data.response }]);
      if (data.aiName && data.aiName !== config.ai_name) setConfig((current) => ({ ...current, ai_name: data.aiName }));
    } catch (err) { setChat(chat); setError(err instanceof Error ? err.message : 'The Circle AI could not answer right now.'); }
    finally { setChatLoading(false); }
  }

  if (loading) return <div className="mt-5 rounded-2xl border border-[#dfd2c0] bg-[#fffaf1] p-5"><div className="flex items-center gap-2 text-sm font-bold text-[#527075]"><Loader2 size={16} className="animate-spin" /> Loading Circle AI…</div></div>;

  return <section className="mt-5 rounded-2xl border border-[#dfd2c0] bg-[#fffaf1] p-5 shadow-[0_6px_22px_rgba(28,64,69,.035)]" data-testid="panel-circle-ai">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#dceceb] text-[#2f817d]"><Sparkles size={21} /></div><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[#2f817d]">Department assistant</p><h3 className="display text-xl font-bold text-[#1d4348]">{config.ai_name}</h3><p className="text-xs text-[#789093]">Official AI for {circleName}</p></div></div>
      <span className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${config.enabled ? 'bg-[#dceceb] text-[#216763]' : 'bg-[#f3dddd] text-[#9a4949]'}`}>{config.enabled ? <Check size={13} /> : null}{config.enabled ? 'AI enabled' : 'AI disabled'}</span>
    </div>

    {error && <div className="mt-4 rounded-xl border border-[#edcaca] bg-[#fff1f1] p-3 text-sm font-semibold text-[#9a4949]">{error}</div>}

    <div className="mt-4 space-y-3" aria-live="polite">
      {chat.length === 0 && <div className="rounded-xl bg-[#f6eddf] p-4 text-sm leading-6 text-[#527075]">Ask {config.ai_name} a question about {circleName}. The assistant uses the administrator's Circle knowledge first, then reliable general knowledge.</div>}
      {chat.map((item, index) => <div key={`${item.role}-${index}`} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === 'user' ? 'bg-[#2f817d] text-white' : 'bg-[#f1e4cc] text-[#365b60]'}`}><p className="whitespace-pre-wrap">{item.content}</p></div></div>)}
      {chatLoading && <div className="flex items-center gap-2 text-xs font-bold text-[#789093]"><Bot size={15} /> Thinking…</div>}
    </div>

    {config.enabled && <div className="mt-4 flex gap-2"><input data-testid="input-circle-ai" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder={`Ask ${config.ai_name}…`} className="min-w-0 flex-1 rounded-xl border border-[#dfd2c0] bg-[#f8f2e8] px-3 py-3 text-sm outline-none focus:border-[#2f817d]" /><button data-testid="button-send-circle-ai" onClick={() => void sendMessage()} disabled={!message.trim() || chatLoading} className="rounded-xl bg-[#2f817d] px-4 text-white disabled:opacity-50"><Send size={17} /></button></div>}

    {isAdmin && <div className="mt-6 border-t border-[#eadfce] pt-5"><div className="mb-4 flex items-center gap-2"><Settings2 size={17} className="text-[#2f817d]" /><div><h4 className="text-sm font-extrabold text-[#1d4348]">Circle Admin AI Settings</h4><p className="text-xs text-[#789093]">Only administrators of this Circle can change these controls.</p></div></div>
      <div className="grid gap-4">
        <label className="text-sm font-bold text-[#365b60]">AI name<input value={config.ai_name} onChange={(event) => setConfig({ ...config, ai_name: event.target.value })} className="mt-1.5 w-full rounded-xl border border-[#dfd2c0] bg-[#f8f2e8] px-3 py-2.5 font-normal outline-none focus:border-[#2f817d]" maxLength={80} /></label>
        <label className="flex items-center justify-between rounded-xl bg-[#f6eddf] p-3 text-sm font-bold text-[#365b60]">Enable Circle AI<input type="checkbox" checked={config.enabled} onChange={(event) => setConfig({ ...config, enabled: event.target.checked })} className="h-5 w-5 accent-[#2f817d]" /></label>
        <label className="text-sm font-bold text-[#365b60]">Administrator instructions<textarea value={config.instructions} onChange={(event) => setConfig({ ...config, instructions: event.target.value })} placeholder="How should this Circle AI behave? What should it prioritize?" className="mt-1.5 h-28 w-full resize-y rounded-xl border border-[#dfd2c0] bg-[#f8f2e8] p-3 text-sm font-normal leading-6 outline-none focus:border-[#2f817d]" maxLength={12000} /></label>
        <label className="text-sm font-bold text-[#365b60]">Administrator knowledge<textarea value={config.knowledge} onChange={(event) => setConfig({ ...config, knowledge: event.target.value })} placeholder="Add official department information, procedures, FAQs, contacts, rules and other knowledge the AI should use." className="mt-1.5 h-40 w-full resize-y rounded-xl border border-[#dfd2c0] bg-[#f8f2e8] p-3 text-sm font-normal leading-6 outline-none focus:border-[#2f817d]" maxLength={30000} /></label>
        <div className="flex items-center justify-between gap-3"><span className="text-xs text-[#789093]">Changes affect this Circle's AI responses.</span><button data-testid="button-save-circle-ai-settings" onClick={() => void saveSettings()} disabled={saving || !config.ai_name.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#1d4348] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}{saving ? 'Saving…' : saved ? 'Saved' : 'Save settings'}</button></div>
      </div>
    </div>}
  </section>;
}
