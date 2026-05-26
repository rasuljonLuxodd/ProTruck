import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { CommandPalette } from '@/components/ui/CommandPalette';

interface LayoutProps {
  children: (helpers: { openMenu: () => void; openPalette: () => void }) => ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global Cmd/Ctrl+K to open the palette.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === 'k';
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen(p => !p);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex min-h-screen bg-bg text-fg">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-[1280px] px-5 md:px-8 py-6 md:py-8">
          {children({
            openMenu: () => setOpen(true),
            openPalette: () => setPaletteOpen(true),
          })}
        </div>
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
