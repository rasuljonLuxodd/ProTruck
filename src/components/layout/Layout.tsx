import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: (helpers: { openMenu: () => void }) => ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-bg text-fg">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-[1280px] px-5 md:px-8 py-6 md:py-8">
          {children({ openMenu: () => setOpen(true) })}
        </div>
      </main>
    </div>
  );
}
