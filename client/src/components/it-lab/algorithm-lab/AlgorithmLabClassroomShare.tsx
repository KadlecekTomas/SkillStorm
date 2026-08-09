'use client';

import { useState, type JSX } from 'react';
import { Check, Copy, Link2, UsersRound } from 'lucide-react';

type Props = { sessionId: string };

export function AlgorithmLabClassroomShare({ sessionId }: Props): JSX.Element {
  const [copied, setCopied] = useState(false);
  const relativeUrl = `/app/labs/algorithm-lab?session=${sessionId}`;

  async function copyLink(): Promise<void> {
    const absoluteUrl = `${window.location.origin}${relativeUrl}`;
    await navigator.clipboard.writeText(absoluteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <aside className="fixed bottom-4 right-4 z-[90] w-[min(390px,calc(100vw-32px))] rounded-[24px] border border-cyan-300/20 bg-[#081425]/95 p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,.55)] backdrop-blur-xl" data-testid="algorithm-class-link-card">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200">
          <UsersRound className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.17em] text-cyan-200/55">Vstup pro celou třídu</p>
          <p className="mt-1 text-sm font-black">Jeden odkaz pro všechny žáky</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Žáci se po otevření automaticky skládají do dvojic. Nikdo neřeší číslo skupiny ani QR pro každou dvojici.</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 p-2">
        <Link2 className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <code className="min-w-0 flex-1 truncate text-[10px] text-slate-400" data-testid="algorithm-class-link">{relativeUrl}</code>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          data-testid="algorithm-copy-class-link"
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied ? 'Zkopírováno' : 'Kopírovat'}
        </button>
      </div>
    </aside>
  );
}
