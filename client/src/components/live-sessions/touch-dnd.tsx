"use client";

/*
 * Dotykový drag & drop engine pro projekci na interaktivní tabuli.
 *
 * Zásady (viz docs/live-sessions-interactions.md):
 * - Touch-first: pointer events + setPointerCapture, žádný hover pattern,
 *   žádné HTML5 drag&drop API (na dotyku nefunguje).
 * - Drag ghost: kartička letí pod prstem (position: fixed + translate3d),
 *   originál zůstává zeslabený na místě.
 * - Drop zóny se zvýrazňují, když je ghost nad nimi (hit-test za pohybu).
 * - Neblokující: engine jen hlásí dropy; pending/verdikt stavy drží kolo
 *   nad ním — souběžné tahy víc dětí se nijak nefrontují.
 * - Latence školní wifi (200–500 ms): po puštění kartička zůstane usazená
 *   v zóně s jemným pulzem (animate-pending-pulse), verdikt dokreslí až
 *   odpověď serveru — pop (správně) / zatřesení a návrat (špatně).
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { JSX, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { cn } from "@/utils/cn";

/** Vizuální stav kartičky — řídí ho kolo podle odpovědí serveru. */
export type CardState =
  | "idle"
  | "dragging"
  | "pending" // usazená v zóně, čeká na soud serveru — jemný pulz
  | "settled" // server potvrdil — pop + zůstává
  | "wrong"; // server zamítl — zatřese se a vrátí

/** Minimální dotykový target (px) — tabule, ne telefon. */
export const MIN_TOUCH_TARGET_PX = 100;

interface DropTargetEntry {
  id: string;
  element: HTMLElement;
}

interface TouchDndContextValue {
  registerTarget: (id: string, element: HTMLElement | null) => void;
  startDrag: (
    e: ReactPointerEvent,
    itemId: string,
    sourceElement: HTMLElement,
  ) => void;
  draggingId: string | null;
  hoverTargetId: string | null;
}

const TouchDndContext = createContext<TouchDndContextValue | null>(null);

export function useTouchDnd(): TouchDndContextValue {
  const ctx = useContext(TouchDndContext);
  if (!ctx) throw new Error("useTouchDnd musí být uvnitř <TouchDndBoard>");
  return ctx;
}

interface GhostState {
  itemId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  html: string;
}

/**
 * Kontejner jedné interaktivní plochy. onDrop dostane (itemId, targetId)
 * při puštění nad zónou; puštění mimo zóny = tichý návrat (žádná hanba).
 */
