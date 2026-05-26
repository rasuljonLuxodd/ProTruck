import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
}

export function Field({ label, children, hint }: FieldProps) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint ? <div className="mt-1 text-xs text-fg-subtle">{hint}</div> : null}
    </div>
  );
}
