import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { SessionBanner } from '@/components/ui/SessionBanner';

interface LayoutProps {
  children: (helpers: { openMenu: () => void; openPalette: () => void }) => ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

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
        <SessionBanner />
        <div className="mx-auto max-w-[1280px] px-5 md:px-8 py-6 md:py-8">
          {/* Page-content key on pathname so React re-mounts on route change,
              re-triggering the fadeIn animation. Layout chrome (sidebar,
              session banner, palette) stays mounted across navigation so
              there's no flicker. */}
          <div key={location.pathname} className="animate-pageEnter">
            {children({
              openMenu: () => setOpen(true),
              openPalette: () => setPaletteOpen(true),
            })}
          </div>
        </div>
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
