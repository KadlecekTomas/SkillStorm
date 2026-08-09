'use client';

import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Keyboard, QrCode, UsersRound } from 'lucide-react';
import { classroomSessionApi } from '@/lib/classroom-session-api';

function normalizeCode(value: string): string {
  const compact = value.replace(/[^a-fA-F0-9]/g, '').slice(0, 8).toUpperCase();
  if (compact.length <= 4) return compact;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

export default function AlgorithmLabJoinPage(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = normalizeCode(searchParams.get('code') ?? '');
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  async function join(value: string): Promise<void> {
    const normalized = normalizeCode(value);
    if (normalized.replace('-', '').length !== 8 || loading) {
      if (!loading) setError('Zadej osm znaků kódu z tabule.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { sessionId } = await classroomSessionApi.resolveAlgorithmLabCode(normalized);
      router.replace(`/app/labs/algorithm-lab?session=${encodeURIComponent(sessionId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kód hodiny se nepodařilo ověřit.');
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialCode || autoStarted.current) return;
    autoStarted.current = true;
    void join(initialCode);
    // initialCode is intentionally the only auto-join trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void join(code);
  }

  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#07101f] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
      </div>

      <section className="relative z-10 w-full max-w-lg rounded-[32px] border border-white/10 bg-white/[0.045] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200">
            <UsersRound className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/60">Algorithm Lab · vstup do hodiny</p>
            <h1 className="mt-1 text-2xl font-black">Připojit se ke třídě</h1>
          </div>
        </div>

        {initialCode && loading ? (
          <div className="mt-8 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-6 text-center" data-testid="algorithm-code-auto-join">
            <QrCode className="mx-auto h-10 w-10 animate-pulse text-cyan-200" aria-hidden="true" />
            <p className="mt-4 font-black">Připojuji tě k hodině…</p>
            <p className="mt-1 text-sm text-slate-500">QR kód už obsahuje správný classroom code.</p>
          </div>
        ) : (
          <form className="mt-7" onSubmit={submit}>
            <label htmlFor="classroom-code" className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              <Keyboard className="h-4 w-4" aria-hidden="true" />
              Kód z tabule
            </label>
            <input
              id="classroom-code"
              data-testid="algorithm-code-input"
              value={code}
              onChange={(event) => setCode(normalizeCode(event.target.value))}
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={9}
              placeholder="ABCD-EF12"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-center text-2xl font-black tracking-[0.16em] text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
            />

            {error && (
              <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100" data-testid="algorithm-code-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="algorithm-code-submit"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-4 text-base font-black text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? 'Ověřuji kód…' : 'Připojit se'}
              {!loading && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">Nemusíš vybírat dvojici. SkillStorm tě po připojení zařadí automaticky.</p>
      </section>
    </main>
  );
}
