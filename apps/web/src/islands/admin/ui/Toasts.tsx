import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';

type Kind = 'info' | 'error';
interface Toast {
  id: number;
  text: string;
  kind: Kind;
}

type ToastFn = (text: string, kind?: Kind) => void;
const ToastCtx = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback<ToastFn>(
    (text, kind = 'info') => {
      const id = ++seq.current;
      setItems((l) => [...l.slice(-3), { id, text, kind }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4000);
    },
    [dismiss],
  );
  const value = useMemo(() => push, [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="adm-toasts" role="status" aria-live="polite" aria-relevant="additions">
        {items.map((t) => (
          <div key={t.id} className={`adm-toast${t.kind === 'error' ? ' is-error' : ''}`}>
            <span>
              {t.kind === 'error' ? '⚠ ' : '> '}
              {t.text}
            </span>
            <button type="button" className="adm-toast-x" aria-label="Fermer la notification" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
