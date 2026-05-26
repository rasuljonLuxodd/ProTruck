import { useEffect, type ReactNode } from 'react';
import { X, Printer } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * A modal that previews a printable slip and ships with a "Print" button
 * that triggers `window.print()`. The global @media print rules in
 * `index.css` hide the rest of the chrome, so only this content prints.
 */
export function PrintableSlip({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn no-print"
      style={{ background: 'rgb(0 0 0 / 0.4)', backdropFilter: 'blur(6px)' }}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-bg text-fg border border-border rounded-xl shadow-lg animate-scaleIn"
      >
        <div className="px-5 py-3 border-b border-border flex items-center justify-between no-print">
          <h2 className="text-sm font-semibold">{title}</h2>
          <div className="flex gap-1">
            <button
              onClick={() => window.print()}
              className="btn-primary !py-1.5 !text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-surface transition"
              aria-label="close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-6 font-mono text-sm">{children}</div>
      </div>
    </div>
  );
}
