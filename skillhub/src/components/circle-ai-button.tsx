import { Sparkles } from 'lucide-react';
import { Link } from 'wouter';

export type CircleAiButtonProps = {
  circleId: string;
  circleName: string;
  className?: string;
};

/** Each department opens its own Circle page, where the public OLANET AI widget
 * mounts automatically and uses the department-specific AI context. */
export function CircleAiButton({ circleId, circleName, className = '' }: CircleAiButtonProps) {
  return (
    <Link
      href={`/circles/${encodeURIComponent(circleId)}`}
      aria-label={`Open OLANET AI for ${circleName}`}
      data-testid={`button-circle-ai-${circleId}`}
      className={`inline-flex items-center gap-2 rounded-full border border-[#d9d9d9] bg-white px-4 py-2.5 text-sm font-extrabold text-[#1d4348] shadow-sm transition hover:bg-[#f4f4f4] active:scale-[.98] ${className}`}
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#1d4348] text-white">
        <Sparkles size={15} strokeWidth={2.5} />
      </span>
      <span>OLANET AI</span>
    </Link>
  );
}
