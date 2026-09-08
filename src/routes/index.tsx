/**
 * Racine de l'application : pure redirection vers la première destination
 * utile selon le rôle de l'utilisateur connecté.
 */

import { Navigate } from 'react-router';
import { useCurrentProfiles } from '@/hooks/useCurrentProfiles';
import { Spinner } from '@/components/ui/spinner';

export default function Index() {
  const { role, isLoading } = useCurrentProfiles();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-7" />
      </div>
    );
  }

  if (role === 'Admin') return <Navigate to="/admin" replace />;
  if (role === 'Chauffeur') return <Navigate to="/chauffeur" replace />;
  return <Navigate to="/course" replace />;
}