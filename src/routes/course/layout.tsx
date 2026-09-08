/**
 * Coque de l'espace passager : cinq onglets — Accueil, Carte & Taxis, Course
 * en cours, Historique, Profil & Studio 3D.
 */

import { Clock, Home, Map, Navigation, User } from 'lucide-react';
import { Outlet } from 'react-router';
import { useT } from '@/components/AppProvider';
import { BottomTabBar } from '@/components/BottomTabBar';

export default function CourseLayout() {
  const t = useT();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <div className="flex-1 pb-24">
        <Outlet />
      </div>
      <BottomTabBar
        tabs={[
          { to: '/course', label: t('navHome'), icon: Home, end: true },
          { to: '/course/carte', label: t('navMap'), icon: Map },
          {
            to: '/course/en-cours',
            label: t('navCurrentRide'),
            icon: Navigation,
          },
          { to: '/course/historique', label: t('navHistory'), icon: Clock },
          { to: '/course/profil', label: t('navProfile'), icon: User },
        ]}
      />
    </div>
  );
}
