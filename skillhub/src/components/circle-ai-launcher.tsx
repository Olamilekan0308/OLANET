import { useState } from 'react';
import { Bot, X } from 'lucide-react';
import { CircleAiPanel } from '@/components/circle-ai-panel';

const circleMap: Record<string, { id: number; name: string }> = {
  electrical: { id: 1, name: 'Electrical Engineering' },
  civil: { id: 2, name: 'Civil Engineering' },
  mechanical: { id: 3, name: 'Mechanical Engineering' },
  'computer-science': { id: 4, name: 'Computer Science' },
  'phone-repair': { id: 5, name: 'Phone Repair' },
  fashion: { id: 6, name: 'Fashion' },
  carpentry: { id: 7, name: 'Carpentry' },
  agriculture: { id: 8, name: 'Agriculture' },
  catering: { id: 9, name: 'Catering' },
};

export function CircleAiLauncher() {
  const [open, setOpen] = useState(false);
  const path = typeof window === 'undefined' ? '' : window.location.pathname;
  const match = path.match(/^\/circles\/([^/]+)/);
  const slug = match ? decodeURIComponent(match[1]) : '';
  const circle = circleMap[slug];

  if (!circle) return null;

  return <>
    <button data-testid="button-open-circle-ai" onClick={() => setOpen(true)} aria-label={`Open ${circle.name} AI`} className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-[#1d4348] px-4 py-3 text-sm font-extrabold text-white shadow-xl transition hover:scale-[1.02]">
      <Bot size={18} /> Circle AI
    </button>
    {open && <div className="fixed inset-0 z-[55] overflow-y-auto bg-[#17383b]/40 p-2 sm:p-6">
      <div className="mx-auto max-w-3xl pb-6">
        <div className="flex justify-end"><button data-testid="button-close-circle-ai" onClick={() => setOpen(false)} className="mb-2 rounded-full bg-[#fffaf1] p-2 text-[#1d4348] shadow-lg"><X size={20} /></button></div>
        <CircleAiPanel circleId={circle.id} circleName={circle.name} />
      </div>
    </div>}
  </>;
}
