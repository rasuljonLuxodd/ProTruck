import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Check, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setItems(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = crypto.randomUUID();
    setItems(prev => [...prev, { id, message, kind }]);
    setTimeout(() => remove(id), 3500);
  }, [remove]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
        {items.map(item => (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex items-center gap-2.5 bg-bg border border-border rounded-lg shadow-lg px-3.5 py-2.5 min-w-[260px] animate-slideIn',
            )}
          >
            {item.kind === 'success' ? (
              <span className="w-5 h-5 rounded-full bg-positive/15 text-positive flex items-center justify-center">
                <Check className="w-3 h-3" />
              </span>
            ) : item.kind === 'error' ? (
              <span className="w-5 h-5 rounded-full bg-negative/15 text-negative flex items-center justify-center">
                <AlertTriangle className="w-3 h-3" />
              </span>
            ) : null}
            <span className="text-sm font-medium flex-1 text-fg">{item.message}</span>
            <button
              onClick={() => remove(item.id)}
              className="text-fg-subtle hover:text-fg transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
