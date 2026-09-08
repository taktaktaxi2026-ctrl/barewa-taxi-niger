/**
 * Coque de l'espace chauffeur : cinq onglets — Cockpit, Courses disponibles,
 * Revenus & Caisse, Abonnés, Mon Taxi & Studio 3D.
 */

import { Box, Gauge, Inbox, Users, Wallet } from 'lucide-react';
import { Outlet } from 'react-router';
import { useT } from '@/components/AppProvider';
import { BottomTabBar } from '@/components/BottomTabBar';

export default function ChauffeurLayout() {
  const t = useT();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <div className="flex-1 pb-24">
        <Outlet />
      </div>
      <BottomTabBar
        tabs={[
          { to: '/chauffeur', label: t('navCockpit'), icon: Gauge, end: true },
          { to: '/chauffeur/courses', label: t('navRides'), icon: Inbox },
          { to: '/chauffeur/revenus', label: t('navRevenue'), icon: Wallet },
          {
            to: '/chauffeur/abonnes',
            label: t('navSubscribers'),
            icon: Users,
          },
          { to: '/chauffeur/mon-taxi', label: t('navMyTaxi'), icon: Box },
        ]}
      />
    </div>
  );
}
