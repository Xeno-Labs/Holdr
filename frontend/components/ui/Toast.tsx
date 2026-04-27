"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle, XCircle, Loader2, X } from "lucide-react";

type ToastType = "pending" | "success" | "error";

interface Toast {
  id:      string;
  type:    ToastType;
  title:   string;
  message?: string;
}

interface ToastCtx {
  toast: (t: Omit<Toast, "id">) => string;
  update: (id: string, t: Partial<Omit<Toast, "id">>) => void;
  dismiss: (id: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    if (t.type !== "pending") {
      setTimeout(() => dismiss(id), 5000);
    }
    return id;
  }, []);

  const update = useCallback((id: string, t: Partial<Omit<Toast, "id">>) => {
    setToasts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...t } : item)),
    );
    if (t.type && t.type !== "pending") {
      setTimeout(() => dismiss(id), 5000);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return (
    <Ctx.Provider value={{ toast, update, dismiss }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-3 bg-background border border-border rounded-2xl p-4 shadow-lg animate-fade-up"
          >
            <span className="mt-0.5 shrink-0">
              {t.type === "pending" && <Loader2 size={16} className="text-muted animate-spin" />}
              {t.type === "success" && <CheckCircle size={16} className="text-accent" />}
              {t.type === "error"   && <XCircle    size={16} className="text-destructive" />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{t.title}</p>
              {t.message && (
                <p className="text-xs text-muted mt-0.5 leading-relaxed">{t.message}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-muted hover:text-foreground shrink-0 mt-0.5"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}

/**
 * Wraps a contract write with automatic pending → success/error toasts.
 * Usage:
 *   const { write } = useTxToast();
 *   await write("Opening round", () => writeContractAsync({...}));
 */
export function useTxToast() {
  const { toast, update } = useToast();

  async function write<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const id = toast({ type: "pending", title: label, message: "Waiting for wallet…" });
    try {
      const result = await fn();
      update(id, { type: "success", title: label, message: "Transaction confirmed" });
      return result;
    } catch (e: unknown) {
      const msg = (e as { shortMessage?: string; message?: string })?.shortMessage
        ?? (e as Error)?.message
        ?? "Transaction failed";
      update(id, { type: "error", title: label, message: msg });
      throw e;
    }
  }

  return { write };
}
