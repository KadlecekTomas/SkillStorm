"use client";

import type { JSX } from "react";
import Link from "next/link";
import { ShieldOff } from "lucide-react";

export default function PlatformForbiddenPage(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm">
          <ShieldOff className="h-7 w-7 text-gray-400" aria-hidden />
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            403 · Forbidden
          </p>
          <h1 className="text-2xl font-semibold text-gray-900">
            Nemáš oprávnění
          </h1>
          <p className="text-sm leading-relaxed text-gray-500">
            Tato část platformy je dostupná pouze platformovým
            administrátorům. Pokud si myslíš, že jde o chybu, kontaktuj
            správce systému.
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* CTA */}
        <Link
          href="/app"
          className="inline-flex h-9 items-center rounded-xl border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          Zpět do aplikace
        </Link>
      </div>
    </div>
  );
}