export function TouchDndBoard({
  onDrop,
  disabled = false,
  className,
  children,
}: {
  onDrop: (itemId: string, targetId: string) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  const targetsRef = useRef<Map<string, DropTargetEntry>>(new Map());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const registerTarget = useCallback(
    (id: string, element: HTMLElement | null) => {
      if (element) targetsRef.current.set(id, { id, element });
      else targetsRef.current.delete(id);
    },
    [],
  );

  const hitTest = useCallback((x: number, y: number): string | null => {
    for (const { id, element } of targetsRef.current.values()) {
      const rect = element.getBoundingClientRect();
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        return id;
      }
    }
    return null;
  }, []);

  const startDrag = useCallback(
    (e: ReactPointerEvent, itemId: string, sourceElement: HTMLElement) => {
      if (disabled) return;
      // Jen primární prst/pero — druhý prst dalšího dítěte si vede vlastní
      // drag přes jiný pointerId, ale ghost vedeme jeden (tabule = 1 aktivní
      // tah na kartičku; souběžné PENDING kartičky už na síti neblokují).
      if (!e.isPrimary) return;
      const rect = sourceElement.getBoundingClientRect();
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      setDraggingId(itemId);
      setGhost({
        itemId,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        html: sourceElement.innerHTML,
      });

      const move = (ev: globalThis.PointerEvent) => {
        setGhost((prev) =>
          prev
            ? {
                ...prev,
                x: ev.clientX - dragOffsetRef.current.x,
                y: ev.clientY - dragOffsetRef.current.y,
              }
            : prev,
        );
        setHoverTargetId(hitTest(ev.clientX, ev.clientY));
      };
      const up = (ev: globalThis.PointerEvent) => {
        const targetId = hitTest(ev.clientX, ev.clientY);
        cleanup();
        if (targetId) onDrop(itemId, targetId);
      };
      const cancel = () => cleanup();
      const cleanup = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        setDraggingId(null);
        setHoverTargetId(null);
        setGhost(null);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
    },
    [disabled, hitTest, onDrop],
  );

  const value = useMemo(
    () => ({ registerTarget, startDrag, draggingId, hoverTargetId }),
    [registerTarget, startDrag, draggingId, hoverTargetId],
  );

  return (
    <TouchDndContext.Provider value={value}>
      <div className={cn("relative touch-none select-none", className)}>
        {children}
        {/* Drag ghost — letí pod prstem, mírně zvětšený a natočený */}
        {ghost ? (
          <div
            data-testid="dnd-ghost"
            aria-hidden
            className="pointer-events-none fixed left-0 top-0 z-50 rotate-2 scale-105 opacity-90 drop-shadow-2xl"
            style={{
              width: ghost.width,
              height: ghost.height,
              transform: `translate3d(${ghost.x}px, ${ghost.y}px, 0) rotate(2deg) scale(1.05)`,
            }}
            // innerHTML klonu kartičky — ghost je čistě vizuální kopie
            dangerouslySetInnerHTML={{ __html: ghost.html }}
          />
        ) : null}
      </div>
    </TouchDndContext.Provider>
  );
}

/**
 * Táhnutelná kartička. Vzhled stavů řídí `state` (pending pulz, settled pop,
 * wrong shake) — po shake animaci zavolá onWrongAnimationEnd (návrat domů).
 */
export function DragCard({
  itemId,
  state,
  onWrongAnimationEnd,
  className,
  children,
  testId,
}: {
  itemId: string;
  state: CardState;
  onWrongAnimationEnd?: () => void;
  className?: string;
  children: ReactNode;
  testId?: string;
}): JSX.Element {
  const { startDrag, draggingId } = useTouchDnd();
  const ref = useRef<HTMLDivElement>(null);
  const isDragSource = draggingId === itemId;
  const draggable = state === "idle" || state === "wrong";

  return (
    <div
      ref={ref}
      data-testid={testId ?? `dnd-card-${itemId}`}
      data-card-state={state}
      role="button"
      tabIndex={draggable ? 0 : -1}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (!draggable || !ref.current) return;
        e.preventDefault();
        startDrag(e, itemId, ref.current);
      }}
      onAnimationEnd={() => {
        if (state === "wrong") onWrongAnimationEnd?.();
      }}
      style={{ minHeight: MIN_TOUCH_TARGET_PX }}
      className={cn(
        "touch-none select-none transition-transform",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragSource && "opacity-30",
        state === "pending" && "animate-pending-pulse",
        state === "settled" && "animate-pop",
        state === "wrong" && "animate-shake",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Drop zóna — registruje se do hit-testu, zvýrazní se, když je nad ní tah.
 */
export function DropZone({
  targetId,
  className,
  highlightClassName,
  children,
  testId,
}: {
  targetId: string;
  className?: string;
  highlightClassName?: string;
  children?: ReactNode;
  testId?: string;
}): JSX.Element {
  const { registerTarget, hoverTargetId, draggingId } = useTouchDnd();
  const isHover = hoverTargetId === targetId;
  const isDropCandidate = draggingId !== null;

  return (
    <div
      ref={(el) => registerTarget(targetId, el)}
      data-testid={testId ?? `dnd-zone-${targetId}`}
      data-drop-hover={isHover || undefined}
      className={cn(
        "transition-all",
        isDropCandidate && "ring-2 ring-line-strong/40",
        isHover && cn("scale-[1.03] ring-4 ring-accent", highlightClassName),
        className,
      )}
    >
      {children}
    </div>
  );
}
