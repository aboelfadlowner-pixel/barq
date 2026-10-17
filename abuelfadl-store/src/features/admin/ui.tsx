"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/types/order";

/** Small stroke icons for the dashboard (separate from the store sprite so the admin bundle stays small). */
const PATHS: Record<string, string> = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  orders: "M6 3h12l1 4H5zM5 7h14v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM9 11h6M9 15h4",
  box: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10",
  tag: "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM8 8h.01",
  store: "M4 9l1-5h14l1 5M4 9v11h16V9M4 9h16M9 20v-6h6v6",
  logout: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3",
  plus: "M12 5v14M5 12h14",
  back: "M9 6l6 6-6 6",
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1",
};

export function Ic({ name }: { name: keyof typeof PATHS | string }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge st-${status}`}>{ORDER_STATUS_LABELS[status]}</span>;
}

/** Text field with label and error, used by the dashboard forms. */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={error ? "field bad" : "field"}>
      <label>{label}</label>
      {children}
      {error ? <small className="err">{error}</small> : hint ? <small className="hint">{hint}</small> : null}
    </div>
  );
}

const ToastContext = createContext<(message: string) => void>(() => {});

/** `const toast = useToast(); toast("اتحفظ")` shows a short message at the bottom. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2600);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <div className="toast" role="status">
          {message}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
