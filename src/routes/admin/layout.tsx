/**
 * Coque de l'espace superviseur : cinq onglets — Vue Globale, Flotte
 * Chauffeurs, Villes du Niger, Comptabilité, Cerveau IA & Logs.
 */

import { Brain, Coins, LayoutDashboard, MapPinned, Users } from 'lucide-react';
import { Outlet } from 'react-router';
import { useT } from '@/components/AppProvider';
import { BottomTabBar } from '@/components/BottomTabBar';

export default function AdminLayout() {
  const t = useT();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col">
      <div className="flex-1 pb-24">
        <Outlet />
      </div>
      <BottomTabBar
        tabs={[
          {
            to: '/admin',
            label: t('navOverview'),
            icon: LayoutDashboard,
            end: true,
          },
          { to: '/admin/chauffeurs', label: t('navFleet'), icon: Users },
          { to: '/admin/villes', label: t('navCities'), icon: MapPinned },
          {
            to: '/admin/comptabilite',
            label: t('navAccounting'),
            icon: Coins,
          },
          { to: '/admin/cerveau', label: t('navBrain'), icon: Brain },
        ]}
      />
    </div>
  );
}
