import { toast, type ToastOptions } from "react-toastify";
import type { HttpError } from "@/lib/http/client";

const activeToasts = new Set<string>();

export function showToastOnce(message: string, options?: ToastOptions): ReturnType<typeof toast> | undefined {
  const trimmed = message?.toString().trim();
  if (!trimmed) return undefined;
  if (activeToasts.has(trimmed)) return undefined;
  const id = toast(trimmed, {
    ...options,
    onClose: (...args) => {
      activeToasts.delete(trimmed);
      if (options?.onClose) {
        (options.onClose as (...p: unknown[]) => void)(...args);
      }
    },
  });
  activeToasts.add(trimmed);
  return id;
}

type ResolvedToast = {
  showToast: boolean;
  type?: "error" | "info";
  message?: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const extractErrorMeta = (
  err: HttpError,
): { status: number; code: string | null; message: string | null } => {
  const raw = err.data as { code?: string; message?: string; meta?: { code?: string; message?: string } } | null | undefined;
  const meta = raw && typeof raw === "object" ? raw.meta : undefined;
  const code = (raw && "code" in raw && isNonEmptyString(raw.code))
    ? raw.code
    : meta && isNonEmptyString(meta.code)
      ? meta.code
      : null;
  const backendMessage = (raw && "message" in raw && isNonEmptyString(raw.message))
    ? raw.message.trim()
    : meta && isNonEmptyString(meta.message)
      ? meta.message.trim()
      : null;

  return {
    status: err.status,
    code,
    message: backendMessage,
  };
};

/**
 * Jediný zdroj pravdy pro rozhodnutí, zda a jak zobrazit toast na základě HttpError.
 * - Stavové kódy (ORG_PENDING, ORG_NOT_READY) nikdy nezobrazují toast.
 * - Vždy vrací uživatelsky čitelnou zprávu, nebo showToast=false.
 */
export function resolveToastFromHttpError(err: HttpError): ResolvedToast {
  const { status, code, message } = extractErrorMeta(err);

  // Stavové kódy – onboarding state machine, NE chyby.
  if (
    code === "ORG_PENDING" ||
    code === "ORG_NOT_READY" ||
    code === "NO_CURRENT_ACADEMIC_YEAR" ||
    code === "NO_ACTIVE_ACADEMIC_YEAR"
  ) {
    return { showToast: false };
  }

  let resolved: string | undefined;

  // Pokud backend poslal smysluplnou message, použij ji.
  if (isNonEmptyString(message)) {
    resolved = message.trim();
  } else {
    // Jinak rozhodni podle status kódu.
    if (status === 400 || status === 422) {
      resolved = "Zadaná data nejsou platná. Zkontroluj prosím formulář.";
    } else if (status === 403) {
      if (code && code.startsWith("ORG_")) {
        resolved = "Nemáš oprávnění k této akci v aktuální organizaci.";
      } else {
        resolved = "Nemáš oprávnění pro tuto akci.";
      }
    } else if (status === 404) {
      resolved = "Požadovaný záznam nebyl nalezen.";
    } else if (status === 409) {
      resolved = "Tato akce není v aktuálním stavu povolena.";
    } else if (status >= 500) {
      resolved = "Došlo k technické chybě na serveru. Zkus to prosím znovu.";
    } else {
      resolved = "Došlo k chybě. Zkus to prosím znovu.";
    }
  }

  if (!isNonEmptyString(resolved)) {
    return { showToast: false };
  }

  return {
    showToast: true,
    type: "error",
    message: resolved.trim(),
  };
}

/**
 * Pohodlný wrapper nad resolveToastFromHttpError – nikdy nezobrazí prázdný ani generický toast.
 */
export function showHttpErrorToastOnce(err: unknown): void {
  if (!err || typeof err !== "object") {
    showToastOnce("Došlo k technické chybě. Zkus to prosím znovu.", { type: "error" });
    return;
  }

  const maybeHttpError = err as HttpError;
  if (typeof maybeHttpError.status !== "number") {
    showToastOnce("Došlo k technické chybě. Zkus to prosím znovu.", { type: "error" });
    return;
  }

  const resolved = resolveToastFromHttpError(maybeHttpError);
  if (!resolved.showToast || !resolved.message) return;
  showToastOnce(resolved.message, { type: resolved.type ?? "error" });
}
