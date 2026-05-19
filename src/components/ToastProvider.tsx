import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";

type Toast = {
  id: string;
  title: string;
  tone: "info" | "success" | "error";
};

type ToastContextValue = {
  notify: (title: string, tone?: Toast["tone"]) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function createToastId() {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      notify: (title, tone = "info") => {
        const id = createToastId();
        setToasts((current) => [...current, { id, title, tone }]);
        window.setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== id));
        }, 3500);
      }
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-md border px-4 py-3 text-sm shadow-lg ${
              toast.tone === "success"
                ? "border-emerald-500/40 bg-emerald-950/90 text-emerald-100"
                : toast.tone === "error"
                  ? "border-red-500/40 bg-red-950/90 text-red-100"
                  : "border-border bg-card text-card-foreground"
            }`}
          >
            {toast.title}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
