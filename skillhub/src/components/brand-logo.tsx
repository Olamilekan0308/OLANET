import { Link } from 'wouter';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="OLANET home" className="inline-flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0b5ed7] text-white shadow-sm">
        <span className="text-lg font-black tracking-tight">O</span>
      </span>
      {!compact && <span className="text-xl font-black tracking-[-0.04em] text-[#123b67]">OLANET</span>}
    </Link>
  );
}
