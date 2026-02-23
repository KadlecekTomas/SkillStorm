"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/utils/cn";

type UserMenuProps = {
  displayName: string;
  avatarUrl?: string | null;
  onLogout: () => void;
  className?: string;
};

export function UserMenu({
  displayName,
  avatarUrl,
  onLogout,
  className,
}: UserMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Menu uživatele"
      >
        <Avatar className="h-9 w-9">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={displayName} />
          ) : (
            <AvatarFallback className="bg-slate-200 text-slate-700 text-sm">
              {displayName
                .split(" ")
                .map((n) => n[0] ?? "")
                .join("")
                .slice(0, 2)
                .toUpperCase() ?? "U"}
            </AvatarFallback>
          )}
        </Avatar>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          role="menu"
        >
          <Link
            href="/app/settings"
            className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Můj profil
          </Link>
          <Link
            href="/account/security"
            className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Bezpečnost
          </Link>
          <button
            type="button"
            className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Odhlásit se
          </button>
        </div>
      )}
    </div>
  );
}
