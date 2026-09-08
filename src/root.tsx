/**
 * Coque applicative BAREWA.
 *
 * Ne porte que ce qui est réellement partagé par les trois destinations : les
 * fournisseurs de contexte, la barre supérieure fixe, le bouton flottant de
 * l'assistante et les notifications. Les modales globales sont rendues une
 * seule fois par `AppProvider`. La navigation interne à chaque destination vit
 * dans le `layout.tsx` de son dossier.
 */

import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { AppProvider } from '@/components/AppProvider';
import { TopBar } from '@/components/TopBar';
import { BarewaAiFloatingButton } from '@/components/BarewaAiFloatingButton';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';

function Shell() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <TopBar />
      <main className="flex-1">
        <Outlet />
      </main>
      <BarewaAiFloatingButton />
      <Toaster />
    </div>
  );
}

export default function Root() {
  useEffect(() => {
    document.title = 'BAREWA';
    document.documentElement.lang = 'fr';
  }, []);

  return (
    <AppProvider>
      <TooltipProvider>
        <Shell />
      </TooltipProvider>
    </AppProvider>
  );
}
