import { Sparkles } from 'lucide-react';
import { Link } from 'wouter';

export type CircleAiButtonProps = {
  circleId: string;
  circleName: string;
  className?: string;
};

/** Prominent Circle-level entry point. Every Circle uses the same OLANET AI name,
 * while circleId determines the specialist context on the server. */
export function CircleAiButton({ circleId, circleName, className = '' }: CircleAiButtonProps) {
  return (
    <Link
      href={`/circles/${encodeURIComponent(circleId)}/ai`}
      aria-label={`Open OLANET AI for ${circleName}`}
      data-testid={`button-circle-ai-${circleId}`}
      className={`inline-flex items-center gap-2 rounded-full border border-[#b9d8ff] bg-[#eaf3ff] px-4 py-2.5 text-sm font-extrabold text-[#0b5ed7] shadow-sm transition hover:bg-[#dcecff] active:scale-[.98] ${className}`}
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0b5ed7] text-white">
        <Sparkles size={15} strokeWidth={2.5} />
      </span>
      <span>OLANET AI</span>
    </Link>
  );
}
