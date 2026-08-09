'use client';

import { useEffect, useState, type JSX } from 'react';
import { Check, Copy, Keyboard, Link2, QrCode, UsersRound } from 'lucide-react';
import { ClassroomQrCode } from './ClassroomQrCode';
import { classroomCodeFromSessionId } from '@/lib/qr-code';

type Props = { sessionId: string };

export function AlgorithmLabClassroomShare({ sessionId }: Props): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [absoluteUrl, setAbsoluteUrl] = useState<string | null>(null);
  const classroomCode = classroomCodeFromSessionId(sessionId);
  const relativeUrl = `/app/labs/algorithm-lab/join?code=${encodeURIComponent(classroomCode)}`;

  useEffect(() => {
    setAbsoluteUrl(`${window.location.origin}${relativeUrl}`);
  }, [relativeUrl]);

  async function copyLink(): Promise<void> {
    const value = absoluteUrl ?? `${window.location.origin}${relativeUrl}`;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <aside
      className="fixed bottom-4 right-4 z-[90] w-[min(560px,calc(100vw-32px))] rounded-[28px] border border-cyan-300/20 bg-[#081425]/95 p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-5"
      data-testid="algorithm-class-link-card"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200">
          <UsersRound className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.17em] text-cyan-200/55">Vstup pro celou třídu</p>
          <p className="mt-1 text-sm font-black sm:text-base">Naskenuj QR nebo zadej kód</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Jeden vstup pro všechny. SkillStorm žáky po přihlášení automaticky spojí do dvojic.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[170px_1fr] sm:items-center">
        <div className="mx-auto w-full max-w-[170px] rounded-2xl bg-white p-2 shadow-lg" data-testid="algorithm-qr-wrap">
          {absoluteUrl ? (
            <ClassroomQrCode value={absoluteUrl} className="aspect-square w-full text-slate-950" />
          ) : (
            <div className="grid aspect-square place-items-center text-slate-400">
              <QrCode className="h-10 w-10 animate-pulse" aria-hidden="true" />
            </div>
          )}
        </div>

        <div>
          <div className="rounded-2xl border border-violet-300/20 bg-violet-300/[0.07] p-4 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-violet-200/60 sm:justify-start">
              <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
              Kód hodiny
            </div>
            <code className="mt-2 block text-3xl font-black tracking-[0.16em] text-white sm:text-4xl" data-testid="algorithm-class-code">
              {classroomCode}
            </code>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">Kód funguje jen pro aktivní Algorithm Lab v aktuální škole.</p>
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
              {copied ? 'Hotovo' : 'Kopírovat'}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
